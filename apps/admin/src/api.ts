export type RuntimeStatus = {
  status: string;
  webhooksReceived: number;
  eventsGenerated: number;
  dbConnected: boolean;
  uptime: number;
  vendorAdapters: Array<{ name: string; enabled: boolean }>;
};

export type EventSchema = {
  eventName: string;
  description: string;
  vendors: string[];
  fields: Array<{
    name: string;
    type: string;
    required: boolean;
    path: string;
    description: string;
    example: string;
  }>;
};

export type ShadowStats = {
  totalComparisons: number;
  avgMatchScore: number;
  eventBreakdown: Array<{ event: string; count: number }>;
};

export type QaChecklistItem = {
  id: string;
  category: string;
  description: string;
  status: "pending" | "pass" | "fail";
  notes: string | null;
};

export type SmokeRunResult = {
  status: string;
  runAt: string;
  passed: number;
  failed: number;
  total: number;
  results: Array<{
    name: string;
    passed: boolean;
    durationMs: number;
    error: string | null;
    detail: Record<string, unknown>;
  }>;
};

export type ShopifyInstallStatus = {
  installed_shops: string[];
  store_path: string;
};

export type EndpointProbeResult = {
  status: number;
  ok: boolean;
  durationMs: number;
  bodyText: string;
};

export type AdvisorAlertItem = {
  severity: "warning" | "critical";
  title: string;
  message: string;
  action: string;
};

export type AdvisorChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AdvisorChatResponse = {
  answer: string;
  model: string;
  fallback_used: boolean;
  local_ai_enabled: boolean;
  used_tools: string[];
  alerts: AdvisorAlertItem[];
};

const BASE_URL = (import.meta.env.VITE_SYNAPSE_BASE_URL as string | undefined) ?? "";
const INGRESS_TOKEN = (import.meta.env.VITE_SYNAPSE_TOKEN as string | undefined) ?? "";

export class ApiRequestError extends Error {
  status: number;
  path: string;
  bodyText: string;

  constructor(path: string, status: number, bodyText: string) {
    super(`Request failed (${status}) for ${path}`);
    this.name = "ApiRequestError";
    this.status = status;
    this.path = path;
    this.bodyText = bodyText;
  }
}

async function request<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (INGRESS_TOKEN) {
    headers["X-Synapse-Token"] = INGRESS_TOKEN;
  }

  const res = await fetch(`${BASE_URL}${path}`, { headers });
  if (!res.ok) {
    const bodyText = await res.text();
    throw new ApiRequestError(path, res.status, bodyText);
  }

  return (await res.json()) as T;
}

async function requestWithMethod<T>(path: string, method: "GET" | "POST"): Promise<T> {
  const headers: Record<string, string> = {};
  if (INGRESS_TOKEN) {
    headers["X-Synapse-Token"] = INGRESS_TOKEN;
  }

  const res = await fetch(`${BASE_URL}${path}`, { method, headers });
  if (!res.ok) {
    const bodyText = await res.text();
    throw new ApiRequestError(path, res.status, bodyText);
  }

  return (await res.json()) as T;
}

async function requestJson<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (INGRESS_TOKEN) {
    headers["X-Synapse-Token"] = INGRESS_TOKEN;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const bodyText = await res.text();
    throw new ApiRequestError(path, res.status, bodyText);
  }

  return (await res.json()) as T;
}

export async function getRuntimeStatus(): Promise<RuntimeStatus> {
  return request<RuntimeStatus>("/api/status");
}

export async function getEventSchemas(): Promise<EventSchema[]> {
  return request<EventSchema[]>("/api/events/schemas");
}

export async function getWebhookLog(limit = 50): Promise<unknown[]> {
  return request<unknown[]>(`/api/webhooks/log?limit=${limit}`);
}

export async function getShadowStats(): Promise<ShadowStats> {
  return request<ShadowStats>("/api/shadow/stats");
}

export async function getShadowComparisons(limit = 50): Promise<unknown[]> {
  return request<unknown[]>(`/api/shadow/comparisons?limit=${limit}`);
}

export async function getQaChecklist(): Promise<QaChecklistItem[]> {
  return request<QaChecklistItem[]>("/api/qa/checklist");
}

export async function runQaSmokeTests(): Promise<SmokeRunResult> {
  return requestWithMethod<SmokeRunResult>("/api/qa/smoke", "POST");
}

export async function getShopifyInstallStatus(): Promise<ShopifyInstallStatus> {
  const data = await request<{ status: ShopifyInstallStatus }>("/ops/shopify-install-status");
  return data.status;
}

export async function probeEndpoint(
  path: string,
  options?: {
    method?: "GET" | "POST" | "OPTIONS";
    body?: string;
    contentType?: string;
    extraHeaders?: Record<string, string>;
  }
): Promise<EndpointProbeResult> {
  const headers: Record<string, string> = { ...(options?.extraHeaders ?? {}) };
  if (INGRESS_TOKEN) {
    headers["X-Synapse-Token"] = INGRESS_TOKEN;
  }
  if (options?.contentType) {
    headers["Content-Type"] = options.contentType;
  }

  const startedAt = performance.now();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: options?.method ?? "GET",
    headers,
    body: options?.body
  });
  const bodyText = await res.text();

  return {
    status: res.status,
    ok: res.ok,
    durationMs: Math.round(performance.now() - startedAt),
    bodyText
  };
}

export async function getAdvisorAlerts(): Promise<AdvisorAlertItem[]> {
  const data = await request<{ alerts: AdvisorAlertItem[] }>("/api/advisor/alerts");
  return data.alerts;
}

export async function sendAdvisorMessage(input: {
  message: string;
  history: AdvisorChatMessage[];
}): Promise<AdvisorChatResponse> {
  return requestJson<AdvisorChatResponse>("/api/advisor/chat", "POST", input);
}

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

export type TroubleshootingIssue = {
  key: string;
  severity: "warning" | "critical";
  title: string;
  details: string;
  recommendations: string[];
  links: string[];
};

export type DiagnosedCause = {
  code: string;
  title: string;
  severity: "warning" | "critical";
  cause: string;
  fix: string;
  doc_url: string;
  doc_label: string;
  evidence?: string;
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
  group?: string;
  browser: SurfacePulse;
  server: SurfacePulse;
  match_pct: number | null;
  paired_events: number;
  status: "healthy" | "warning" | "critical" | "idle";
  expected_events: string[];
  event_coverage?: EventCoverage[];
  coverage_pct?: number | null;
  dedupe?: DedupeStats;
  docs: string[];
  issues: TroubleshootingIssue[];
  causes?: DiagnosedCause[];
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
    avg_dedupe_pct?: number | null;
    dedupe_confirmed_platforms?: number;
    monitored_with_traffic?: number;
    open_causes?: number;
    critical_causes?: number;
  };
  platforms: PlatformRow[];
  troubleshooting: TroubleshootingIssue[];
  top_causes?: DiagnosedCause[];
  links: Record<string, string[]>;
};

export type ChannelHealthItem = {
  key: string;
  channel: string;
  surface: string;
  destination: string;
  pixel_id?: string;
  status: string;
  failure_rate_pct: number;
  minutes_since_last_event: number;
  total_events: number;
  error_events: number;
  last_event_at: string;
  event_counts: Record<string, number>;
};

export type RecentChannelEvent = {
  channel?: string;
  surface?: string;
  destination?: string;
  event_name?: string;
  status?: string;
  observed_at?: string;
  error_message?: string;
};

export type UiModel = {
  ok: boolean;
  runtime_mode?: string;
  parity?: {
    matched_rate_pct?: number;
    mismatch_rate_pct?: number;
    status?: string;
    total_pairs?: number;
  };
  browser_parity?: {
    matched_rate_pct?: number;
    mismatch_rate_pct?: number;
    volume_match_pct?: number;
    fuzzy_paired?: number;
    cart_total_coverage_pct?: number;
    product_id_coverage_pct?: number;
    paired_events?: number;
    synapse_events?: number;
    elevar_events?: number;
    status?: string;
    by_event?: Array<{ event: string; synapse: number; elevar: number }>;
  };
  platforms?: PlatformMatrix;
  channels?: {
    total_channels?: number;
    warning_channels?: number;
    status?: string;
    totals?: {
      tracked_integrations?: number;
      healthy?: number;
      warning?: number;
      critical?: number;
    };
    channels?: ChannelHealthItem[];
  };
  troubleshooting?: {
    issues?: TroubleshootingIssue[];
    links?: Record<string, string[]> | Array<{ label: string; href: string }>;
  };
  launch_readiness?: {
    status?: string;
    rationale?: string[];
    checks?: Array<{ id?: string; status?: string; detail?: string }>;
  };
  recent?: {
    channel_events?: RecentChannelEvent[];
    browser_events?: unknown[];
    shadow_comparisons?: unknown[];
  };
};

export async function getOpsConnection(): Promise<Record<string, unknown>> {
  return requestJson<Record<string, unknown>>("/ops/connection", "GET");
}

export async function wireShop(shop = "gcw-dev.myshopify.com"): Promise<Record<string, unknown>> {
  return requestJson<Record<string, unknown>>(`/ops/wire?shop=${encodeURIComponent(shop)}`, "POST");
}

export async function seedDemoPlatformTraffic(): Promise<{ ok: boolean; seeded: number }> {
  return requestJson<{ ok: boolean; seeded: number }>("/compare/demo-seed", "POST");
}

export async function getPlatformMatrix(): Promise<PlatformMatrix> {
  const data = await request<{ ok: boolean; matrix: PlatformMatrix }>("/compare/platforms");
  return data.matrix;
}

export async function getCompareUiModel(limit = 100): Promise<UiModel> {
  return request<UiModel>(`/compare/ui-model?limit=${limit}`);
}
