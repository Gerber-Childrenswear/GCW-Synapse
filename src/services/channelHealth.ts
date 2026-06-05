type ChannelSurface = "pixel" | "server" | "runtime" | "webhook";

type EventStatus = "ok" | "error";

export type ChannelEventInput = {
  channel: string;
  surface: ChannelSurface;
  destination: string;
  pixel_id?: string | undefined;
  event_name: string;
  event_id?: string | undefined;
  transaction_id?: string | undefined;
  source_theme?: string | undefined;
  source_surface?: string | undefined;
  status: EventStatus;
  error_message?: string | undefined;
  observed_at?: string | undefined;
};

type ChannelAccumulator = {
  key: string;
  channel: string;
  surface: ChannelSurface;
  destination: string;
  pixel_id?: string | undefined;
  total_events: number;
  error_events: number;
  last_event_at: string;
  last_ok_at?: string | undefined;
  last_error_at?: string | undefined;
  last_error_message?: string | undefined;
  event_counts: Record<string, number>;
};

export type ChannelHealthStatus = "healthy" | "warning" | "critical";

export type ChannelHealthItem = {
  key: string;
  channel: string;
  surface: ChannelSurface;
  destination: string;
  pixel_id?: string | undefined;
  status: ChannelHealthStatus;
  failure_rate_pct: number;
  minutes_since_last_event: number;
  total_events: number;
  error_events: number;
  last_event_at: string;
  last_error_at?: string | undefined;
  last_error_message?: string | undefined;
  event_counts: Record<string, number>;
};

export type ChannelHealthSummary = {
  totals: {
    tracked_integrations: number;
    healthy: number;
    warning: number;
    critical: number;
  };
  channels: ChannelHealthItem[];
};

export type TroubleshootingIssue = {
  key: string;
  severity: "warning" | "critical";
  title: string;
  details: string;
  recommendations: string[];
  links: string[];
};

const channelState = new Map<string, ChannelAccumulator>();
const recentChannelEvents: ChannelEventInput[] = [];

const docsByChannel: Record<string, string[]> = {
  facebook: [
    "https://developers.facebook.com/docs/meta-pixel/implementation/",
    "https://developers.facebook.com/docs/marketing-api/conversions-api/"
  ],
  meta: [
    "https://developers.facebook.com/docs/meta-pixel/implementation/",
    "https://developers.facebook.com/docs/marketing-api/conversions-api/"
  ],
  google: [
    "https://support.google.com/analytics/answer/13762151",
    "https://support.google.com/google-ads/answer/7548399"
  ],
  ga4: [
    "https://developers.google.com/analytics/devguides/collection/ga4",
    "https://support.google.com/analytics/answer/13881457"
  ],
  pinterest: [
    "https://help.pinterest.com/en/business/article/install-the-pinterest-tag",
    "https://developers.pinterest.com/docs/conversions/conversion-api/"
  ],
  tiktok: [
    "https://ads.tiktok.com/help/article/tiktok-pixel",
    "https://ads.tiktok.com/help/article/events-api"
  ],
  reddit: [
    "https://business.reddithelp.com/s/article/Install-the-Reddit-Pixel-on-your-website",
    "https://business.reddithelp.com/s/article/Conversions-API"
  ]
};

function normalizeString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function toIsoString(value: string | undefined): string {
  if (!value) {
    return new Date().toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}

function makeKey(input: ChannelEventInput): string {
  return [
    input.channel.toLowerCase(),
    input.surface,
    input.destination.toLowerCase(),
    normalizeString(input.pixel_id) ?? "shared"
  ].join("|");
}

function minutesSince(iso: string): number {
  const then = new Date(iso).getTime();
  const now = Date.now();
  return Math.max(0, Math.round((now - then) / 60000));
}

function round(value: number): number {
  return Number.parseFloat(value.toFixed(2));
}

function classifyStatus(
  failureRatePct: number,
  minutesSinceLastEvent: number,
  staleMinutes: number,
  warnFailurePct: number
): ChannelHealthStatus {
  if (minutesSinceLastEvent > staleMinutes * 2 || failureRatePct >= 25) {
    return "critical";
  }

  if (minutesSinceLastEvent > staleMinutes || failureRatePct > warnFailurePct) {
    return "warning";
  }

  return "healthy";
}

function linksForChannel(channel: string): string[] {
  return docsByChannel[channel.toLowerCase()] ?? ["https://help.shopify.com/en/manual/promoting-marketing/pixels"]; 
}

export function ingestChannelEvent(input: ChannelEventInput): ChannelHealthItem {
  const normalizedEvent: ChannelEventInput = {
    ...input,
    channel: input.channel.trim(),
    destination: input.destination.trim(),
    pixel_id: normalizeString(input.pixel_id),
    event_name: input.event_name.trim(),
    event_id: normalizeString(input.event_id),
    transaction_id: normalizeString(input.transaction_id),
    source_theme: normalizeString(input.source_theme),
    source_surface: normalizeString(input.source_surface),
    error_message: normalizeString(input.error_message),
    observed_at: toIsoString(input.observed_at)
  };

  const key = makeKey(normalizedEvent);
  const existing = channelState.get(key);

  const next: ChannelAccumulator = existing
    ? {
        ...existing,
        total_events: existing.total_events + 1,
        error_events: existing.error_events + (normalizedEvent.status === "error" ? 1 : 0),
        last_event_at: normalizedEvent.observed_at ?? new Date().toISOString(),
        last_ok_at: normalizedEvent.status === "ok" ? normalizedEvent.observed_at : existing.last_ok_at,
        last_error_at: normalizedEvent.status === "error" ? normalizedEvent.observed_at : existing.last_error_at,
        last_error_message:
          normalizedEvent.status === "error"
            ? normalizedEvent.error_message ?? "Unknown channel error"
            : existing.last_error_message,
        event_counts: {
          ...existing.event_counts,
          [normalizedEvent.event_name]: (existing.event_counts[normalizedEvent.event_name] ?? 0) + 1
        }
      }
    : {
        key,
        channel: normalizedEvent.channel,
        surface: normalizedEvent.surface,
        destination: normalizedEvent.destination,
        pixel_id: normalizedEvent.pixel_id,
        total_events: 1,
        error_events: normalizedEvent.status === "error" ? 1 : 0,
        last_event_at: normalizedEvent.observed_at ?? new Date().toISOString(),
        last_ok_at: normalizedEvent.status === "ok" ? normalizedEvent.observed_at : undefined,
        last_error_at: normalizedEvent.status === "error" ? normalizedEvent.observed_at : undefined,
        last_error_message: normalizedEvent.status === "error" ? normalizedEvent.error_message : undefined,
        event_counts: {
          [normalizedEvent.event_name]: 1
        }
      };

  channelState.set(key, next);
  recentChannelEvents.push(normalizedEvent);
  while (recentChannelEvents.length > 1000) {
    recentChannelEvents.shift();
  }

  return toHealthItem(next, 90, 5);
}

function toHealthItem(
  acc: ChannelAccumulator,
  staleMinutes: number,
  warnFailurePct: number
): ChannelHealthItem {
  const failureRatePct = acc.total_events > 0 ? (acc.error_events / acc.total_events) * 100 : 0;
  const mins = minutesSince(acc.last_event_at);
  const status = classifyStatus(failureRatePct, mins, staleMinutes, warnFailurePct);

  return {
    key: acc.key,
    channel: acc.channel,
    surface: acc.surface,
    destination: acc.destination,
    pixel_id: acc.pixel_id,
    status,
    failure_rate_pct: round(failureRatePct),
    minutes_since_last_event: mins,
    total_events: acc.total_events,
    error_events: acc.error_events,
    last_event_at: acc.last_event_at,
    last_error_at: acc.last_error_at,
    last_error_message: acc.last_error_message,
    event_counts: acc.event_counts
  };
}

export function getChannelHealthSummary(staleMinutes: number, warnFailurePct: number): ChannelHealthSummary {
  const channels = [...channelState.values()].map((acc) => toHealthItem(acc, staleMinutes, warnFailurePct));

  let healthy = 0;
  let warning = 0;
  let critical = 0;

  for (const channel of channels) {
    if (channel.status === "healthy") {
      healthy += 1;
      continue;
    }

    if (channel.status === "warning") {
      warning += 1;
      continue;
    }

    critical += 1;
  }

  return {
    totals: {
      tracked_integrations: channels.length,
      healthy,
      warning,
      critical
    },
    channels
  };
}

export function getChannelTroubleshooting(summary: ChannelHealthSummary): TroubleshootingIssue[] {
  const issues: TroubleshootingIssue[] = [];

  for (const item of summary.channels) {
    if (item.status === "healthy") {
      continue;
    }

    const recommendations: string[] = [];

    if (item.minutes_since_last_event > 90) {
      recommendations.push("Check trigger conditions and recent traffic for this channel/pixel.");
      recommendations.push("Verify the webhook and pixel event names match expected values in GTM.");
    }

    if (item.failure_rate_pct > 0) {
      recommendations.push("Inspect latest error payloads and endpoint responses for this destination.");
      recommendations.push("Validate API keys/tokens and destination-specific required fields.");
    }

    issues.push({
      key: item.key,
      severity: item.status === "critical" ? "critical" : "warning",
      title: `${item.channel} ${item.surface} integration needs attention`,
      details: `Failure rate ${item.failure_rate_pct}% with last activity ${item.minutes_since_last_event} minutes ago.`,
      recommendations,
      links: linksForChannel(item.channel)
    });
  }

  return issues;
}

export function getRecentChannelEvents(limit = 100): ChannelEventInput[] {
  const size = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 500)) : 100;
  return recentChannelEvents.slice(-size).reverse();
}

export function getChannelHelpLinks(): Record<string, string[]> {
  return docsByChannel;
}

export function resetChannelHealthForTests(): void {
  channelState.clear();
  recentChannelEvents.length = 0;
}
