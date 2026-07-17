import { Router } from "express";
import type { Request, Response } from "express";
import { env } from "../config/env";
import { IdempotencyStore } from "../lib/idempotency";
import { logError, logInfo, logWarn } from "../lib/logger";
import { verifyShopifyWebhookHmac, toRawBodyBuffer } from "../lib/shopifyHmac";
import { isTopicAccepted, parseAllowedTopics } from "../lib/topicGuard";
import { resolveEventId } from "../services/eventId";
import { forwardToGtmServer } from "../services/gtmForwarder";
import { captureSynapseShadow } from "../services/shadowCompare";
import { incrementCounter } from "../services/metrics";
import { mapOrderToPurchase } from "../services/payloadMapper";
import type { ShopifyOrder } from "../types/shopify";

const router = Router();
const idempotencyStore = new IdempotencyStore(env.IDEMPOTENCY_TTL_MS);
const allowedTopics = parseAllowedTopics(env.ALLOWED_WEBHOOK_TOPICS);

function buildIdempotencyKey(req: Request, order: ShopifyOrder): string {
  const webhookId = req.get("X-Shopify-Webhook-Id");
  if (webhookId) {
    return webhookId;
  }

  const topic = req.get("X-Shopify-Topic") ?? "unknown-topic";
  const orderRef = order.order_number?.toString() ?? order.name ?? "unknown-order";
  return `${topic}:${orderRef}`;
}

function createOrderWebhookHandler(expectedTopic: string) {
  return async function handleOrderWebhook(req: Request, res: Response): Promise<void> {
  const rawBody = toRawBodyBuffer(req.body);
  const hmacHeader = req.get("X-Shopify-Hmac-Sha256");
  const topic = req.get("X-Shopify-Topic") ?? "unknown-topic";
  const shop = req.get("X-Shopify-Shop-Domain") ?? "unknown-shop";
  const webhookId = req.get("X-Shopify-Webhook-Id") ?? undefined;

  incrementCounter("webhooks_received");

  if (!rawBody) {
    incrementCounter("webhooks_invalid_json");
    logWarn("Webhook rejected because raw body was unavailable", { topic, shop });
    res.status(400).json({ error: "Raw webhook body required" });
    return;
  }

  if (!isTopicAccepted(topic, expectedTopic, allowedTopics)) {
    incrementCounter("webhooks_rejected_topic");
    logWarn("Webhook rejected due to disallowed or mismatched topic", {
      topic,
      expected_topic: expectedTopic,
      shop
    });
    res.status(400).json({ error: "Disallowed or mismatched webhook topic" });
    return;
  }

  if (!verifyShopifyWebhookHmac(rawBody, hmacHeader, env.SHOPIFY_WEBHOOK_SECRET)) {
    incrementCounter("webhooks_invalid_signature");
    logWarn("Webhook rejected due to invalid signature", { topic, shop });
    res.status(401).json({ error: "Invalid Shopify webhook signature" });
    return;
  }

  let order: ShopifyOrder;
  try {
    order = JSON.parse(rawBody.toString("utf8")) as ShopifyOrder;
  } catch {
    incrementCounter("webhooks_invalid_json");
    logWarn("Webhook rejected due to invalid JSON", { topic, shop });
    res.status(400).json({ error: "Invalid JSON payload" });
    return;
  }

  const idempotencyKey = buildIdempotencyKey(req, order);
  if (idempotencyStore.isDuplicate(idempotencyKey)) {
    incrementCounter("webhooks_duplicate_ignored");
    logInfo("Duplicate webhook ignored", { topic, shop, idempotency_key: idempotencyKey });
    res.status(200).json({ status: "duplicate_ignored" });
    return;
  }

  try {
    const eventId = resolveEventId({
      webhookId,
      shop,
      topic,
      orderNumber: order.order_number,
      orderName: order.name
    });

    const payload = mapOrderToPurchase(
      order,
      env.SHOP_DEFAULT_CURRENCY,
      eventId,
      env.CUSTOMER_ID_FALLBACK
    );

    if (env.RUNTIME_MODE === "shadow_compare") {
      await captureSynapseShadow(payload);
      idempotencyStore.markProcessed(idempotencyKey);
      incrementCounter("webhooks_shadow_captured");

      logInfo("Webhook captured in shadow_compare mode (no forwarding)", {
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
    incrementCounter("webhooks_forwarded");

    logInfo("Webhook processed and forwarded", {
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
    incrementCounter("webhooks_forward_failed");
    logError("Failed forwarding order webhook", {
      topic,
      shop,
      idempotency_key: idempotencyKey,
      error: (error as Error).message
    });
    res.status(502).json({ error: "Failed to forward event" });
  }
  };
}

router.post("/create", createOrderWebhookHandler("orders/create"));
router.post("/paid", createOrderWebhookHandler("orders/paid"));

export { router as webhooksRouter };
