import {
  getChannelHealthSummary,
  getChannelHelpLinks,
  getChannelTroubleshooting,
  getRecentChannelEvents,
  type ChannelHealthItem,
  type ChannelHealthSummary,
  type TroubleshootingIssue
} from "./channelHealth";

export type SurfacePulse = {
  status: "firing" | "silent" | "error" | "idle";
  total_events: number;
  error_events: number;
  failure_rate_pct: number;
  last_event_at: string | null;
  minutes_since_last_event: number | null;
  event_counts: Record<string, number>;
  destinations: string[];
};

export type PlatformRow = {
  id: string;
  label: string;
  browser: SurfacePulse;
  server: SurfacePulse;
  match_pct: number | null;
  paired_events: number;
  status: "healthy" | "warning" | "critical" | "idle";
  expected_events: string[];
  docs: string[];
  issues: TroubleshootingIssue[];
  tips: string[];
};

export type PlatformMatrix = {
  generated_at: string;
  totals: {
    platforms: number;
    healthy: number;
    warning: number;
    critical: number;
    idle: number;
    avg_match_pct: number | null;
  };
  platforms: PlatformRow[];
  troubleshooting: TroubleshootingIssue[];
  links: Record<string, string[]>;
};

type PlatformDefinition = {
  id: string;
  label: string;
  aliases: string[];
  expected_events: string[];
  tips: string[];
};

const PLATFORM_DEFS: PlatformDefinition[] = [
  {
    id: "meta",
    label: "Meta (Facebook)",
    aliases: ["meta", "facebook", "fb"],
    expected_events: ["PageView", "ViewContent", "AddToCart", "InitiateCheckout", "Purchase"],
    tips: [
      "Browser Pixel and Conversions API should share the same event_id for dedupe.",
      "Confirm Advanced Matching fields (email/phone) when consent allows."
    ]
  },
  {
    id: "ga4",
    label: "Google Analytics 4",
    aliases: ["ga4", "google_analytics", "analytics"],
    expected_events: ["page_view", "view_item", "add_to_cart", "begin_checkout", "purchase"],
    tips: [
      "Compare browser GA4 hits vs Measurement Protocol / sGTM purchase.",
      "transaction_id must match between client and server purchase."
    ]
  },
  {
    id: "google_ads",
    label: "Google Ads",
    aliases: ["google_ads", "google-ads", "aw", "google"],
    expected_events: ["page_view", "add_to_cart", "begin_checkout", "purchase"],
    tips: [
      "Enhanced conversions need hashed PII consistency across browser and server.",
      "Check conversion label mapping in sGTM after Synapse cutover."
    ]
  },
  {
    id: "tiktok",
    label: "TikTok",
    aliases: ["tiktok", "tt"],
    expected_events: ["Pageview", "ViewContent", "AddToCart", "InitiateCheckout", "CompletePayment"],
    tips: [
      "Pixel + Events API should dedupe with event_id / order id.",
      "Validate TikTok Pixel ID in GTM and Events API access token."
    ]
  },
  {
    id: "pinterest",
    label: "Pinterest",
    aliases: ["pinterest", "pin"],
    expected_events: ["page_visit", "view_category", "add_to_cart", "checkout", "checkout"],
    tips: [
      "Use Pinterest Tag browser events alongside Conversions API.",
      "Match event_id across surfaces for purchase dedupe."
    ]
  },
  {
    id: "reddit",
    label: "Reddit",
    aliases: ["reddit"],
    expected_events: ["PageVisit", "ViewContent", "AddToCart", "Purchase"],
    tips: [
      "Reddit Pixel + CAPI both need the same conversion ID strategy.",
      "Confirm Pixel Guard / bot suppression is not blocking legitimate Reddit traffic."
    ]
  },
  {
    id: "bloomreach",
    label: "Bloomreach",
    aliases: ["bloomreach", "exponea"],
    expected_events: ["view_item", "cart_update", "purchase", "consent"],
    tips: [
      "Bloomreach GTM variables still expect Elevar-shaped dl_* until remapped.",
      "Validate catalog IDs and customer identity after Synapse dual-run."
    ]
  },
  {
    id: "triple_whale",
    label: "Triple Whale",
    aliases: ["triple_whale", "triplewhale", "tw"],
    expected_events: ["page_view", "add_to_cart", "purchase"],
    tips: [
      "Keep TW pixel on during Synapse dual-run only if you accept double client events.",
      "Server purchases should arrive once via Synapse → sGTM path."
    ]
  },
  {
    id: "cj",
    label: "Commission Junction",
    aliases: ["cj", "commission_junction", "commissionjunction"],
    expected_events: ["purchase"],
    tips: [
      "CJ usually needs server-side order confirmation with discount/coupon fidelity.",
      "Verify action IDs and enterprise CID after webhook mapping changes."
    ]
  },
  {
    id: "server_gtm",
    label: "Server GTM",
    aliases: ["server_gtm", "sgtm", "gtm_server", "gtm"],
    expected_events: ["purchase", "refund", "page_view"],
    tips: [
      "sGTM is the fan-out hub — if this is silent, destination platforms will starve.",
      "Confirm Synapse webhook forward + browser beacon tags both land in GTM-N45F3JCC."
    ]
  },
  {
    id: "synapse",
    label: "Synapse (source)",
    aliases: ["synapse", "gcw_synapse", "gcw-synapse"],
    expected_events: [
      "dl_user_data",
      "dl_view_item",
      "dl_add_to_cart",
      "dl_begin_checkout",
      "dl_purchase"
    ],
    tips: [
      "Theme embed covers storefront dl_*; web pixel covers checkout.",
      "Beacon 202s here are the source of truth before GTM destinations."
    ]
  }
];

function idlePulse(): SurfacePulse {
  return {
    status: "idle",
    total_events: 0,
    error_events: 0,
    failure_rate_pct: 0,
    last_event_at: null,
    minutes_since_last_event: null,
    event_counts: {},
    destinations: []
  };
}

function matchesPlatform(channel: string, def: PlatformDefinition): boolean {
  const normalized = channel.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return def.aliases.some((alias) => normalized === alias || normalized.includes(alias));
}

function mergePulse(items: ChannelHealthItem[], surface: "pixel" | "server" | "runtime" | "webhook"): SurfacePulse {
  const relevant = items.filter((item) => {
    if (surface === "pixel") return item.surface === "pixel" || item.surface === "runtime";
    if (surface === "server") return item.surface === "server" || item.surface === "webhook";
    return item.surface === surface;
  });

  if (relevant.length === 0) return idlePulse();

  const total = relevant.reduce((sum, item) => sum + item.total_events, 0);
  const errors = relevant.reduce((sum, item) => sum + item.error_events, 0);
  const eventCounts: Record<string, number> = {};
  const destinations = new Set<string>();
  let latest: string | null = null;
  let latestMs = 0;

  for (const item of relevant) {
    destinations.add(item.destination);
    for (const [name, count] of Object.entries(item.event_counts)) {
      eventCounts[name] = (eventCounts[name] ?? 0) + count;
    }
    const ms = new Date(item.last_event_at).getTime();
    if (Number.isFinite(ms) && ms >= latestMs) {
      latestMs = ms;
      latest = item.last_event_at;
    }
  }

  const failureRate = total > 0 ? (errors / total) * 100 : 0;
  const minutes = latest ? Math.max(0, Math.round((Date.now() - latestMs) / 60000)) : null;
  let status: SurfacePulse["status"] = "firing";
  if (errors > 0 && failureRate >= 10) status = "error";
  else if (minutes != null && minutes > 120) status = "silent";
  else if (total === 0) status = "idle";

  return {
    status,
    total_events: total,
    error_events: errors,
    failure_rate_pct: Number(failureRate.toFixed(2)),
    last_event_at: latest,
    minutes_since_last_event: minutes,
    event_counts: eventCounts,
    destinations: [...destinations]
  };
}

function computeMatchPct(platformId: string, aliases: string[]): { match_pct: number | null; paired_events: number } {
  const recent = getRecentChannelEvents(500);
  const browserKeys = new Set<string>();
  const serverKeys = new Set<string>();

  for (const event of recent) {
    if (!aliases.some((alias) => event.channel.toLowerCase().includes(alias))) {
      // also allow exact platform id
      if (event.channel.toLowerCase() !== platformId) continue;
    }
    const key =
      event.event_id ||
      event.transaction_id ||
      `${event.event_name}|${event.observed_at ?? ""}`;
    if (!key) continue;
    if (event.surface === "pixel" || event.surface === "runtime") browserKeys.add(key);
    if (event.surface === "server" || event.surface === "webhook") serverKeys.add(key);
  }

  if (browserKeys.size === 0 || serverKeys.size === 0) {
    return { match_pct: null, paired_events: 0 };
  }

  let paired = 0;
  for (const key of browserKeys) {
    if (serverKeys.has(key)) paired += 1;
  }
  const denom = Math.max(browserKeys.size, serverKeys.size);
  return {
    paired_events: paired,
    match_pct: Number(((paired / denom) * 100).toFixed(2))
  };
}

function rowStatus(browser: SurfacePulse, server: SurfacePulse, matchPct: number | null): PlatformRow["status"] {
  if (browser.status === "idle" && server.status === "idle") return "idle";
  if (browser.status === "error" || server.status === "error") return "critical";
  if (matchPct != null && matchPct < 85) return "warning";
  if (browser.status === "silent" || server.status === "silent") return "warning";
  if (browser.status === "idle" || server.status === "idle") return "warning";
  return "healthy";
}

export function buildPlatformMatrix(
  staleMinutes = 90,
  warnFailurePct = 5
): PlatformMatrix {
  const summary: ChannelHealthSummary = getChannelHealthSummary(staleMinutes, warnFailurePct);
  const allIssues = getChannelTroubleshooting(summary);
  const links = getChannelHelpLinks();

  const platforms = PLATFORM_DEFS.map((def) => {
    const items = summary.channels.filter((item) => matchesPlatform(item.channel, def));
    const browser = mergePulse(items, "pixel");
    const server = mergePulse(items, "server");
    const { match_pct, paired_events } = computeMatchPct(def.id, def.aliases);
    const issues = allIssues.filter((issue) =>
      items.some((item) => issue.key === item.key || issue.title.toLowerCase().includes(def.id))
    );
    const docs = links[def.id] ?? links[def.aliases[0] ?? ""] ?? [
      "https://help.shopify.com/en/manual/promoting-marketing/pixels"
    ];

    return {
      id: def.id,
      label: def.label,
      browser,
      server,
      match_pct,
      paired_events,
      status: rowStatus(browser, server, match_pct),
      expected_events: def.expected_events,
      docs,
      issues,
      tips: def.tips
    } satisfies PlatformRow;
  });

  const healthy = platforms.filter((p) => p.status === "healthy").length;
  const warning = platforms.filter((p) => p.status === "warning").length;
  const critical = platforms.filter((p) => p.status === "critical").length;
  const idle = platforms.filter((p) => p.status === "idle").length;
  const matchValues = platforms.map((p) => p.match_pct).filter((v): v is number => v != null);
  const avgMatch =
    matchValues.length > 0
      ? Number((matchValues.reduce((a, b) => a + b, 0) / matchValues.length).toFixed(2))
      : null;

  return {
    generated_at: new Date().toISOString(),
    totals: {
      platforms: platforms.length,
      healthy,
      warning,
      critical,
      idle,
      avg_match_pct: avgMatch
    },
    platforms,
    troubleshooting: allIssues,
    links
  };
}
