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
  "/event",
  "/runtime/",
  "/compare/",
  "/ops/",
  "/auth/",
  "/compatibility/",
  "/launch/",
  "/webhooks/"
];

const workerBootMs = Date.now();
const edgeWebhookLog: unknown[] = [];
const edgeShadowComparisons: unknown[] = [];

type SmokeTestCase = {
  name: string;
  passed: boolean;
  durationMs: number;
  error: string | null;
  detail: Record<string, unknown>;
};

function shouldProxy(pathname: string): boolean {
  if (pathname === "/event") {
    return true;
  }

  return PROXY_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-XSS-Protection", "0");

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
      eventsGenerated: edgeShadowComparisons.length,
      dbConnected: true,
      uptime: Math.max(1, Math.floor((Date.now() - workerBootMs) / 1000)),
      vendorAdapters: getControlPanelVendors()
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
