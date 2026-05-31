import { Router } from "express";
import type { Request, Response } from "express";
import { env } from "../config/env";
import { IdempotencyStore } from "../lib/idempotency";
import { logError, logInfo, logWarn } from "../lib/logger";
import { verifyShopifyWebhookHmac } from "../lib/shopifyHmac";
import { isTopicAccepted, parseAllowedTopics } from "../lib/topicGuard";
import { resolveEventId } from "../services/eventId";
import { forwardToGtmServer } from "../services/gtmForwarder";
import { incrementCounter } from "../services/metrics";
import { mapRefundToRefundEvent } from "../services/payloadMapper";
import { captureSynapseShadow } from "../services/shadowCompare";
import type { ShopifyRefund } from "../types/shopify";

const router = Router();
const idempotencyStore = new IdempotencyStore(env.IDEMPOTENCY_TTL_MS);
const allowedTopics = parseAllowedTopics(env.ALLOWED_WEBHOOK_TOPICS);

function buildIdempotencyKey(req: Request, refund: ShopifyRefund): string {
  const webhookId = req.get("X-Shopify-Webhook-Id");
  if (webhookId) {
    return webhookId;
  }

  const topic = req.get("X-Shopify-Topic") ?? "unknown-topic";
  const orderRef = refund.order_id?.toString() ?? refund.order_name ?? refund.id?.toString() ?? "unknown-refund";
  return `${topic}:${orderRef}`;
}

router.post("/create", async (req: Request, res: Response): Promise<void> => {
  const rawBody = req.body as Buffer;
  const hmacHeader = req.get("X-Shopify-Hmac-Sha256");
  const topic = req.get("X-Shopify-Topic") ?? "unknown-topic";
  const shop = req.get("X-Shopify-Shop-Domain") ?? "unknown-shop";
  const webhookId = req.get("X-Shopify-Webhook-Id") ?? undefined;

  incrementCounter("refunds_received");

  if (!isTopicAccepted(topic, "refunds/create", allowedTopics)) {
    incrementCounter("refunds_rejected_topic");
    logWarn("Refund webhook rejected due to disallowed or mismatched topic", {
      topic,
      expected_topic: "refunds/create",
      shop
    });
    res.status(400).json({ error: "Disallowed or mismatched webhook topic" });
    return;
  }

  if (!verifyShopifyWebhookHmac(rawBody, hmacHeader, env.SHOPIFY_WEBHOOK_SECRET)) {
    incrementCounter("refunds_invalid_signature");
    logWarn("Refund webhook rejected due to invalid signature", { topic, shop });
    res.status(401).json({ error: "Invalid Shopify webhook signature" });
    return;
  }

  let refund: ShopifyRefund;
  try {
    refund = JSON.parse(rawBody.toString("utf8")) as ShopifyRefund;
  } catch {
    incrementCounter("refunds_invalid_json");
    logWarn("Refund webhook rejected due to invalid JSON", { topic, shop });
    res.status(400).json({ error: "Invalid JSON payload" });
    return;
  }

  const idempotencyKey = buildIdempotencyKey(req, refund);
  if (idempotencyStore.isDuplicate(idempotencyKey)) {
    incrementCounter("refunds_duplicate_ignored");
    logInfo("Duplicate refund webhook ignored", { topic, shop, idempotency_key: idempotencyKey });
    res.status(200).json({ status: "duplicate_ignored" });
    return;
  }

  try {
    const eventId = resolveEventId({
      webhookId,
      shop,
      topic,
      orderNumber: refund.order_id,
      orderName: refund.order_name
    });

    const payload = mapRefundToRefundEvent(
      refund,
      env.SHOP_DEFAULT_CURRENCY,
      eventId,
      env.CUSTOMER_ID_FALLBACK
    );

    if (env.RUNTIME_MODE === "shadow_compare") {
      await captureSynapseShadow(payload);
      idempotencyStore.markProcessed(idempotencyKey);
      incrementCounter("refunds_shadow_captured");

      logInfo("Refund webhook captured in shadow_compare mode (no forwarding)", {
        topic,
        shop,
        idempotency_key: idempotencyKey,
        event_id: payload.event_id,
        transaction_id: payload.transaction_id,
        value: payload.value,
        currency: payload.currency
      });

      res.status(200).json({ status: "shadow_captured_no_forward" });
      return;
    }

    await forwardToGtmServer(payload);
    idempotencyStore.markProcessed(idempotencyKey);
    incrementCounter("refunds_forwarded");

    logInfo("Refund webhook processed and forwarded", {
      topic,
      shop,
      idempotency_key: idempotencyKey,
      event_id: payload.event_id,
      transaction_id: payload.transaction_id,
      value: payload.value,
      currency: payload.currency
    });

    res.status(200).json({ status: "forwarded" });
  } catch (error) {
    incrementCounter("refunds_forward_failed");
    logError("Failed forwarding refund webhook", {
      topic,
      shop,
      idempotency_key: idempotencyKey,
      error: (error as Error).message
    });
    res.status(502).json({ error: "Failed to forward event" });
  }
});

export { router as refundsRouter };
