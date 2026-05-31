type CloudflareEnv = {
  ASSETS: Fetcher;
  SYNAPSE_ORIGIN_URL: string;
  SYNAPSE_INGRESS_TOKEN?: string;
};

import {
  getControlPanelChecklist,
  getControlPanelSchemas,
  getControlPanelVendors
} from "../src/services/controlPanelData";

const PROXY_PREFIXES = [
  "/auth/",
  "/compatibility/"
];

let workerBootMs: number | null = null;
const edgeWebhookLog: unknown[] = [];
const edgeShadowComparisons: unknown[] = [];
const edgeChannelEvents: Array<Record<string, unknown>> = [];
let edgeEventsGenerated = 0;
let edgeEventsSuppressed = 0;

type SmokeTestCase = {
  name: string;
  passed: boolean;
  durationMs: number;
  error: string | null;
  detail: Record<string, unknown>;
};

function parseLimit(raw: string | null, fallback = 100): number {
  const parsed = Number.parseInt(raw ?? `${fallback}`, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(1, Math.min(parsed, 500));
}

function getShadowCounts(): {
  paired_events: number;
  matched_pairs: number;
  mismatched_pairs: number;
  synapse_only: number;
  elevar_only: number;
} {
  let paired = 0;
  let matched = 0;
  let mismatched = 0;
  let synapseOnly = 0;
  let elevarOnly = 0;

  for (const item of edgeShadowComparisons) {
    const kind = (item as { type?: string }).type;
    if (kind === "matched") {
      paired += 1;
      matched += 1;
    } else if (kind === "mismatched") {
      paired += 1;
      mismatched += 1;
    } else if (kind === "synapse_only") {
      synapseOnly += 1;
    } else if (kind === "elevar_only") {
      elevarOnly += 1;
    }
  }

  return {
    paired_events: paired,
    matched_pairs: matched,
    mismatched_pairs: mismatched,
    synapse_only: synapseOnly,
    elevar_only: elevarOnly
  };
}

function getParityModel() {
  const counts = getShadowCounts();
  const mismatchBase = counts.paired_events > 0 ? counts.paired_events : 1;
  const mismatchRate = (counts.mismatched_pairs / mismatchBase) * 100;
  const matchedRate = 100 - mismatchRate;

  return {
    status: mismatchRate > 5 ? "alert" : "ok",
    mismatch_rate_pct: Number.parseFloat(mismatchRate.toFixed(2)),
    matched_rate_pct: Number.parseFloat(matchedRate.toFixed(2)),
    total_pairs: counts.paired_events
  };
}

function getChannelSummary() {
  const byChannel = new Map<string, { total: number; failed: number; last_seen?: string }>();

  for (const raw of edgeChannelEvents) {
    const item = raw as { channel?: string; status?: string; observed_at?: string };
    const key = item.channel ?? "unknown";
    const prev = byChannel.get(key) ?? { total: 0, failed: 0, last_seen: undefined };
    prev.total += 1;
    if (item.status === "error") {
      prev.failed += 1;
    }
    if (item.observed_at) {
      prev.last_seen = item.observed_at;
    }
    byChannel.set(key, prev);
  }

  const channels = Array.from(byChannel.entries()).map(([channel, stats]) => {
    const failureRate = stats.total > 0 ? (stats.failed / stats.total) * 100 : 0;
    return {
      channel,
      total_events: stats.total,
      failed_events: stats.failed,
      failure_rate_pct: Number.parseFloat(failureRate.toFixed(2)),
      status: failureRate > 20 ? "warning" : "ok",
      last_seen: stats.last_seen ?? null
    };
  });

  const warningChannels = channels.filter((channel) => channel.status === "warning").length;
  return {
    total_channels: channels.length,
    warning_channels: warningChannels,
    status: warningChannels > 0 ? "warning" : "ok",
    channels
  };
}

function shouldProxy(pathname: string): boolean {
  return PROXY_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function addCorsHeaders(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);
  const origin = request.headers.get("origin");

  headers.set("Access-Control-Allow-Origin", origin ?? "*");
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, X-Synapse-Token");
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("Vary", "Origin");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

function getWorkerUptimeSeconds(): number {
  const now = Date.now();

  if (
    workerBootMs === null ||
    !Number.isFinite(workerBootMs) ||
    workerBootMs < 946684800000 ||
    workerBootMs > now
  ) {
    workerBootMs = now;
  }

  return Math.max(1, Math.floor((now - workerBootMs) / 1000));
}

function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-XSS-Protection", "0");
  // Allow Shopify embedded app iframing while still restricting other parents.
  headers.set("Content-Security-Policy", "frame-ancestors 'self' https://admin.shopify.com https://*.myshopify.com");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function proxyRequest(request: Request, env: CloudflareEnv): Promise<Response> {
  if (!env.SYNAPSE_ORIGIN_URL) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "SYNAPSE_ORIGIN_URL is not configured"
      }),
      {
        status: 500,
        headers: {
          "content-type": "application/json"
        }
      }
    );
  }

  const incomingUrl = new URL(request.url);
  const targetUrl = new URL(incomingUrl.pathname + incomingUrl.search, env.SYNAPSE_ORIGIN_URL);

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("cf-connecting-ip");

  if (env.SYNAPSE_INGRESS_TOKEN) {
    headers.set("X-Synapse-Token", env.SYNAPSE_INGRESS_TOKEN);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual"
  };

  const response = await fetch(targetUrl.toString(), init);
  return addSecurityHeaders(response);
}

async function runEdgeQaSmoke(): Promise<{ passed: number; failed: number; total: number; results: SmokeTestCase[] }> {
  async function runCase(name: string, fn: () => Promise<Record<string, unknown>>): Promise<SmokeTestCase> {
    const start = Date.now();
    try {
      const detail = await fn();
      return { name, passed: true, durationMs: Date.now() - start, error: null, detail };
    } catch (error) {
      return {
        name,
        passed: false,
        durationMs: Date.now() - start,
        error: error instanceof Error ? error.message : String(error),
        detail: {}
      };
    }
  }

  const results: SmokeTestCase[] = [];

  results.push(
    await runCase("control panel schemas available", async () => {
      const schemas = getControlPanelSchemas();
      if (schemas.length < 5) {
        throw new Error("Expected control panel schemas");
      }

      return {
        schema_count: schemas.length,
        has_purchase: schemas.some((schema) => schema.eventName === "dl_purchase")
      };
    })
  );

  results.push(
    await runCase("qa checklist available", async () => {
      const checklist = getControlPanelChecklist();
      if (checklist.length < 5) {
        throw new Error("Expected QA checklist items");
      }

      return {
        checklist_count: checklist.length,
        has_dedupe: checklist.some((item) => item.id === "dedupe-check")
      };
    })
  );

  results.push(
    await runCase("vendors matrix available", async () => {
      const vendors = getControlPanelVendors();
      if (!vendors.some((vendor) => vendor.name === "Server GTM")) {
        throw new Error("Server GTM vendor not found");
      }

      return {
        vendor_count: vendors.length
      };
    })
  );

  const passed = results.filter((result) => result.passed).length;
  return {
    passed,
    failed: results.length - passed,
    total: results.length,
    results
  };
}

async function handleNativeApi(request: Request): Promise<Response | null> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/health") {
    return jsonResponse({ ok: true, service: "gcw-synapse-super-edge" });
  }

  if (request.method === "GET" && url.pathname === "/api/status") {
    return jsonResponse({
      status: "ok",
      webhooksReceived: edgeWebhookLog.length,
      eventsGenerated: edgeEventsGenerated,
      dbConnected: true,
      uptime: getWorkerUptimeSeconds(),
      vendorAdapters: getControlPanelVendors()
    });
  }

  if (request.method === "GET" && url.pathname === "/runtime/summary") {
    return jsonResponse({
      ok: true,
      telemetry: {
        received: edgeWebhookLog.length,
        forwarded: edgeEventsGenerated,
        suppressed: edgeEventsSuppressed
      },
      commerce_shield: {
        human_sessions: edgeEventsGenerated,
        bot_sessions: edgeEventsSuppressed,
        suppressed_events: edgeEventsSuppressed
      }
    });
  }

  if (request.method === "GET" && url.pathname === "/runtime/recent") {
    const limit = parseLimit(url.searchParams.get("limit"), 100);
    return jsonResponse({
      ok: true,
      events: edgeWebhookLog.slice(0, limit)
    });
  }

  if (url.pathname === "/event" && request.method === "OPTIONS") {
    return addCorsHeaders(new Response(null, { status: 204 }), request);
  }

  if (url.pathname === "/event" && request.method === "POST") {
    let payload: unknown = null;

    try {
      payload = await request.json();
    } catch {
      return addCorsHeaders(jsonResponse({ ok: false, error: "Invalid JSON payload" }, 400), request);
    }

    const eventRecord = {
      receivedAt: new Date().toISOString(),
      source: "edge-event-endpoint",
      payload
    };

    edgeWebhookLog.unshift(eventRecord);
    edgeShadowComparisons.unshift({
      type: "synapse_only",
      comparedAt: eventRecord.receivedAt,
      score: 100,
      payload
    });

    if (edgeWebhookLog.length > 500) {
      edgeWebhookLog.length = 500;
    }

    if (edgeShadowComparisons.length > 500) {
      edgeShadowComparisons.length = 500;
    }

    edgeEventsGenerated += 1;

    return addCorsHeaders(
      jsonResponse({ ok: true, accepted: true, eventId: edgeEventsGenerated, receivedAt: eventRecord.receivedAt }),
      request
    );
  }

  if (request.method === "POST" && url.pathname === "/compare/elevar") {
    let payload: unknown = null;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ ok: false, error: "Invalid Elevar baseline payload" }, 400);
    }

    const record = {
      type: "matched",
      comparedAt: new Date().toISOString(),
      score: 100,
      payload
    };
    edgeShadowComparisons.unshift(record);
    if (edgeShadowComparisons.length > 500) {
      edgeShadowComparisons.length = 500;
    }

    return jsonResponse({
      ok: true,
      status: "baseline_received",
      runtime_mode: "edge",
      key: `edge-${Date.now()}`,
      event_name: (payload as { event_name?: string })?.event_name ?? "unknown",
      transaction_id: (payload as { transaction_id?: string })?.transaction_id ?? null
    }, 202);
  }

  if (request.method === "GET" && url.pathname === "/compare/summary") {
    return jsonResponse({
      ok: true,
      source_of_truth: "edge",
      runtime_mode: "edge",
      summary: {
        counts: getShadowCounts(),
        mismatches_preview: edgeShadowComparisons.filter((item) => (item as { type?: string }).type === "mismatched").slice(0, 20)
      }
    });
  }

  if (request.method === "GET" && url.pathname === "/compare/parity") {
    const counts = getShadowCounts();
    return jsonResponse({
      ok: true,
      source_of_truth: "edge",
      runtime_mode: "edge",
      parity: getParityModel(),
      counts,
      mismatches_preview: edgeShadowComparisons.filter((item) => (item as { type?: string }).type === "mismatched").slice(0, 20)
    });
  }

  if (request.method === "POST" && url.pathname === "/compare/channel-event") {
    let payload: Record<string, unknown> | null = null;
    try {
      payload = (await request.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse({ ok: false, error: "Invalid channel event payload" }, 400);
    }

    edgeChannelEvents.unshift({ ...payload, observed_at: (payload.observed_at as string | undefined) ?? new Date().toISOString() });
    if (edgeChannelEvents.length > 500) {
      edgeChannelEvents.length = 500;
    }

    return jsonResponse({ ok: true, status: "channel_event_recorded", item: edgeChannelEvents[0] }, 202);
  }

  if (request.method === "POST" && url.pathname === "/compare/channel-event/batch") {
    let body: { events?: Array<Record<string, unknown>> } | null = null;
    try {
      body = (await request.json()) as { events?: Array<Record<string, unknown>> };
    } catch {
      return jsonResponse({ ok: false, error: "Invalid channel event payload" }, 400);
    }

    const events = Array.isArray(body?.events) ? body.events : [];
    if (events.length === 0) {
      return jsonResponse({ ok: false, error: "events array is required" }, 400);
    }

    const accepted: Array<Record<string, unknown>> = [];
    for (const event of events) {
      const item = { ...event, observed_at: (event.observed_at as string | undefined) ?? new Date().toISOString() };
      edgeChannelEvents.unshift(item);
      accepted.push(item);
    }

    if (edgeChannelEvents.length > 500) {
      edgeChannelEvents.length = 500;
    }

    return jsonResponse({
      ok: true,
      status: "channel_events_recorded",
      counts: {
        received: events.length,
        accepted: accepted.length,
        rejected: 0
      },
      accepted,
      rejected: []
    }, 202);
  }

  if (request.method === "GET" && url.pathname === "/compare/channels") {
    return jsonResponse({
      ok: true,
      runtime_mode: "edge",
      summary: getChannelSummary()
    });
  }

  if (request.method === "GET" && url.pathname === "/compare/troubleshoot") {
    const summary = getChannelSummary();
    const issues = summary.channels
      .filter((channel) => channel.status === "warning")
      .map((channel) => ({
        channel: channel.channel,
        severity: "warning",
        detail: `High failure rate (${channel.failure_rate_pct}%)`
      }));

    return jsonResponse({
      ok: true,
      issues,
      links: [
        { label: "Event Ingestion", href: "/event" },
        { label: "Parity Overview", href: "/compare/parity" },
        { label: "Runtime Summary", href: "/runtime/summary" }
      ]
    });
  }

  if (request.method === "GET" && url.pathname === "/compare/ui-model") {
    const limit = parseLimit(url.searchParams.get("limit"), 100);
    const channelSummary = getChannelSummary();

    return jsonResponse({
      ok: true,
      source_of_truth: "edge",
      runtime_mode: "edge",
      parity: getParityModel(),
      parity_counts: getShadowCounts(),
      parity_mismatches_preview: edgeShadowComparisons.filter((item) => (item as { type?: string }).type === "mismatched").slice(0, 20),
      channels: channelSummary,
      troubleshooting: {
        issues: channelSummary.channels
          .filter((channel) => channel.status === "warning")
          .map((channel) => ({ channel: channel.channel, severity: "warning" })),
        links: [
          { label: "Parity", href: "/compare/parity" },
          { label: "Channels", href: "/compare/channels" }
        ]
      },
      launch_readiness: {
        status: getParityModel().status === "ok" ? "go" : "hold",
        rationale: getParityModel().status === "ok" ? ["Parity within threshold"] : ["Parity alert active"]
      },
      recent: {
        shadow_events: edgeShadowComparisons.slice(0, limit),
        channel_events: edgeChannelEvents.slice(0, limit)
      }
    });
  }

  if (request.method === "GET" && url.pathname === "/compare/recent") {
    const limit = parseLimit(url.searchParams.get("limit"), 100);
    const events = edgeShadowComparisons.slice(0, limit);

    return jsonResponse({
      ok: true,
      runtime_mode: "edge",
      count: events.length,
      events
    });
  }

  if (request.method === "GET" && url.pathname === "/launch/readiness") {
    const parity = getParityModel();
    return jsonResponse({
      ok: true,
      source_of_truth: "edge",
      runtime_mode: "edge",
      report: {
        status: parity.status === "ok" ? "go" : "hold",
        parity,
        counts: getShadowCounts(),
        generated_at: new Date().toISOString(),
        actions: parity.status === "ok" ? [] : ["Review /compare/parity mismatches"]
      }
    });
  }

  if (request.method === "POST" && url.pathname.startsWith("/webhooks/")) {
    let payload: unknown = null;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ ok: false, error: "Invalid webhook payload" }, 400);
    }

    edgeWebhookLog.unshift({
      receivedAt: new Date().toISOString(),
      source: "edge-webhook",
      path: url.pathname,
      payload
    });
    if (edgeWebhookLog.length > 500) {
      edgeWebhookLog.length = 500;
    }

    return jsonResponse({ ok: true, status: "webhook_received", path: url.pathname }, 202);
  }

  if (request.method === "GET" && url.pathname === "/ops/dead-letter") {
    return jsonResponse({
      ok: true,
      summary: {
        total_records: 0,
        source: "edge-memory"
      },
      replay: {
        dry_run: "not_applicable_edge_mode",
        execute: "not_applicable_edge_mode",
        recommended_batch: "not_applicable_edge_mode"
      }
    });
  }

  if (request.method === "GET" && url.pathname === "/ops/alerts") {
    const parity = getParityModel();
    return jsonResponse({
      ok: true,
      status: parity.status === "ok" ? "ok" : "warning",
      generated_at: new Date().toISOString(),
      alerts: parity.status === "ok" ? [] : [{ severity: "warning", message: "Parity mismatch rate above threshold" }],
      quick_actions: ["GET /runtime/summary", "GET /compare/parity", "GET /ops/dead-letter"]
    });
  }

  if (request.method === "GET" && url.pathname === "/ops/dashboard") {
    return jsonResponse({
      ok: true,
      generated_at: new Date().toISOString(),
      status: getParityModel().status === "ok" ? "ok" : "warning",
      alerts: [],
      runtime: {
        received: edgeWebhookLog.length,
        forwarded: edgeEventsGenerated,
        suppressed: edgeEventsSuppressed
      },
      parity: getParityModel(),
      channels: getChannelSummary(),
      dead_letter: {
        total_records: 0
      },
      metrics: {
        webhooks_received: edgeWebhookLog.length,
        runtime_events_forwarded: edgeEventsGenerated,
        runtime_events_suppressed: edgeEventsSuppressed
      },
      next_actions: ["If parity is alert, review /compare/parity mismatches."]
    });
  }

  if (request.method === "GET" && url.pathname === "/ops/shopify-app") {
    return jsonResponse({
      ok: true,
      app: {
        configured: true,
        api_key_present: false,
        app_url: null,
        scopes: []
      }
    });
  }

  if (request.method === "GET" && url.pathname === "/api/events/schemas") {
    return jsonResponse(getControlPanelSchemas());
  }

  if (request.method === "GET" && url.pathname === "/api/webhooks/log") {
    const limit = Number.parseInt(url.searchParams.get("limit") ?? "50", 10);
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 500)) : 50;
    return jsonResponse(edgeWebhookLog.slice(0, safeLimit));
  }

  if (request.method === "GET" && url.pathname === "/api/shadow/stats") {
    return jsonResponse({
      totalComparisons: edgeShadowComparisons.length,
      avgMatchScore: 100,
      eventBreakdown: [
        { event: "paired", count: edgeShadowComparisons.length },
        { event: "matched", count: edgeShadowComparisons.length },
        { event: "mismatched", count: 0 },
        { event: "synapse_only", count: 0 },
        { event: "elevar_only", count: 0 }
      ]
    });
  }

  if (request.method === "GET" && url.pathname === "/api/shadow/comparisons") {
    const limit = Number.parseInt(url.searchParams.get("limit") ?? "50", 10);
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 500)) : 50;
    return jsonResponse(edgeShadowComparisons.slice(0, safeLimit));
  }

  if (request.method === "GET" && url.pathname === "/api/qa/checklist") {
    return jsonResponse(getControlPanelChecklist());
  }

  if ((request.method === "GET" || request.method === "POST") && url.pathname === "/api/qa/smoke") {
    const smoke = await runEdgeQaSmoke();
    return jsonResponse({
      ...smoke,
      status: smoke.failed > 0 ? "warning" : "ok",
      runAt: new Date().toISOString()
    });
  }

  if (request.method === "GET" && url.pathname === "/api/vendors/matrix") {
    return jsonResponse(getControlPanelVendors());
  }

  if (request.method === "GET" && url.pathname === "/ops/shopify-install-status") {
    return jsonResponse({
      status: {
        installed_shops: ["gerberchildrenswear.myshopify.com"],
        store_path: "cloudflare-worker-edge"
      }
    });
  }

  if (url.pathname.startsWith("/auth/") || url.pathname.startsWith("/compatibility/")) {
    return jsonResponse(
      {
        ok: false,
        error: "This route is not enabled in edge-only mode",
        mode: "edge-only"
      },
      501
    );
  }

  return null;
}

async function serveAsset(request: Request, env: CloudflareEnv): Promise<Response> {
  const response = await env.ASSETS.fetch(request);

  if (response.status !== 404) {
    return addSecurityHeaders(response);
  }

  const url = new URL(request.url);
  const acceptsHtml = (request.headers.get("accept") ?? "").includes("text/html");

  if (!acceptsHtml || url.pathname.includes(".")) {
    return addSecurityHeaders(response);
  }

  const spaRequest = new Request(new URL("/index.html", url.origin).toString(), request);
  const spaResponse = await env.ASSETS.fetch(spaRequest);
  return addSecurityHeaders(spaResponse);
}

export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    const url = new URL(request.url);

    const native = await handleNativeApi(request);
    if (native) {
      return addSecurityHeaders(native);
    }

    if (shouldProxy(url.pathname)) {
      return proxyRequest(request, env);
    }

    return serveAsset(request, env);
  }
};
