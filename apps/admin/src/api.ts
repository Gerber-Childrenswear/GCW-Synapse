export type RuntimeStatus = {
  status: string;
  webhooksReceived: number;
  eventsGenerated: number;
  dbConnected: boolean;
  uptime: number;
  runtimeMode?: string;
  vendorAdapters: Array<{ name: string; enabled: boolean }>;
};

export type ReadinessCheck = {
  id: string;
  title: string;
  status: "pass" | "fail";
  value: string;
  target: string;
  recommendation: string;
};

export type LaunchReadiness = {
  status: "go" | "hold";
  phase: "validation" | "cutover";
  summary: {
    checks_passed: number;
    checks_failed: number;
  };
  checks: ReadinessCheck[];
  counts: {
    paired_events: number;
    matched_pairs: number;
    mismatched_pairs: number;
    synapse_only: number;
    elevar_only: number;
  };
  actions: string[];
  generated_at: string;
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

export async function getLaunchReadiness(): Promise<LaunchReadiness> {
  const data = await request<{ report: LaunchReadiness }>("/launch/readiness");
  return data.report;
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
