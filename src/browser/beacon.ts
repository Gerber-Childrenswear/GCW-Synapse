import type { SynapseDataLayerEvent } from "./types";
import type { SynapseSession } from "./session";

export function sendBeacon(
  beaconUrl: string | undefined,
  shop: string,
  event: SynapseDataLayerEvent,
  session: SynapseSession
): void {
  if (!beaconUrl || typeof fetch === "undefined") return;

  const body = {
    source: "synapse-theme",
    shop,
    event: event.event,
    event_id: event.event_id,
    currency:
      typeof event.ecommerce?.currencyCode === "string"
        ? event.ecommerce.currencyCode
        : undefined,
    cart_total: event.cart_total,
    user_properties: event.user_properties,
    marketing: {
      landing_site: session.landing_site,
      session_id: session.session_id,
      utm_source: session.utm_source,
      utm_medium: session.utm_medium,
      utm_campaign: session.utm_campaign
    },
    ecommerce: event.ecommerce,
    observed_at: new Date().toISOString()
  };

  try {
    void fetch(beaconUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      mode: "cors",
      keepalive: true
    });
  } catch {
    // Non-blocking.
  }
}
