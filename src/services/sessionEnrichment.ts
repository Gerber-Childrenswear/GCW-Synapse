import type { ShopifyOrder, SynapseEventPayload } from "../types/shopify";

export type OrderNoteAttribute = {
  name?: string;
  value?: string;
};

export type SessionMarketing = {
  session_id?: string | undefined;
  landing_site?: string | undefined;
  utm_source?: string | undefined;
  utm_medium?: string | undefined;
  utm_campaign?: string | undefined;
};

function fromNoteAttributes(attrs: OrderNoteAttribute[] | undefined): SessionMarketing {
  if (!Array.isArray(attrs)) return {};
  const map = new Map<string, string>();
  for (const attr of attrs) {
    if (!attr?.name || attr.value == null) continue;
    map.set(String(attr.name).toLowerCase(), String(attr.value));
  }

  const marketing: SessionMarketing = {};
  const sessionId = map.get("synapse_session_id");
  const landing = map.get("synapse_landing_site") || map.get("landing_site");
  const utmSource = map.get("synapse_utm_source") || map.get("utm_source");
  const utmMedium = map.get("synapse_utm_medium") || map.get("utm_medium");
  const utmCampaign = map.get("synapse_utm_campaign") || map.get("utm_campaign");

  if (sessionId) marketing.session_id = sessionId;
  if (landing) marketing.landing_site = landing;
  if (utmSource) marketing.utm_source = utmSource;
  if (utmMedium) marketing.utm_medium = utmMedium;
  if (utmCampaign) marketing.utm_campaign = utmCampaign;
  return marketing;
}

export function extractSessionMarketing(order: ShopifyOrder & {
  note_attributes?: OrderNoteAttribute[] | undefined;
  landing_site?: string | undefined;
}): SessionMarketing {
  const fromNotes = fromNoteAttributes(order.note_attributes);
  if (!fromNotes.landing_site && order.landing_site) {
    fromNotes.landing_site = order.landing_site;
  }
  return fromNotes;
}

export function attachSessionMarketing(
  payload: SynapseEventPayload,
  marketing: SessionMarketing
): SynapseEventPayload {
  if (!marketing.session_id && !marketing.landing_site && !marketing.utm_source) {
    return payload;
  }

  return {
    ...payload,
    marketing: {
      session_id: marketing.session_id,
      landing_site: marketing.landing_site,
      utm_source: marketing.utm_source,
      utm_medium: marketing.utm_medium,
      utm_campaign: marketing.utm_campaign
    }
  };
}
