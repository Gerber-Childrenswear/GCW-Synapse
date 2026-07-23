import {
  getChannelHealthSummary,
  getChannelHelpLinks,
  getChannelTroubleshooting,
  getRecentChannelEvents,
  type ChannelHealthItem,
  type ChannelHealthSummary,
  type TroubleshootingIssue
} from "./channelHealth";
import {
  dedupeKeyFieldForPlatform,
  diagnoseErrorMessage,
  type DiagnosedCause
} from "./platformDiagnostics";

export type SurfacePulse = {
  status: "firing" | "silent" | "error" | "idle";
  total_events: number;
  error_events: number;
  failure_rate_pct: number;
  last_event_at: string | null;
  minutes_since_last_event: number | null;
  event_counts: Record<string, number>;
  destinations: string[];
  last_error_message?: string | null;
};

export type DedupeStats = {
  key_field: "event_id" | "transaction_id" | "either";
  status: "confirmed" | "partial" | "missing" | "idle";
  confirmed: number;
  browser_only: number;
  server_only: number;
  browser_keys: number;
  server_keys: number;
  confirmation_pct: number | null;
  sample_confirmed: string[];
  sample_browser_only: string[];
  sample_server_only: string[];
};

export type EventCoverage = {
  name: string;
  browser: number;
  server: number;
  status: "both" | "browser_only" | "server_only" | "missing";
};

export type PlatformRow = {
  id: string;
  label: string;
  group: string;
  browser: SurfacePulse;
  server: SurfacePulse;
  match_pct: number | null;
  paired_events: number;
  status: "healthy" | "warning" | "critical" | "idle";
  expected_events: string[];
  event_coverage: EventCoverage[];
  coverage_pct: number | null;
  dedupe: DedupeStats;
  docs: string[];
  issues: TroubleshootingIssue[];
  causes: DiagnosedCause[];
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
    avg_dedupe_pct: number | null;
    dedupe_confirmed_platforms: number;
    monitored_with_traffic: number;
    open_causes: number;
    critical_causes: number;
  };
  platforms: PlatformRow[];
  troubleshooting: TroubleshootingIssue[];
  top_causes: DiagnosedCause[];
  links: Record<string, string[]>;
};

type PlatformDefinition = {
  id: string;
  label: string;
  group: string;
  aliases: string[];
  expected_events: string[];
  tips: string[];
};

const PLATFORM_DEFS: PlatformDefinition[] = [
  {
    id: "meta",
    label: "Meta (Facebook)",
    group: "paid-social",
    aliases: ["meta", "facebook", "fb"],
    expected_events: ["PageView", "ViewContent", "AddToCart", "InitiateCheckout", "Purchase"],
    tips: [
      "Pixel eventID must equal CAPI event_id and event names must match (Meta 48h window).",
      "Send fbp/fbc + hashed em/ph when consent allows to protect EMQ."
    ]
  },
  {
    id: "ga4",
    label: "Google Analytics 4",
    group: "search-analytics",
    aliases: ["ga4", "google_analytics", "analytics"],
    expected_events: ["page_view", "view_item", "add_to_cart", "begin_checkout", "purchase"],
    tips: [
      "Align transaction_id on browser GA4 purchase and Measurement Protocol / sGTM purchase.",
      "Confirm measurement_id + API secret in the server tag."
    ]
  },
  {
    id: "google_ads",
    label: "Google Ads",
    group: "search-analytics",
    aliases: ["google_ads", "google-ads", "aw"],
    expected_events: ["page_view", "add_to_cart", "begin_checkout", "purchase"],
    tips: [
      "Enhanced conversions need identical hashed PII on browser and server.",
      "Re-check conversion ID/label mapping after Synapse cutover."
    ]
  },
  {
    id: "tiktok",
    label: "TikTok",
    group: "paid-social",
    aliases: ["tiktok", "tt"],
    expected_events: ["Pageview", "ViewContent", "AddToCart", "InitiateCheckout", "CompletePayment"],
    tips: [
      "Pixel + Events API should share event_id (and order id on CompletePayment).",
      "Keep Pixel ID and Events API access token on the same TikTok pixel."
    ]
  },
  {
    id: "pinterest",
    label: "Pinterest",
    group: "paid-social",
    aliases: ["pinterest", "pin"],
    expected_events: ["page_visit", "view_category", "add_to_cart", "checkout"],
    tips: [
      "Send event_id on both Pinterest Tag and Conversions API.",
      "Validate Tag ID vs Conversions API token in Ads Manager."
    ]
  },
  {
    id: "reddit",
    label: "Reddit",
    group: "paid-social",
    aliases: ["reddit"],
    expected_events: ["PageVisit", "ViewContent", "AddToCart", "Purchase"],
    tips: [
      "Use one conversion ID strategy across Pixel + CAPI.",
      "Ensure bot suppression is not dropping legitimate Reddit-driven shoppers."
    ]
  },
  {
    id: "bloomreach",
    label: "Bloomreach",
    group: "commerce",
    aliases: ["bloomreach", "exponea"],
    expected_events: ["view_item", "cart_update", "purchase", "consent"],
    tips: [
      "Remap GTM variables off Elevar-only dataLayer paths before cutover.",
      "Validate catalog IDs and customer identity on Synapse events."
    ]
  },
  {
    id: "cj",
    label: "Commission Junction",
    group: "commerce",
    aliases: ["cj", "commission_junction", "commissionjunction"],
    expected_events: ["purchase"],
    tips: [
      "CJ needs reliable server-side order confirmation with coupon fidelity.",
      "Verify enterprise CID / action IDs after webhook mapping changes."
    ]
  },
  {
    id: "server_gtm",
    label: "Server GTM",
    group: "pipe",
    aliases: ["server_gtm", "sgtm", "gtm_server", "gtm"],
    expected_events: ["purchase", "refund", "page_view"],
    tips: [
      "If sGTM is silent, every destination downstream starves.",
      "Confirm Synapse webhook + browser beacon clients land in GTM-N45F3JCC."
    ]
  },
  {
    id: "synapse",
    label: "Synapse (source)",
    group: "pipe",
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
      "Beacon 202s are the source of truth before destination fan-out."
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
    destinations: [],
    last_error_message: null
  };
}

function matchesPlatform(channel: string, def: PlatformDefinition): boolean {
  const normalized = channel.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return def.aliases.some((alias) => normalized === alias || normalized.includes(alias));
}

function mergePulse(
  items: ChannelHealthItem[],
  surface: "pixel" | "server" | "runtime" | "webhook"
): SurfacePulse {
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
  let lastError: string | null = null;
  let lastErrorMs = 0;

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
    if (item.last_error_message && item.last_error_at) {
      const errMs = new Date(item.last_error_at).getTime();
      if (Number.isFinite(errMs) && errMs >= lastErrorMs) {
        lastErrorMs = errMs;
        lastError = item.last_error_message;
      }
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
    destinations: [...destinations],
    last_error_message: lastError
  };
}

function eventKey(
  event: ReturnType<typeof getRecentChannelEvents>[number],
  keyField: DedupeStats["key_field"]
): string | null {
  const eventId = event.event_id?.trim();
  const txnId = event.transaction_id?.trim();
  if (keyField === "event_id") return eventId || null;
  if (keyField === "transaction_id") return txnId || eventId || null;
  return eventId || txnId || null;
}

function computeDedupe(platformId: string, aliases: string[]): DedupeStats {
  const keyField = dedupeKeyFieldForPlatform(platformId);
  const recent = getRecentChannelEvents(500);
  const browserKeys = new Map<string, string>();
  const serverKeys = new Map<string, string>();

  for (const event of recent) {
    const channel = event.channel.toLowerCase().replace(/[\s-]+/g, "_");
    const matched =
      channel === platformId ||
      aliases.some((alias) => channel === alias || channel.includes(alias));
    if (!matched) continue;

    const key = eventKey(event, keyField);
    if (!key) continue;
    const label = `${event.event_name}:${key}`;
    if (event.surface === "pixel" || event.surface === "runtime") browserKeys.set(key, label);
    if (event.surface === "server" || event.surface === "webhook") serverKeys.set(key, label);
  }

  const confirmed: string[] = [];
  const browserOnly: string[] = [];
  const serverOnly: string[] = [];

  for (const [key, label] of browserKeys) {
    if (serverKeys.has(key)) confirmed.push(label);
    else browserOnly.push(label);
  }
  for (const [key, label] of serverKeys) {
    if (!browserKeys.has(key)) serverOnly.push(label);
  }

  const browserCount = browserKeys.size;
  const serverCount = serverKeys.size;
  const confirmedCount = confirmed.length;
  const denom = Math.max(browserCount, serverCount);

  let status: DedupeStats["status"] = "idle";
  if (browserCount === 0 && serverCount === 0) status = "idle";
  else if (confirmedCount > 0 && browserOnly.length === 0 && serverOnly.length === 0) status = "confirmed";
  else if (confirmedCount > 0) status = "partial";
  else status = "missing";

  return {
    key_field: keyField,
    status,
    confirmed: confirmedCount,
    browser_only: browserOnly.length,
    server_only: serverOnly.length,
    browser_keys: browserCount,
    server_keys: serverCount,
    confirmation_pct: denom > 0 ? Number(((confirmedCount / denom) * 100).toFixed(2)) : null,
    sample_confirmed: confirmed.slice(0, 3),
    sample_browser_only: browserOnly.slice(0, 3),
    sample_server_only: serverOnly.slice(0, 3)
  };
}

function buildEventCoverage(
  expected: string[],
  browser: SurfacePulse,
  server: SurfacePulse
): { coverage: EventCoverage[]; coverage_pct: number | null } {
  const coverage = expected.map((name) => {
    const b = browser.event_counts[name] ?? 0;
    const s = server.event_counts[name] ?? 0;
    let status: EventCoverage["status"] = "missing";
    if (b > 0 && s > 0) status = "both";
    else if (b > 0) status = "browser_only";
    else if (s > 0) status = "server_only";
    return { name, browser: b, server: s, status };
  });
  const both = coverage.filter((c) => c.status === "both").length;
  return {
    coverage,
    coverage_pct:
      expected.length === 0 ? null : Number(((both / expected.length) * 100).toFixed(1))
  };
}

function rowStatus(
  browser: SurfacePulse,
  server: SurfacePulse,
  dedupe: DedupeStats,
  causes: DiagnosedCause[],
  group: string
): PlatformRow["status"] {
  if (browser.status === "idle" && server.status === "idle") return "idle";
  if (causes.some((c) => c.severity === "critical") || browser.status === "error" || server.status === "error") {
    return "critical";
  }
  if (group === "pipe") {
    if (browser.status === "firing" || server.status === "firing") return "healthy";
    if (browser.status === "silent" || server.status === "silent") return "warning";
    return "warning";
  }
  if (dedupe.status === "missing" && (browser.status === "firing" || server.status === "firing")) {
    return "warning";
  }
  if (dedupe.status === "partial") return "warning";
  if (browser.status === "silent" || server.status === "silent") return "warning";
  if (browser.status === "idle" || server.status === "idle") return "warning";
  return "healthy";
}

function buildCausesForPlatform(
  def: PlatformDefinition,
  browser: SurfacePulse,
  server: SurfacePulse,
  dedupe: DedupeStats,
  items: ChannelHealthItem[]
): DiagnosedCause[] {
  const errorMessages = items
    .map((i) => i.last_error_message)
    .filter((m): m is string => Boolean(m));
  const primaryError = server.last_error_message || browser.last_error_message || errorMessages[0];

  return diagnoseErrorMessage(def.id, primaryError, {
    missingDedupe:
      dedupe.status === "missing" &&
      (dedupe.browser_keys > 0 || dedupe.server_keys > 0) &&
      def.group !== "pipe",
    partialDedupe: dedupe.status === "partial" && def.group !== "pipe",
    browserOnly: browser.status === "firing" && server.status === "idle" && def.group !== "pipe",
    serverOnly: server.status === "firing" && browser.status === "idle" && def.group !== "pipe"
  });
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
    const dedupe = computeDedupe(def.id, def.aliases);
    const { coverage, coverage_pct } = buildEventCoverage(def.expected_events, browser, server);
    const causes = buildCausesForPlatform(def, browser, server, dedupe, items);
    const issues = allIssues.filter((issue) =>
      items.some(
        (item) =>
          issue.key === item.key ||
          issue.title.toLowerCase().includes(def.id) ||
          issue.title.toLowerCase().includes(def.label.toLowerCase().split(" ")[0] ?? "")
      )
    );
    const docs = links[def.id] ?? links[def.aliases[0] ?? ""] ?? [
      "https://help.shopify.com/en/manual/promoting-marketing/pixels"
    ];

    // Prefer real dedupe confirmation % as match_pct (no observed_at false pairs)
    const match_pct = dedupe.confirmation_pct;
    const paired_events = dedupe.confirmed;

    return {
      id: def.id,
      label: def.label,
      group: def.group,
      browser,
      server,
      match_pct,
      paired_events,
      status: rowStatus(browser, server, dedupe, causes, def.group),
      expected_events: def.expected_events,
      event_coverage: coverage,
      coverage_pct,
      dedupe,
      docs,
      issues,
      causes,
      tips: def.tips
    } satisfies PlatformRow;
  });

  const healthy = platforms.filter((p) => p.status === "healthy").length;
  const warning = platforms.filter((p) => p.status === "warning").length;
  const critical = platforms.filter((p) => p.status === "critical").length;
  const idle = platforms.filter((p) => p.status === "idle").length;
  const matchValues = platforms.map((p) => p.match_pct).filter((v): v is number => v != null);
  const dedupeValues = platforms
    .map((p) => p.dedupe.confirmation_pct)
    .filter((v): v is number => v != null);
  const avgMatch =
    matchValues.length > 0
      ? Number((matchValues.reduce((a, b) => a + b, 0) / matchValues.length).toFixed(2))
      : null;
  const avgDedupe =
    dedupeValues.length > 0
      ? Number((dedupeValues.reduce((a, b) => a + b, 0) / dedupeValues.length).toFixed(2))
      : null;

  const topCausesMap = new Map<string, DiagnosedCause>();
  for (const platform of platforms) {
    for (const cause of platform.causes) {
      if (!topCausesMap.has(cause.code)) topCausesMap.set(cause.code, cause);
    }
  }
  const top_causes = [...topCausesMap.values()].sort((a, b) => {
    if (a.severity === b.severity) return a.title.localeCompare(b.title);
    return a.severity === "critical" ? -1 : 1;
  });

  return {
    generated_at: new Date().toISOString(),
    totals: {
      platforms: platforms.length,
      healthy,
      warning,
      critical,
      idle,
      avg_match_pct: avgMatch,
      avg_dedupe_pct: avgDedupe,
      dedupe_confirmed_platforms: platforms.filter((p) => p.dedupe.status === "confirmed").length,
      monitored_with_traffic: platforms.filter((p) => p.status !== "idle").length,
      open_causes: top_causes.length,
      critical_causes: top_causes.filter((c) => c.severity === "critical").length
    },
    platforms,
    troubleshooting: allIssues,
    top_causes,
    links
  };
}
