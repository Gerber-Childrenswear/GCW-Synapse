import { resolveBrowserEventId } from "./eventId";
import type { SynapseDataLayerEvent } from "./types";

function ensureArrays(): void {
  window.dataLayer = window.dataLayer || [];
  window.SynapseDataLayer = window.SynapseDataLayer || [];
}

export function pushDataLayerEvent(
  event: SynapseDataLayerEvent,
  options?: { shop?: string; debug?: boolean }
): SynapseDataLayerEvent {
  ensureArrays();

  const withId: SynapseDataLayerEvent = {
    ...event,
    event_id:
      event.event_id ??
      resolveBrowserEventId([
        options?.shop,
        event.event,
        typeof location !== "undefined" ? location.pathname : "",
        Date.now()
      ])
  };

  // Elevar-compatible shape on the GTM dataLayer.
  // `_synapse` lets the dual-run mirror ignore our own pushes when scoring Elevar.
  window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push({ ...withId, _synapse: true });
  window.SynapseDataLayer.push({ ...withId });

  if (options?.debug) {
    // eslint-disable-next-line no-console
    console.info("[Synapse]", withId.event, withId);
  }

  return withId;
}
