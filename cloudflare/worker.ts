type CloudflareEnv = {
  ASSETS: Fetcher;
  SYNAPSE_ORIGIN_URL: string;
  SYNAPSE_INGRESS_TOKEN?: string;
};

const PROXY_PREFIXES = [
  "/health",
  "/event",
  "/runtime/",
  "/compare/",
  "/ops/",
  "/auth/",
  "/compatibility/",
  "/launch/",
  "/api/",
  "/webhooks/"
];

function shouldProxy(pathname: string): boolean {
  if (pathname === "/health" || pathname === "/event") {
    return true;
  }

  return PROXY_PREFIXES.some((prefix) => pathname.startsWith(prefix));
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

    if (shouldProxy(url.pathname)) {
      return proxyRequest(request, env);
    }

    return serveAsset(request, env);
  }
};
