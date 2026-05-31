import type { RuntimeEventDecision, SynapseEventName, SynapseRuntimeEvent } from "../types/synapse";

const AD_EVENT_NAMES = new Set<SynapseEventName>([
  "view_item",
  "view_item_list",
  "view_search_results",
  "add_to_cart",
  "remove_from_cart",
  "view_cart",
  "begin_checkout",
  "add_shipping_info",
  "add_payment_info",
  "purchase",
  "sign_up",
  "newsletter_signup"
]);

const BOT_VALUES = new Set([
  "bot",
  "confirmed_bot",
  "automation",
  "crawler"
]);

function isGranted(value: string | undefined): boolean {
  return (value ?? "unknown").toLowerCase() === "granted";
}

export function evaluateRuntimeEventPolicy(event: SynapseRuntimeEvent): RuntimeEventDecision {
  const visitorType = (event.customer.visitor_type ?? "").toLowerCase();

  if (BOT_VALUES.has(visitorType)) {
    return {
      allowed: false,
      reason: "suppressed_confirmed_bot"
    };
  }

  if (!isGranted(event.consent.analytics_storage)) {
    return {
      allowed: false,
      reason: "suppressed_analytics_consent"
    };
  }

  if (AD_EVENT_NAMES.has(event.event_name)) {
    const adStorageGranted = isGranted(event.consent.ad_storage);
    const adUserDataGranted = isGranted(event.consent.ad_user_data);
    const adPersonalizationGranted = isGranted(event.consent.ad_personalization);

    if (!adStorageGranted || !adUserDataGranted || !adPersonalizationGranted) {
      return {
        allowed: false,
        reason: "suppressed_marketing_consent"
      };
    }
  }

  return {
    allowed: true
  };
}
