export type RuntimeSummary = {
  telemetry: {
    total: number;
    forwarded: number;
    suppressed: number;
    duplicate: number;
    last_event_at?: string;
  };
  commerce_shield: {
    human_sessions: number;
    bot_sessions: number;
    suppressed_events: number;
  };
};

const BASE_URL = (import.meta.env.VITE_SYNAPSE_BASE_URL as string | undefined) ?? "http://localhost:4000";
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

export async function getRuntimeSummary(): Promise<RuntimeSummary> {
  return request<RuntimeSummary>("/runtime/summary");
}

export async function getRuntimeRecent(limit = 50): Promise<unknown[]> {
  const data = await request<{ events: unknown[] }>(`/runtime/recent?limit=${limit}`);
  return data.events;
}

export async function getValidationModel(): Promise<unknown> {
  return request("/compare/ui-model");
}
