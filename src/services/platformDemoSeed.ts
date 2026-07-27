/**
 * Demo channel pulses for Platforms matrix.
 * Default scenario is healthy (all monitored platforms green).
 * Use scenario=broken to exercise diagnostics (token failures, orphan dedupe).
 */

export type DemoSeedScenario = "healthy" | "broken";

export type DemoSample = {
  channel: string;
  surface: "pixel" | "server" | "runtime" | "webhook";
  destination: string;
  event_name: string;
  status: "ok" | "error";
  pixel_id?: string;
  event_id?: string;
  transaction_id?: string;
  error_message?: string;
  minutesAgo: number;
};

function pair(
  channel: string,
  browserDest: string,
  serverDest: string,
  eventName: string,
  eventId: string,
  minutesAgo: number,
  extras?: { pixel_id?: string; transaction_id?: string }
): DemoSample[] {
  const shared: DemoSample = {
    channel,
    surface: "pixel",
    destination: browserDest,
    event_name: eventName,
    status: "ok",
    event_id: eventId,
    minutesAgo
  };
  if (extras?.pixel_id) shared.pixel_id = extras.pixel_id;
  if (extras?.transaction_id) shared.transaction_id = extras.transaction_id;

  const server: DemoSample = {
    ...shared,
    surface: "server",
    destination: serverDest
  };
  return [shared, server];
}

/** Full green seed — Meta/TikTok/Pinterest/etc with confirmed dedupe. */
export function buildHealthyDemoSamples(): DemoSample[] {
  const orderId = "GCW-10042";
  return [
    // Meta — full expected funnel, confirmed event_id dedupe
    ...pair("meta", "Meta Pixel", "Meta CAPI", "PageView", "meta_pv_1", 2, {
      pixel_id: "823006016363458"
    }),
    ...pair("meta", "Meta Pixel", "Meta CAPI", "ViewContent", "meta_vc_1", 4, {
      pixel_id: "823006016363458"
    }),
    ...pair("meta", "Meta Pixel", "Meta CAPI", "AddToCart", "meta_atc_1", 5, {
      pixel_id: "823006016363458"
    }),
    ...pair("meta", "Meta Pixel", "Meta CAPI", "InitiateCheckout", "meta_ic_1", 7, {
      pixel_id: "823006016363458"
    }),
    ...pair("meta", "Meta Pixel", "Meta CAPI", "Purchase", "meta_pur_1", 8, {
      pixel_id: "823006016363458",
      transaction_id: orderId
    }),

    // TikTok — Pixel + Events API share event_id
    ...pair("tiktok", "TikTok Pixel", "TikTok Events API", "Pageview", "tt_pv_1", 2, {
      pixel_id: "COUGEIBC77UF83EUUA6G"
    }),
    ...pair("tiktok", "TikTok Pixel", "TikTok Events API", "ViewContent", "tt_vc_1", 4, {
      pixel_id: "COUGEIBC77UF83EUUA6G"
    }),
    ...pair("tiktok", "TikTok Pixel", "TikTok Events API", "AddToCart", "tt_atc_1", 5, {
      pixel_id: "COUGEIBC77UF83EUUA6G"
    }),
    ...pair(
      "tiktok",
      "TikTok Pixel",
      "TikTok Events API",
      "InitiateCheckout",
      "tt_ic_1",
      7,
      { pixel_id: "COUGEIBC77UF83EUUA6G" }
    ),
    ...pair(
      "tiktok",
      "TikTok Pixel",
      "TikTok Events API",
      "CompletePayment",
      "tt_cp_1",
      8,
      { pixel_id: "COUGEIBC77UF83EUUA6G", transaction_id: orderId }
    ),

    // Pinterest
    ...pair("pinterest", "Pinterest Tag", "Pinterest CAPI", "page_visit", "pin_pv_1", 3, {
      pixel_id: "2612527712746"
    }),
    ...pair("pinterest", "Pinterest Tag", "Pinterest CAPI", "view_category", "pin_vc_1", 4, {
      pixel_id: "2612527712746"
    }),
    ...pair("pinterest", "Pinterest Tag", "Pinterest CAPI", "add_to_cart", "pin_atc_1", 5, {
      pixel_id: "2612527712746"
    }),
    ...pair("pinterest", "Pinterest Tag", "Pinterest CAPI", "checkout", "pin_chk_1", 9, {
      pixel_id: "2612527712746",
      transaction_id: orderId
    }),

    // Reddit
    ...pair("reddit", "Reddit Pixel", "Reddit CAPI", "PageVisit", "rd_pv_1", 3, {
      pixel_id: "a2_iql6tlstlbj4"
    }),
    ...pair("reddit", "Reddit Pixel", "Reddit CAPI", "ViewContent", "rd_vc_1", 4, {
      pixel_id: "a2_iql6tlstlbj4"
    }),
    ...pair("reddit", "Reddit Pixel", "Reddit CAPI", "AddToCart", "rd_atc_1", 5, {
      pixel_id: "a2_iql6tlstlbj4"
    }),
    ...pair("reddit", "Reddit Pixel", "Reddit CAPI", "Purchase", "rd_pur_1", 8, {
      pixel_id: "a2_iql6tlstlbj4",
      transaction_id: orderId
    }),

    // GA4 — transaction_id aligned on purchase
    ...pair("ga4", "GA4 Browser", "GA4 MP", "page_view", "ga4_pv_1", 1),
    ...pair("ga4", "GA4 Browser", "GA4 MP", "view_item", "ga4_vi_1", 3),
    ...pair("ga4", "GA4 Browser", "GA4 MP", "add_to_cart", "ga4_atc_1", 5),
    ...pair("ga4", "GA4 Browser", "GA4 MP", "begin_checkout", "ga4_bc_1", 7),
    ...pair("ga4", "GA4 Browser", "GA4 MP", "purchase", "ga4_pur_1", 9, {
      transaction_id: orderId
    }),

    // Google Ads
    ...pair("google_ads", "Google Ads Tag", "Enhanced Conv", "page_view", "gads_pv_1", 2),
    ...pair("google_ads", "Google Ads Tag", "Enhanced Conv", "add_to_cart", "gads_atc_1", 5),
    ...pair("google_ads", "Google Ads Tag", "Enhanced Conv", "begin_checkout", "gads_bc_1", 7),
    ...pair("google_ads", "Google Ads Tag", "Enhanced Conv", "purchase", "gads_pur_1", 10, {
      transaction_id: orderId
    }),

    // Bloomreach — browser GTM + server track
    ...pair("bloomreach", "Bloomreach GTM", "Bloomreach Engagement", "view_item", "br_vi_1", 4),
    ...pair("bloomreach", "Bloomreach GTM", "Bloomreach Engagement", "cart_update", "br_cu_1", 6),
    ...pair("bloomreach", "Bloomreach GTM", "Bloomreach Engagement", "consent", "br_co_1", 3),
    ...pair("bloomreach", "Bloomreach GTM", "Bloomreach Engagement", "purchase", "br_pur_1", 12, {
      transaction_id: orderId
    }),

    // CJ — server-primary affiliate confirmation (browser pulse optional mirror for parity UI)
    {
      channel: "cj",
      surface: "server",
      destination: "CJ AffNet",
      event_name: "purchase",
      status: "ok",
      transaction_id: orderId,
      event_id: "cj_pur_1",
      minutesAgo: 15
    },
    {
      channel: "cj",
      surface: "pixel",
      destination: "CJ browser mirror",
      event_name: "purchase",
      status: "ok",
      transaction_id: orderId,
      event_id: "cj_pur_1",
      minutesAgo: 15
    },

    // Pipe
    {
      channel: "server_gtm",
      surface: "server",
      destination: "sGTM N45F3JCC",
      event_name: "purchase",
      status: "ok",
      transaction_id: orderId,
      event_id: "sgtm_pur_1",
      minutesAgo: 8
    },
    {
      channel: "server_gtm",
      surface: "pixel",
      destination: "gtm-browser-bridge",
      event_name: "page_view",
      status: "ok",
      event_id: "sgtm_pv_1",
      minutesAgo: 1
    },
    {
      channel: "synapse",
      surface: "runtime",
      destination: "Worker /event",
      event_name: "dl_purchase",
      status: "ok",
      transaction_id: orderId,
      event_id: "syn_pur_1",
      minutesAgo: 8
    },
    {
      channel: "synapse",
      surface: "runtime",
      destination: "Worker /browser/beacon",
      event_name: "dl_view_item",
      status: "ok",
      event_id: "syn_vi_1",
      minutesAgo: 4
    },
    {
      channel: "synapse",
      surface: "runtime",
      destination: "Worker /browser/beacon",
      event_name: "dl_add_to_cart",
      status: "ok",
      event_id: "syn_atc_1",
      minutesAgo: 5
    },
    {
      channel: "synapse",
      surface: "runtime",
      destination: "Worker /browser/beacon",
      event_name: "dl_begin_checkout",
      status: "ok",
      event_id: "syn_bc_1",
      minutesAgo: 7
    },
    {
      channel: "synapse",
      surface: "runtime",
      destination: "Worker /browser/beacon",
      event_name: "dl_user_data",
      status: "ok",
      event_id: "syn_ud_1",
      minutesAgo: 2
    }
  ];
}

/** Intentionally broken samples for diagnostics QA. */
export function buildBrokenDemoSamples(): DemoSample[] {
  return [
    { channel: "meta", surface: "pixel", destination: "Meta Pixel", event_name: "PageView", status: "ok", pixel_id: "demo-meta", event_id: "meta_pv_1", minutesAgo: 2 },
    { channel: "meta", surface: "server", destination: "Meta CAPI", event_name: "PageView", status: "ok", event_id: "meta_pv_1", minutesAgo: 2 },
    { channel: "meta", surface: "pixel", destination: "Meta Pixel", event_name: "AddToCart", status: "ok", pixel_id: "demo-meta", event_id: "meta_atc_orphan", minutesAgo: 5 },
    { channel: "tiktok", surface: "pixel", destination: "TikTok Pixel", event_name: "ViewContent", status: "ok", event_id: "tt_vc_browser", minutesAgo: 6 },
    {
      channel: "tiktok",
      surface: "server",
      destination: "TikTok Events API",
      event_name: "ViewContent",
      status: "error",
      event_id: "tt_vc_server_other",
      error_message: "access_token_invalid: Events API access token is invalid",
      minutesAgo: 6
    },
    { channel: "bloomreach", surface: "server", destination: "Bloomreach Engagement", event_name: "purchase", status: "ok", transaction_id: "GCW-10042", minutesAgo: 12 },
    { channel: "cj", surface: "server", destination: "CJ AffNet", event_name: "purchase", status: "ok", transaction_id: "GCW-10042", minutesAgo: 15 }
  ];
}

export function resolveDemoSeedScenario(raw: string | null | undefined): DemoSeedScenario {
  const normalized = (raw ?? "healthy").trim().toLowerCase();
  return normalized === "broken" || normalized === "critical" || normalized === "fail" ? "broken" : "healthy";
}

export function buildDemoSamples(scenario: DemoSeedScenario): DemoSample[] {
  return scenario === "broken" ? buildBrokenDemoSamples() : buildHealthyDemoSamples();
}
