import type { SynapseConfig } from "./types";

const DL_PREFIX = "dl_";

function elevarMirrorUrl(beaconUrl: string | undefined): string | null {
  if (!beaconUrl) return null;
  try {
    const url = new URL(beaconUrl);
    // Reuse beacon endpoint with source=elevar (CORS already allowlisted).
    return url.toString();
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
  row: Record<string, unknown> & { event: string }
): void {
  const ecommerce = row.ecommerce;
  const currency =
    ecommerce && typeof ecommerce === "object" && typeof (ecommerce as { currencyCode?: unknown }).currencyCode === "string"
      ? (ecommerce as { currencyCode: string }).currencyCode
      : undefined;

  const body = JSON.stringify({
    source: "elevar-datalayer",
    shop,
    event: row.event,
    event_id: typeof row.event_id === "string" ? row.event_id : undefined,
    currency,
    cart_total: typeof row.cart_total === "string" ? row.cart_total : undefined,
    ecommerce,
    observed_at: new Date().toISOString()
  });

  try {
    if (typeof fetch !== "undefined") {
      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        mode: "cors",
        keepalive: true,
        credentials: "omit"
      });
    }
  } catch {
    // Non-blocking.
  }
}

/**
 * Dual-run: watch dataLayer for Elevar (non-Synapse) `dl_*` pushes and mirror
 * them to the Worker so /compare/browser can score Synapse vs Elevar side by side.
 */
export function attachElevarMirror(config: SynapseConfig): void {
  if (typeof window === "undefined") return;
  const mirrorUrl = elevarMirrorUrl(config.beaconUrl);
  if (!mirrorUrl) return;

  window.dataLayer = window.dataLayer || [];
  const dl = window.dataLayer;

  const handle = (item: unknown): void => {
    if (!isDlEvent(item)) return;
    // Synapse marks its own pushes; everything else with dl_* is treated as Elevar (or legacy).
    if (item._synapse === true) return;
    postElevarMirror(mirrorUrl, config.shop, item);
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
