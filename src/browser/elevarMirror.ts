import type { SynapseConfig } from "./types";

const DL_PREFIX = "dl_";
const MIRROR_FLAG = "__synapseElevarMirrorAttached";

const ALLOWED = new Set([
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

function elevarMirrorUrl(beaconUrl: string | undefined): string | null {
  if (!beaconUrl) return null;
  try {
    return new URL(beaconUrl).toString();
  } catch {
    return null;
  }
}

function isDlEvent(value: unknown): value is Record<string, unknown> & { event: string } {
  if (!value || typeof value !== "object") return false;
  const event = (value as { event?: unknown }).event;
  return typeof event === "string" && event.startsWith(DL_PREFIX);
}

function postElevarMirror(
  url: string,
  shop: string,
  row: Record<string, unknown> & { event: string },
  seen: Set<string>
): void {
  if (!ALLOWED.has(row.event)) return;

  const eventId = typeof row.event_id === "string" ? row.event_id.trim() : "";
  const dedupe = eventId
    ? `${row.event}:${eventId}`
    : `${row.event}:${typeof row.cart_total === "string" ? row.cart_total : ""}:${Date.now().toString().slice(0, -4)}`;
  if (seen.has(dedupe)) return;
  seen.add(dedupe);
  if (seen.size > 500) {
    const first = seen.values().next().value;
    if (first != null) seen.delete(first);
  }

  const ecommerce = row.ecommerce;
  const currency =
    ecommerce && typeof ecommerce === "object"
      ? typeof (ecommerce as { currencyCode?: unknown }).currencyCode === "string"
        ? (ecommerce as { currencyCode: string }).currencyCode
        : typeof (ecommerce as { currency?: unknown }).currency === "string"
          ? (ecommerce as { currency: string }).currency
          : undefined
      : undefined;

  const body = JSON.stringify({
    source: "elevar-datalayer",
    shop,
    event: row.event,
    event_id: eventId || undefined,
    currency,
    cart_total: typeof row.cart_total === "string" ? row.cart_total : undefined,
    ecommerce,
    observed_at: new Date().toISOString()
  });

  const send = (attempt: number): void => {
    try {
      if (typeof fetch === "undefined") return;
      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        mode: "cors",
        keepalive: true,
        credentials: "omit"
      }).then((res) => {
        if (!res.ok && attempt < 1) {
          setTimeout(() => send(attempt + 1), 250);
        }
      }).catch(() => {
        if (attempt < 1) setTimeout(() => send(attempt + 1), 250);
      });
    } catch {
      // Non-blocking.
    }
  };
  send(0);
}

/**
 * Dual-run: watch dataLayer for Elevar (non-Synapse) `dl_*` pushes and mirror
 * them to the Worker so /compare/browser can score Synapse vs Elevar side by side.
 */
export function attachElevarMirror(config: SynapseConfig): void {
  if (typeof window === "undefined") return;
  const mirrorUrl = elevarMirrorUrl(config.beaconUrl);
  if (!mirrorUrl) return;

  const w = window as Window & { [MIRROR_FLAG]?: boolean };
  if (w[MIRROR_FLAG]) return;
  w[MIRROR_FLAG] = true;

  window.dataLayer = window.dataLayer || [];
  const dl = window.dataLayer;
  const seen = new Set<string>();

  const handle = (item: unknown): void => {
    if (!isDlEvent(item)) return;
    // Synapse marks its own pushes; everything else with dl_* is treated as Elevar (or legacy).
    if (item._synapse === true) return;
    postElevarMirror(mirrorUrl, config.shop, item, seen);
  };

  // Catch events already on the layer (Elevar often boots before us).
  for (const item of dl) {
    handle(item);
  }

  const originalPush = dl.push.bind(dl);
  dl.push = (...args: unknown[]) => {
    for (const arg of args) {
      handle(arg);
    }
    return originalPush(...(args as Parameters<typeof dl.push>));
  };

  if (config.debug) {
    // eslint-disable-next-line no-console
    console.info("[Synapse] Elevar dual-run mirror attached", mirrorUrl);
  }
}
