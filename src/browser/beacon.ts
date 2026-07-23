import type { SynapseDataLayerEvent } from "./types";
import type { SynapseSession } from "./session";

/** High-value + core browse events always mirror to the Worker when a beacon URL is set. */
const ALWAYS_BEACON = new Set([
  "dl_user_data",
  "dl_view_item",
  "dl_view_item_list",
  "dl_view_search_results",
  "dl_select_item",
  "dl_add_to_cart",
  "dl_remove_from_cart",
  "dl_view_cart",
  "dl_begin_checkout",
  "dl_add_shipping_info",
  "dl_add_payment_info",
  "dl_purchase",
  "dl_sign_up",
  "dl_login",
  "dl_subscribe"
]);

const recentBeaconIds = new Map<string, number>();

function shouldBeacon(eventName: string, sampleRate: number): boolean {
  if (ALWAYS_BEACON.has(eventName)) return true;
  if (sampleRate >= 1) return true;
  if (sampleRate <= 0) return false;
  return Math.random() < sampleRate;
}

/** Strip heavy fields from ecommerce before network — GTM already has full dataLayer. */
function leanEcommerce(ecommerce: unknown): unknown {
  if (!ecommerce || typeof ecommerce !== "object") return ecommerce;
  const root = ecommerce as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(root)) {
    if (key === "currencyCode" || key === "currency") {
      out[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      out[key] = value.slice(0, 12).map(leanProduct);
      continue;
    }
    if (value && typeof value === "object") {
      const nested = value as Record<string, unknown>;
      const copy: Record<string, unknown> = {};
      for (const [nk, nv] of Object.entries(nested)) {
        if (nk === "products" && Array.isArray(nv)) {
          copy[nk] = nv.slice(0, 12).map(leanProduct);
        } else if (nk !== "image" && nk !== "url") {
          copy[nk] = nv;
        }
      }
      out[key] = copy;
      continue;
    }
    out[key] = value;
  }
  return out;
}

function leanProduct(item: unknown): unknown {
  if (!item || typeof item !== "object") return item;
  const row = item as Record<string, unknown>;
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    quantity: row.quantity,
    product_id: row.product_id,
    variant_id: row.variant_id,
    position: row.position
  };
}

function rememberBeaconId(eventId: string | undefined): boolean {
  if (!eventId) return true;
  const now = Date.now();
  const prev = recentBeaconIds.get(eventId);
  if (prev != null && now - prev < 5000) return false;
  recentBeaconIds.set(eventId, now);
  if (recentBeaconIds.size > 300) {
    for (const [id, ts] of recentBeaconIds) {
      if (now - ts > 30_000) recentBeaconIds.delete(id);
    }
  }
  return true;
}

function postWithRetry(beaconUrl: string, body: string, attempt: number): void {
  void fetch(beaconUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    mode: "cors",
    keepalive: true,
    credentials: "omit"
  })
    .then((res) => {
      // Retry once on transient 429/5xx for core funnel beacons.
      if ((res.status === 429 || res.status >= 500) && attempt < 1) {
        setTimeout(() => postWithRetry(beaconUrl, body, attempt + 1), 400);
      }
    })
    .catch(() => {
      if (attempt < 1) setTimeout(() => postWithRetry(beaconUrl, body, attempt + 1), 400);
    });
}

export function sendBeacon(
  beaconUrl: string | undefined,
  shop: string,
  event: SynapseDataLayerEvent,
  session: SynapseSession,
  sampleRate = 1
): void {
  if (!beaconUrl) return;
  if (typeof fetch === "undefined" && typeof navigator === "undefined") return;
  if (!shouldBeacon(event.event, sampleRate)) return;
  if (!rememberBeaconId(event.event_id)) return;

  const body = JSON.stringify({
    source: "synapse-theme",
    shop,
    event: event.event,
    event_id: event.event_id,
    currency:
      typeof event.ecommerce?.currencyCode === "string"
        ? event.ecommerce.currencyCode
        : undefined,
    cart_total: event.cart_total,
    marketing: {
      session_id: session.session_id,
      landing_site: session.landing_site,
      utm_source: session.utm_source,
      utm_medium: session.utm_medium,
      utm_campaign: session.utm_campaign
    },
    ecommerce: leanEcommerce(event.ecommerce),
    observed_at: new Date().toISOString()
  });

  try {
    // Prefer fetch+keepalive: sendBeacon with application/json blobs is unreliable
    // across browsers/CORS and hides failures from ops.
    if (typeof fetch !== "undefined") {
      postWithRetry(beaconUrl, body, 0);
      return;
    }

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "text/plain;charset=UTF-8" });
      navigator.sendBeacon(beaconUrl, blob);
    }
  } catch {
    // Non-blocking by design.
  }
}
