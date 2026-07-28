/**
 * Edge-compatible Shopify webhook HMAC + purchase forward helpers.
 * Uses Web Crypto so it runs on Cloudflare Workers.
 */

import { attachSessionMarketing, extractSessionMarketing } from "./sessionEnrichment";
import type { ShopifyOrder, SynapseEventPayload } from "../types/shopify";

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

/** Deterministic event id without Node crypto (Workers-safe). */
export function resolveEdgeEventId(parts: Array<string | number | undefined>): string {
  const source = parts
    .map((part) => (part == null ? "" : String(part).trim()))
    .filter((part) => part.length > 0)
    .join("|");
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  let hash2 = 5381;
  for (let i = 0; i < source.length; i += 1) {
    hash2 = (hash2 * 33) ^ source.charCodeAt(i);
  }
  const hex2 = (hash2 >>> 0).toString(16).padStart(8, "0");
  return `${hex}${hex2}${hex}${hex2}`.slice(0, 32);
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
  GTM_FORWARD_SHARED_SECRET?: string;
  RUNTIME_MODE?: string;
  SHOP_DEFAULT_CURRENCY?: string;
};

export type EdgeWebhookResult = {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
};

/**
 * Full edge purchase webhook path:
 * HMAC verify → session marketing attach → shadow or forward to sGTM.
 */
export async function processPurchaseWebhookEdge(options: {
  env: EdgeWebhookEnv;
  rawBody: ArrayBuffer;
  hmacHeader: string | null;
  shop: string;
  topic: string;
  webhookId?: string | null;
}): Promise<EdgeWebhookResult> {
  const secret = options.env.SHOPIFY_WEBHOOK_SECRET || options.env.SHOPIFY_API_SECRET || "";
  const runtimeMode = (options.env.RUNTIME_MODE || "shadow_compare").toLowerCase();
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

  const eventId =
    options.webhookId ||
    resolveEdgeEventId([options.shop, options.topic, order.order_number, order.name]);
  const marketing = extractSessionMarketing(order);
  const base = mapOrderToPurchaseEdge(order, eventId, options.env.SHOP_DEFAULT_CURRENCY || "USD");
  const payload = attachSessionMarketing(base, marketing);

  if (runtimeMode === "shadow_compare" || runtimeMode === "shadow") {
    return {
      ok: true,
      status: 200,
      body: {
        ok: true,
        status: "shadow_captured_no_forward",
        topic: options.topic,
        shop: options.shop,
        event_id: payload.event_id,
        transaction_id: payload.transaction_id,
        session_attached: Boolean(marketing.session_id || marketing.landing_site),
        marketing,
        payload
      }
    };
  }

  const gtmUrl = options.env.GTM_SERVER_URL;
  if (!gtmUrl) {
    return {
      ok: true,
      status: 200,
      body: {
        ok: true,
        status: "accepted_no_gtm_url",
        topic: options.topic,
        shop: options.shop,
        event_id: payload.event_id,
        session_attached: Boolean(marketing.session_id || marketing.landing_site),
        marketing,
        payload
      }
    };
  }

  const forward = await forwardPurchaseToGtmEdge({
    gtmServerUrl: gtmUrl,
    payload: payload as unknown as Record<string, unknown>,
    ...(options.env.GTM_FORWARD_SHARED_SECRET
      ? { sharedSecret: options.env.GTM_FORWARD_SHARED_SECRET }
      : {})
  });

  return {
    ok: forward.ok,
    status: forward.ok ? 200 : 502,
    body: {
      ok: forward.ok,
      status: forward.ok ? "forwarded" : "forward_failed",
      topic: options.topic,
      shop: options.shop,
      event_id: payload.event_id,
      transaction_id: payload.transaction_id,
      session_attached: Boolean(marketing.session_id || marketing.landing_site),
      marketing,
      gtm_forward: { ok: forward.ok, status: forward.status, body: forward.body },
      payload
    }
  };
}
