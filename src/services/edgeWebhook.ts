/**
 * Edge-compatible Shopify webhook HMAC + purchase forward helpers.
 * Uses Web Crypto so it runs on Cloudflare Workers.
 */

import {
  claimPurchaseForward,
  isCanonicalPurchaseTopic,
  isStrongPurchaseIdentity,
  releasePurchaseClaim,
  resolveCanonicalPurchaseTopic,
  resolvePurchaseIdentity
} from "./purchaseIdentity";
import { attachSessionMarketing, extractSessionMarketing } from "./sessionEnrichment";
import { resolveShopGtmServerUrl, resolveShopRuntimeMode } from "./shopRuntime";
import type { PurchaseClaim, PurchaseDedupeStore } from "./purchaseIdentity";
import type { ShopifyOrder, SynapseEventPayload } from "../types/shopify";

export { resolveEdgeEventId } from "./purchaseIdentity";

/**
 * Resolve the Shopify topic from the header and URL path. Fail closed when
 * neither is decisive, and reject header/path mismatches so a mis-registered
 * subscription cannot be promoted to the canonical topic by path fallback.
 */
export function resolveWebhookTopic(
  topicHeader: string | null | undefined,
  pathname: string
): { topic: string } | { error: "missing_topic" | "topic_path_mismatch"; header: string; path_topic: string } {
  const header = (topicHeader ?? "").trim().toLowerCase();
  const path = pathname.toLowerCase();

  let pathTopic = "";
  if (path.includes("refund")) {
    pathTopic = "refunds/create";
  } else if (path.includes("/orders/create") || /\/create\/?$/.test(path)) {
    pathTopic = "orders/create";
  } else if (path.includes("/orders/paid") || /\/paid\/?$/.test(path)) {
    pathTopic = "orders/paid";
  }

  if (header && pathTopic && header !== pathTopic) {
    return { error: "topic_path_mismatch", header, path_topic: pathTopic };
  }
  if (header) {
    return { topic: header };
  }
  if (pathTopic) {
    return { topic: pathTopic };
  }
  return { error: "missing_topic", header: "", path_topic: "" };
}

export async function verifyShopifyWebhookHmacEdge(
  rawBody: ArrayBuffer,
  hmacHeader: string | null | undefined,
  sharedSecret: string
): Promise<boolean> {
  if (!hmacHeader || !sharedSecret) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sharedSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, rawBody);
  const digestBytes = new Uint8Array(signature);
  let binary = "";
  for (const b of digestBytes) binary += String.fromCharCode(b);
  const digest = btoa(binary);

  if (digest.length !== hmacHeader.length) return false;
  let mismatch = 0;
  for (let i = 0; i < digest.length; i += 1) {
    mismatch |= digest.charCodeAt(i) ^ hmacHeader.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function createForwardHeadersEdge(
  payloadJson: string,
  payload: { event_name?: string; event_id?: string; transaction_id?: string },
  sharedSecret?: string
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (payload.event_name) headers["X-Synapse-Event-Name"] = String(payload.event_name);
  if (payload.event_id) headers["X-Synapse-Event-Id"] = String(payload.event_id);
  if (payload.transaction_id) {
    headers["X-Synapse-Transaction-Id"] = String(payload.transaction_id);
  }
  if (!sharedSecret) return headers;

  const timestamp = String(Math.floor(Date.now() / 1000));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sharedSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const material = new TextEncoder().encode(`${timestamp}.${payloadJson}`);
  const signature = await crypto.subtle.sign("HMAC", key, material);
  const digestBytes = new Uint8Array(signature);
  let hex = "";
  for (const b of digestBytes) hex += b.toString(16).padStart(2, "0");
  headers["X-Synapse-Timestamp"] = timestamp;
  headers["X-Synapse-Signature"] = hex;
  return headers;
}

export async function forwardPurchaseToGtmEdge(options: {
  gtmServerUrl: string;
  payload: Record<string, unknown>;
  sharedSecret?: string;
}): Promise<{ ok: boolean; status: number; body: string }> {
  const payloadJson = JSON.stringify(options.payload);
  const headerInput: { event_name?: string; event_id?: string; transaction_id?: string } = {};
  if (typeof options.payload.event_name === "string") headerInput.event_name = options.payload.event_name;
  if (typeof options.payload.event_id === "string") headerInput.event_id = options.payload.event_id;
  if (typeof options.payload.transaction_id === "string") {
    headerInput.transaction_id = options.payload.transaction_id;
  }
  const headers = await createForwardHeadersEdge(payloadJson, headerInput, options.sharedSecret);

  const response = await fetch(options.gtmServerUrl, {
    method: "POST",
    headers,
    body: payloadJson
  });
  const body = await response.text();
  return { ok: response.ok, status: response.status, body: body.slice(0, 500) };
}

function toNumber(value: unknown): number {
  const parsed = Number.parseFloat(String(value ?? "0"));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Minimal purchase mapper for edge (avoids Node-only deps). */
export function mapOrderToPurchaseEdge(
  order: ShopifyOrder,
  eventId: string,
  defaultCurrency = "USD"
): SynapseEventPayload {
  const currency = String(order.currency || defaultCurrency);
  const customerEmail = order.customer?.email || order.email || undefined;
  const customerId = order.customer?.id != null ? String(order.customer.id) : "guest";
  const items = Array.isArray(order.line_items)
    ? order.line_items.map((item, index) => ({
        item_id: String(item.sku || item.variant_id || item.product_id || index),
        item_name: String(item.title || ""),
        item_variant: item.variant_title ? String(item.variant_title) : undefined,
        item_category: item.product_type ? String(item.product_type) : undefined,
        price: toNumber(item.price),
        quantity: Number(item.quantity || 1),
        product_id: item.product_id != null ? String(item.product_id) : undefined,
        sku: item.sku ? String(item.sku) : undefined
      }))
    : [];

  return {
    client_id: customerId,
    user_id: customerEmail,
    event_id: eventId,
    event_name: "purchase",
    currency,
    value: toNumber(order.total_price),
    tax: toNumber(order.total_tax),
    shipping: toNumber(order.total_shipping_price_set?.shop_money?.amount),
    transaction_id: String(order.name || order.order_number || "unknown"),
    items,
    user_data: {
      email_address: customerEmail,
      phone_number: order.phone || undefined,
      address: {
        first_name: order.customer?.first_name ?? order.billing_address?.first_name,
        last_name: order.customer?.last_name ?? order.billing_address?.last_name,
        city: order.billing_address?.city,
        region: order.billing_address?.province_code,
        postal_code: order.billing_address?.zip,
        country: order.billing_address?.country_code
      }
    }
  };
}

export type EdgeWebhookEnv = {
  SHOPIFY_WEBHOOK_SECRET?: string;
  SHOPIFY_API_SECRET?: string;
  GTM_SERVER_URL?: string;
  GTM_SERVER_URL_BY_SHOP?: string;
  GTM_FORWARD_SHARED_SECRET?: string;
  RUNTIME_MODE?: string;
  SHOP_RUNTIME_MODES?: string;
  SHOP_DEFAULT_CURRENCY?: string;
  PURCHASE_CANONICAL_TOPIC?: string;
};

export type EdgeWebhookResult = {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
};

/**
 * Statuses where the purchase was accepted but deliberately not forwarded.
 * The Worker uses this to keep suppressed deliveries out of parity/forward
 * counters instead of scoring them as real conversions.
 */
export const PURCHASE_NO_FORWARD_STATUSES = new Set([
  "non_canonical_topic_no_forward",
  "missing_order_identity_no_forward",
  "weak_order_identity_no_forward",
  "duplicate_purchase_no_forward",
  "dedupe_unavailable_no_forward",
  "dedupe_error_no_forward"
]);

/**
 * Full edge purchase webhook path: HMAC verify → stable order identity →
 * canonical-topic gate → per-shop mode → forward-once claim → forward to sGTM.
 *
 * Everything after the identity step is a reason not to forward. Each reason has
 * its own greppable status so a suppressed delivery is never confused with a
 * conversion.
 */
export async function processPurchaseWebhookEdge(options: {
  env: EdgeWebhookEnv;
  rawBody: ArrayBuffer;
  hmacHeader: string | null;
  shop: string;
  topic: string;
  webhookId?: string | null;
  /** KV namespace used for per-order forward-once claims (SYNAPSE_STATE in the Worker). */
  dedupeStore?: PurchaseDedupeStore | undefined;
}): Promise<EdgeWebhookResult> {
  const secret = options.env.SHOPIFY_WEBHOOK_SECRET || options.env.SHOPIFY_API_SECRET || "";
  // Per-shop and default-deny: an unmapped shop never forwards, whatever the global mode says.
  const runtimeMode = resolveShopRuntimeMode(options.shop, options.env);
  // Always fail closed — unsigned webhooks must never be accepted in any mode.
  if (!secret) {
    return { ok: false, status: 401, body: { ok: false, error: "webhook_secret_not_configured" } };
  }
  const valid = await verifyShopifyWebhookHmacEdge(options.rawBody, options.hmacHeader, secret);
  if (!valid) {
    return { ok: false, status: 401, body: { ok: false, error: "invalid_hmac" } };
  }

  let order: ShopifyOrder;
  try {
    const text = new TextDecoder().decode(options.rawBody);
    order = JSON.parse(text) as ShopifyOrder;
  } catch {
    return { ok: false, status: 400, body: { ok: false, error: "invalid_json" } };
  }

  // Identity comes from the order alone, so both topics and every Shopify retry
  // of either topic produce one event_id and one dedupe key.
  const identity = resolvePurchaseIdentity(options.shop, order);
  const canonicalTopic = resolveCanonicalPurchaseTopic(options.env);
  const marketing = extractSessionMarketing(order);
  const base = mapOrderToPurchaseEdge(
    order,
    identity.event_id,
    options.env.SHOP_DEFAULT_CURRENCY || "USD"
  );
  const payload = attachSessionMarketing(base, marketing);

  const baseBody = {
    runtime_mode: runtimeMode,
    topic: options.topic,
    canonical_topic: canonicalTopic,
    shop: options.shop,
    event_id: payload.event_id,
    transaction_id: payload.transaction_id,
    order_key: identity.order_key,
    order_key_source: identity.order_key_source,
    idempotency_key: identity.idempotency_key,
    session_attached: Boolean(marketing.session_id || marketing.landing_site),
    marketing
  };

  // The non-canonical topic still gets a 2xx so Shopify keeps the subscription
  // alive and stops retrying, but it never reaches a destination.
  if (!isCanonicalPurchaseTopic(options.topic, options.env)) {
    return {
      ok: true,
      status: 200,
      body: { ok: true, status: "non_canonical_topic_no_forward", ...baseBody, payload }
    };
  }

  if (runtimeMode === "shadow") {
    return {
      ok: true,
      status: 200,
      body: { ok: true, status: "shadow_captured_no_forward", ...baseBody, payload }
    };
  }

  // Without a stable order key the dedupe key would collide across orders, so
  // forwarding would either double-count or suppress unrelated purchases.
  if (identity.order_key_source === "none") {
    return {
      ok: true,
      status: 200,
      body: { ok: true, status: "missing_order_identity_no_forward", ...baseBody, payload }
    };
  }

  // order_number / name alone are not strong enough to authorize a forward.
  if (!isStrongPurchaseIdentity(identity)) {
    return {
      ok: true,
      status: 200,
      body: { ok: true, status: "weak_order_identity_no_forward", ...baseBody, payload }
    };
  }

  const gtmUrl = resolveShopGtmServerUrl(options.shop, options.env);
  if (!gtmUrl) {
    return {
      ok: true,
      status: 200,
      body: { ok: true, status: "accepted_no_gtm_url", ...baseBody, payload }
    };
  }

  const claim = await claimPurchaseForward({
    store: options.dedupeStore,
    key: identity.idempotency_key,
    eventId: identity.event_id,
    topic: options.topic,
    webhookId: options.webhookId
  });

  if (claim.status === "duplicate") {
    return {
      ok: true,
      status: 200,
      body: {
        ok: true,
        status: "duplicate_purchase_no_forward",
        ...baseBody,
        dedupe: claim,
        payload
      }
    };
  }

  // Fail closed: an unproven first delivery is exactly the double-count this
  // path exists to prevent. 503 keeps the delivery retryable rather than lost.
  if (claim.status !== "claimed") {
    const status =
      claim.status === "unavailable" ? "dedupe_unavailable_no_forward" : "dedupe_error_no_forward";
    return {
      ok: false,
      status: 503,
      body: { ok: false, status, ...baseBody, dedupe: claim, payload }
    };
  }

  const forward = await forwardPurchaseToGtmEdge({
    gtmServerUrl: gtmUrl,
    payload: payload as unknown as Record<string, unknown>,
    ...(options.env.GTM_FORWARD_SHARED_SECRET
      ? { sharedSecret: options.env.GTM_FORWARD_SHARED_SECRET }
      : {})
  });

  // A failed forward must not burn the order's only claim, or the Shopify retry
  // would be dropped as a duplicate and the conversion lost for the whole TTL.
  const dedupe: PurchaseClaim & { released?: boolean; release_error?: string } = { ...claim };
  if (!forward.ok) {
    const release = await releasePurchaseClaim(options.dedupeStore, identity.idempotency_key);
    dedupe.released = release.released;
    if (release.error) dedupe.release_error = release.error;
  }

  return {
    ok: forward.ok,
    status: forward.ok ? 200 : 502,
    body: {
      ok: forward.ok,
      status: forward.ok ? "forwarded" : "forward_failed",
      ...baseBody,
      dedupe,
      gtm_forward: { ok: forward.ok, status: forward.status, body: forward.body },
      payload
    }
  };
}
