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

const BASE_URL = (import.meta.env.VITE_SYNAPSE_BASE_URL as string | undefined) ?? "";
const INGRESS_TOKEN = (import.meta.env.VITE_SYNAPSE_TOKEN as string | undefined) ?? "";

async function request<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (INGRESS_TOKEN) {
    headers["X-Synapse-Token"] = INGRESS_TOKEN;
  }

  const res = await fetch(`${BASE_URL}${path}`, { headers });
  if (!res.ok) {
    throw new Error(`Request failed: ${path}`);
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
    throw new Error(`Request failed: ${path}`);
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
