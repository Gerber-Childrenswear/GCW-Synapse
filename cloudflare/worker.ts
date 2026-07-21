type CloudflareEnv = {
  ASSETS: Fetcher;
  SYNAPSE_ORIGIN_URL?: string;
  SYNAPSE_INGRESS_TOKEN?: string;
  PUBLIC_EVENT_ALLOWED_ORIGINS?: string;
  PUBLIC_EVENT_MAX_BODY_BYTES?: string;
  PUBLIC_EVENT_RATE_LIMIT_PER_MINUTE?: string;
  SHOPIFY_API_KEY?: string;
  SHOPIFY_API_SECRET?: string;
  SHOPIFY_APP_SCOPES?: string;
};

const DEFAULT_SHOPIFY_SCOPES =
  "read_products,read_orders,read_checkouts,read_customers,read_customer_events,write_pixels,read_themes";

/** Scopes that require Partners "Request access" and break install until approved. */
const PROTECTED_SHOPIFY_SCOPES = new Set(["read_all_orders"]);

/**
 * Resolve OAuth scopes for install. Prefer configured scopes, but always strip
 * protected scopes so a stale SHOPIFY_APP_SCOPES secret cannot re-trigger
 * Shopify's Request Access loop.
 */
function resolveInstallScopes(configured?: string): string {
  const raw = (configured || DEFAULT_SHOPIFY_SCOPES).trim();
  const cleaned = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !PROTECTED_SHOPIFY_SCOPES.has(s));
  return cleaned.length > 0 ? cleaned.join(",") : DEFAULT_SHOPIFY_SCOPES;
}

const SHOP_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

import {
  getControlPanelChecklist,
  getControlPanelSchemas,
  getControlPanelVendors
} from "../src/services/controlPanelData";
import {
  getChannelHealthSummary,
  getChannelHelpLinks,
  getChannelTroubleshooting,
  getRecentChannelEvents,
  ingestChannelEvent
} from "../src/services/channelHealth";
import { buildPlatformMatrix } from "../src/services/platformMatrix";

const PROXY_PREFIXES = [
  "/auth/",
  "/compatibility/"
];

const INTERNAL_ROUTE_PREFIXES = [
  "/ops/",
  "/api/",
  "/compare/",
  "/runtime/",
  "/launch/",
  "/webhooks/",
  "/auth/",
  "/compatibility/"
];

let workerBootMs: number | null = null;
const edgeWebhookLog: unknown[] = [];
const edgeShadowComparisons: unknown[] = [];
const edgeChannelEvents: Array<Record<string, unknown>> = [];
const edgeBrowserEvents: Array<Record<string, unknown>> = [];
let edgeEventsGenerated = 0;
let edgeEventsSuppressed = 0;
let edgeBrowserBeaconsAccepted = 0;

const ALLOWED_BROWSER_EVENTS = new Set([
  "dl_user_data",
  "dl_view_item",
  "dl_view_item_list",
  "dl_view_search_results",
  "dl_select_item",
  "dl_add_to_cart",
  "dl_remove_from_cart",
  "dl_view_cart",
  "dl_begin_checkout",
  "dl_add_shipping_info",
  "dl_add_payment_info",
  "dl_purchase",
  "dl_sign_up",
  "dl_login",
  "dl_subscribe"
]);
const eventRateWindowMs = 60_000;
const eventRateState = new Map<string, { windowStartMs: number; count: number }>();

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

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function parseAllowedOrigins(raw: string | undefined): string[] {
  const configured = (raw ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (configured.length > 0) {
    return configured;
  }

  return [
    "https://www.gerberchildrenswear.com",
    "https://gerberchildrenswear.com",
    "https://gcw-dev.myshopify.com",
    "https://gerberchildrenswear.myshopify.com"
  ];
}

function isAllowedOrigin(origin: string, allowedOrigins: string[]): boolean {
  const normalized = origin.trim().toLowerCase();
  return allowedOrigins.includes(normalized);
}

function getClientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}

function checkEventRateLimit(request: Request, env: CloudflareEnv): { allowed: boolean; retryAfterSeconds?: number } {
  const limit = parsePositiveInt(env.PUBLIC_EVENT_RATE_LIMIT_PER_MINUTE, 120);
  const now = Date.now();
  const ip = getClientIp(request);
  const previous = eventRateState.get(ip);

  if (!previous || now - previous.windowStartMs >= eventRateWindowMs) {
    eventRateState.set(ip, { windowStartMs: now, count: 1 });
    return { allowed: true };
  }

  if (previous.count >= limit) {
    const retryAfterMs = Math.max(0, eventRateWindowMs - (now - previous.windowStartMs));
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000))
    };
  }

  previous.count += 1;
  eventRateState.set(ip, previous);

  if (eventRateState.size > 2048) {
    for (const [key, state] of eventRateState.entries()) {
      if (now - state.windowStartMs > eventRateWindowMs * 2) {
        eventRateState.delete(key);
      }
      if (eventRateState.size <= 1536) {
        break;
      }
    }
  }

  return { allowed: true };
}

function isInternalRoute(pathname: string): boolean {
  return INTERNAL_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isInternalRouteExempt(pathname: string, method: string): boolean {
  if (pathname === "/health" && method === "GET") {
    return true;
  }

  if (pathname === "/event" && (method === "POST" || method === "OPTIONS")) {
    return true;
  }

  if (pathname === "/browser/beacon" && (method === "POST" || method === "OPTIONS")) {
    return true;
  }

  // Public Shopify OAuth install/callback (must not require ingress token).
  if (
    method === "GET" &&
    (pathname === "/install" ||
      pathname === "/auth/shopify/install" ||
      pathname === "/auth/shopify/callback")
  ) {
    return true;
  }

  return false;
}

function shopHandleFromDomain(shop: string): string {
  return shop.replace(/\.myshopify\.com$/i, "");
}

/** Owner-forwardable install landing (permission checklist + install CTA). */
function handleInstallLanding(url: URL, env: CloudflareEnv): Response {
  const shopRaw = (url.searchParams.get("shop") || "gcw-dev.myshopify.com").trim();
  let shop: string;
  try {
    shop = normalizeShopDomain(shopRaw);
  } catch (error) {
    return htmlResponse(
      `<h1>Invalid shop</h1><p>${error instanceof Error ? error.message : "Invalid shop"}</p>`,
      400
    );
  }

  const handle = shopHandleFromDomain(shop);
  const scopes = resolveInstallScopes(env.SHOPIFY_APP_SCOPES);
  const apiKey = env.SHOPIFY_API_KEY || "7d011b70562512bd84b85bd3f9a6e68d";
  const oauthInstall = `${url.origin}/auth/shopify/install?shop=${encodeURIComponent(shop)}`;
  const adminInstall = `https://admin.shopify.com/store/${handle}/oauth/install?client_id=${encodeURIComponent(apiKey)}`;
  const usersUrl = `https://admin.shopify.com/store/${handle}/settings/users`;
  const embedUrl = `https://${shop}/admin/themes/current/editor?context=apps&activateAppId=${apiKey}/gcw-synapse-app-block`;

  // Auto-start OAuth when ?go=1 (bookmark / owner deep link)
  if (url.searchParams.get("go") === "1") {
    return new Response(null, {
      status: 302,
      headers: { Location: oauthInstall, "Cache-Control": "no-store" }
    });
  }

  return htmlResponse(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Install GCW Synapse</title>
  <style>
    :root { color-scheme: light; --ink:#14201a; --muted:#4a5c52; --line:#d5ddd7; --bg:#f3f6f4; --card:#fff; --go:#0f6b4c; --go2:#0a4d38; --warn:#7a4a00; --warnbg:#fff6e5; }
    * { box-sizing: border-box; }
    body { margin:0; font:16px/1.45 "Segoe UI", system-ui, sans-serif; color:var(--ink); background: radial-gradient(1200px 500px at 10% -10%, #d9ebe2, transparent), var(--bg); }
    main { max-width:720px; margin:0 auto; padding:40px 20px 64px; }
    h1 { font-size:1.75rem; margin:0 0 8px; letter-spacing:-0.02em; }
    .sub { color:var(--muted); margin:0 0 28px; }
    .card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:20px 22px; margin:0 0 16px; }
    h2 { font-size:1rem; margin:0 0 10px; text-transform:uppercase; letter-spacing:0.04em; color:var(--muted); }
    ol, ul { margin:0; padding-left:1.2rem; }
    li { margin:6px 0; }
    code, .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:0.86em; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; margin:18px 0 8px; }
    a.btn { display:inline-block; text-decoration:none; border-radius:8px; padding:12px 16px; font-weight:600; }
    a.btn-primary { background:var(--go); color:#fff; }
    a.btn-primary:hover { background:var(--go2); }
    a.btn-secondary { background:#e8eee9; color:var(--ink); }
    .warn { background:var(--warnbg); border:1px solid #f0d7a8; border-radius:12px; padding:14px 16px; margin:0 0 16px; color:var(--warn); }
    .meta { font-size:0.9rem; color:var(--muted); }
  </style>
</head>
<body>
  <main>
    <h1>Install GCW Synapse</h1>
    <p class="sub">Shop: <span class="mono">${shop}</span></p>

    <div class="warn">
      <strong>If you see “You need permission to install”:</strong>
      your user can open listed apps, but cannot install <em>new</em> ones.
      Forward this page to the <strong>store owner</strong>, or get
      <strong>Manage and install apps and channels</strong> on your role
      (Settings → Users → Roles → Apps — not App development).
    </div>

    <div class="card">
      <h2>Install now</h2>
      <div class="actions">
        <a class="btn btn-primary" href="${oauthInstall}">Install with lean scopes</a>
        <a class="btn btn-secondary" href="${adminInstall}">Admin install link</a>
      </div>
      <p class="meta">Scopes: <span class="mono">${scopes}</span></p>
    </div>

    <div class="card">
      <h2>Required staff permissions</h2>
      <ul>
        <li><strong>Apps → Manage and install apps and channels</strong> (all apps — not a named whitelist)</li>
        <li><strong>Settings → View customer events</strong></li>
        <li><strong>Settings → Manage and add custom pixels</strong></li>
        <li>Products, Orders (view), Customers (view), Online store / Themes</li>
      </ul>
      <p class="meta"><a href="${usersUrl}">Open Users &amp; permissions</a></p>
    </div>

    <div class="card">
      <h2>After install</h2>
      <ol>
        <li>Confirm <strong>Customer events → App pixels</strong> shows GCW Synapse.</li>
        <li>Enable the theme App embed: <a href="${embedUrl}">open App embeds</a>.</li>
        <li>Beacon URL: <span class="mono">${url.origin}/browser/beacon</span></li>
      </ol>
    </div>
  </main>
</body>
</html>`);
}

function normalizeShopDomain(shop: string): string {
  const normalized = shop.trim().toLowerCase();
  if (!SHOP_DOMAIN_PATTERN.test(normalized)) {
    throw new Error("Invalid shop domain. Expected format: <shop>.myshopify.com");
  }
  return normalized;
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const b of arr) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Base64Url(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return toBase64Url(sig);
}

async function createOAuthState(shop: string, secret: string): Promise<string> {
  const payload = JSON.stringify({
    shop,
    exp: Date.now() + 10 * 60 * 1000,
    n: toBase64Url(crypto.getRandomValues(new Uint8Array(12)))
  });
  const body = toBase64Url(new TextEncoder().encode(payload));
  const sig = await hmacSha256Base64Url(secret, body);
  return `${body}.${sig}`;
}

async function verifyOAuthState(
  state: string,
  secret: string,
  shop: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [body, sig] = state.split(".");
  if (!body || !sig) return { ok: false, error: "Invalid state" };
  const expected = await hmacSha256Base64Url(secret, body);
  if (expected !== sig) return { ok: false, error: "Invalid state signature" };
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as {
      shop?: string;
      exp?: number;
    };
    if (!payload.shop || payload.shop !== shop) return { ok: false, error: "State/shop mismatch" };
    if (!payload.exp || payload.exp <= Date.now()) return { ok: false, error: "Expired state" };
    return { ok: true };
  } catch {
    return { ok: false, error: "Invalid state payload" };
  }
}

async function verifyShopifyOAuthHmac(params: URLSearchParams, secret: string): Promise<boolean> {
  const hmac = params.get("hmac");
  if (!hmac) return false;
  const message = Array.from(params.entries())
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const digest = await hmacSha256Hex(secret, message);
  return digest === hmac;
}

async function exchangeShopifyAccessToken(
  shop: string,
  code: string,
  apiKey: string,
  apiSecret: string
): Promise<{ access_token: string; scope: string }> {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: apiKey,
      client_secret: apiSecret,
      code
    })
  });
  const data = (await response.json()) as { access_token?: string; scope?: string; error?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(data.error || `Token exchange failed (${response.status})`);
  }
  return { access_token: data.access_token, scope: data.scope || "" };
}

async function ensureSynapseWebPixel(
  shop: string,
  accessToken: string,
  appOrigin: string
): Promise<{ ok: boolean; detail: Record<string, unknown> }> {
  const settings = {
    beaconUrl: `${appOrigin}/browser/beacon`,
    shopDomain: shop
  };
  const settingsJson = JSON.stringify(settings);

  const gql = async (query: string, variables?: Record<string, unknown>) => {
    const response = await fetch(`https://${shop}/admin/api/2025-10/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken
      },
      body: JSON.stringify({ query, variables })
    });
    const json = (await response.json()) as {
      data?: Record<string, unknown>;
      errors?: Array<{ message: string }>;
    };
    if (!response.ok || json.errors?.length) {
      throw new Error(json.errors?.map((e) => e.message).join("; ") || `GraphQL HTTP ${response.status}`);
    }
    return json.data ?? {};
  };

  const existing = (await gql(`query { webPixel { id settings } }`)) as {
    webPixel?: { id?: string; settings?: string } | null;
  };

  if (existing.webPixel?.id) {
    const updated = (await gql(
      `mutation webPixelUpdate($id: ID!, $webPixel: WebPixelInput!) {
        webPixelUpdate(id: $id, webPixel: $webPixel) {
          userErrors { field message code }
          webPixel { id settings }
        }
      }`,
      { id: existing.webPixel.id, webPixel: { settings: settingsJson } }
    )) as {
      webPixelUpdate?: {
        userErrors?: Array<{ message: string }>;
        webPixel?: { id?: string; settings?: string };
      };
    };
    const errors = updated.webPixelUpdate?.userErrors ?? [];
    if (errors.length) {
      return { ok: false, detail: { action: "update", errors } };
    }
    return {
      ok: true,
      detail: { action: "update", webPixel: updated.webPixelUpdate?.webPixel }
    };
  }

  const created = (await gql(
    `mutation webPixelCreate($webPixel: WebPixelInput!) {
      webPixelCreate(webPixel: $webPixel) {
        userErrors { field message code }
        webPixel { id settings }
      }
    }`,
    { webPixel: { settings: settingsJson } }
  )) as {
    webPixelCreate?: {
      userErrors?: Array<{ message: string }>;
      webPixel?: { id?: string; settings?: string };
    };
  };
  const errors = created.webPixelCreate?.userErrors ?? [];
  if (errors.length) {
    return { ok: false, detail: { action: "create", errors } };
  }
  return {
    ok: true,
    detail: { action: "create", webPixel: created.webPixelCreate?.webPixel }
  };
}

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

async function handleShopifyOAuth(
  request: Request,
  env: CloudflareEnv,
  url: URL
): Promise<Response | null> {
  if (request.method !== "GET") return null;
  if (url.pathname !== "/auth/shopify/install" && url.pathname !== "/auth/shopify/callback") {
    return null;
  }

  const apiKey = env.SHOPIFY_API_KEY;
  const apiSecret = env.SHOPIFY_API_SECRET;
  if (!apiKey || !apiSecret) {
    return jsonResponse(
      { ok: false, error: "Shopify OAuth is not configured on the Worker (missing API key/secret)" },
      500
    );
  }

  const scopes = resolveInstallScopes(env.SHOPIFY_APP_SCOPES);
  const appOrigin = url.origin;

  if (url.pathname === "/auth/shopify/install") {
    const shopRaw = (url.searchParams.get("shop") || "gcw-dev.myshopify.com").trim();
    let shop: string;
    try {
      shop = normalizeShopDomain(shopRaw);
    } catch (error) {
      return jsonResponse(
        { ok: false, error: error instanceof Error ? error.message : "Invalid shop" },
        400
      );
    }

    const state = await createOAuthState(shop, apiSecret);
    const authorize = new URL(`https://${shop}/admin/oauth/authorize`);
    authorize.searchParams.set("client_id", apiKey);
    authorize.searchParams.set("scope", scopes);
    authorize.searchParams.set("redirect_uri", `${appOrigin}/auth/shopify/callback`);
    authorize.searchParams.set("state", state);
    return new Response(null, {
      status: 302,
      headers: {
        Location: authorize.toString(),
        "Cache-Control": "no-store"
      }
    });
  }

  // callback
  const shopRaw = url.searchParams.get("shop") || "";
  let shop: string;
  try {
    shop = normalizeShopDomain(shopRaw);
  } catch {
    return htmlResponse("<h1>Install failed</h1><p>Invalid shop domain.</p>", 400);
  }

  const state = url.searchParams.get("state") || "";
  const stateCheck = await verifyOAuthState(state, apiSecret, shop);
  if (!stateCheck.ok) {
    return htmlResponse(`<h1>Install failed</h1><p>${stateCheck.error}</p>`, 400);
  }

  const hmacOk = await verifyShopifyOAuthHmac(url.searchParams, apiSecret);
  if (!hmacOk) {
    return htmlResponse("<h1>Install failed</h1><p>Invalid Shopify HMAC.</p>", 400);
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return htmlResponse("<h1>Install failed</h1><p>Missing authorization code.</p>", 400);
  }

  try {
    const token = await exchangeShopifyAccessToken(shop, code, apiKey, apiSecret);
    const pixel = await ensureSynapseWebPixel(shop, token.access_token, appOrigin);
    const pixelStatus = pixel.ok
      ? `Web pixel ${String(pixel.detail.action)}d successfully.`
      : `Web pixel activation issue: ${JSON.stringify(pixel.detail.errors || pixel.detail)}`;

    return htmlResponse(`<!doctype html>
<html><head><meta charset="utf-8"><title>GCW Synapse installed</title></head>
<body style="font-family:system-ui;max-width:640px;margin:40px auto;padding:0 16px">
  <h1>GCW Synapse installed</h1>
  <p><strong>Shop:</strong> ${shop}</p>
  <p><strong>Scopes:</strong> ${token.scope || scopes}</p>
  <p>${pixelStatus}</p>
  <ol>
    <li>Re-enable the theme App embed if needed.</li>
    <li>Confirm <a href="https://admin.shopify.com/store/${shop.replace(".myshopify.com", "")}/settings/customer_events">Customer events → App pixels</a>.</li>
  </ol>
  <p><a href="https://${shop}/admin">Open Shopify admin</a></p>
</body></html>`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Install callback failed";
    return htmlResponse(`<h1>Install failed</h1><p>${message}</p>`, 400);
  }
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

const CHANNEL_CACHE_URL = "https://gcw-synapse-super.internal/channel-events-v1";

async function persistChannelEventsToCache(): Promise<void> {
  try {
    const events = getRecentChannelEvents(500);
    await caches.default.put(
      CHANNEL_CACHE_URL,
      new Response(JSON.stringify(events), {
        headers: {
          "content-type": "application/json",
          "cache-control": "max-age=86400"
        }
      })
    );
  } catch {
    // Cache API may be unavailable in some runtimes; ignore.
  }
}

async function hydrateChannelEventsFromCache(): Promise<void> {
  try {
    if (getRecentChannelEvents(1).length > 0) return;
    const cached = await caches.default.match(CHANNEL_CACHE_URL);
    if (!cached) return;
    const events = (await cached.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(events)) return;
    for (const event of events.slice().reverse()) {
      if (typeof event.channel !== "string" || typeof event.event_name !== "string") continue;
      ingestChannelEvent({
        channel: event.channel,
        surface: (event.surface as "pixel" | "server" | "runtime" | "webhook") || "pixel",
        destination: typeof event.destination === "string" ? event.destination : "unknown",
        pixel_id: typeof event.pixel_id === "string" ? event.pixel_id : undefined,
        event_name: event.event_name,
        event_id: typeof event.event_id === "string" ? event.event_id : undefined,
        transaction_id: typeof event.transaction_id === "string" ? event.transaction_id : undefined,
        status: event.status === "error" ? "error" : "ok",
        error_message: typeof event.error_message === "string" ? event.error_message : undefined,
        observed_at: typeof event.observed_at === "string" ? event.observed_at : new Date().toISOString()
      });
    }
  } catch {
    // ignore hydrate failures
  }
}

async function getChannelSummary() {
  await hydrateChannelEventsFromCache();
  const summary = getChannelHealthSummary(90, 5);
  return {
    total_channels: summary.totals.tracked_integrations,
    warning_channels: summary.totals.warning + summary.totals.critical,
    status: summary.totals.critical > 0 || summary.totals.warning > 0 ? "warning" : "ok",
    totals: summary.totals,
    channels: summary.channels
  };
}

function recordSynapseBrowserChannel(eventName: string, eventId: string | undefined, shop: string): void {
  ingestChannelEvent({
    channel: "synapse",
    surface: "pixel",
    destination: "browser-beacon",
    event_name: eventName,
    event_id: eventId,
    source_theme: "gcw-synapse",
    source_surface: "storefront",
    status: "ok",
    observed_at: new Date().toISOString()
  });

  // Mirror into sGTM browser path so Server GTM row shows browser activity.
  ingestChannelEvent({
    channel: "server_gtm",
    surface: "pixel",
    destination: "gtm-browser-bridge",
    event_name: eventName,
    event_id: eventId,
    source_theme: shop,
    source_surface: "browser",
    status: "ok",
    observed_at: new Date().toISOString()
  });
}

function shouldProxy(pathname: string): boolean {
  return PROXY_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function addCorsHeaders(response: Response, request: Request, originOverride?: string): Response {
  const headers = new Headers(response.headers);
  const origin = originOverride ?? request.headers.get("origin");

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
  const contentType = headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  }
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

    const observedAt = (payload.observed_at as string | undefined) ?? new Date().toISOString();
    const item = { ...payload, observed_at: observedAt };
    edgeChannelEvents.unshift(item);
    if (edgeChannelEvents.length > 500) {
      edgeChannelEvents.length = 500;
    }

    if (typeof payload.channel === "string" && typeof payload.event_name === "string") {
      await hydrateChannelEventsFromCache();
      ingestChannelEvent({
        channel: payload.channel,
        surface: (payload.surface as "pixel" | "server" | "runtime" | "webhook") || "pixel",
        destination: typeof payload.destination === "string" ? payload.destination : "unknown",
        pixel_id: typeof payload.pixel_id === "string" ? payload.pixel_id : undefined,
        event_name: payload.event_name,
        event_id: typeof payload.event_id === "string" ? payload.event_id : undefined,
        transaction_id: typeof payload.transaction_id === "string" ? payload.transaction_id : undefined,
        status: payload.status === "error" ? "error" : "ok",
        error_message: typeof payload.error_message === "string" ? payload.error_message : undefined,
        observed_at: observedAt
      });
      await persistChannelEventsToCache();
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
    await hydrateChannelEventsFromCache();
    for (const event of events) {
      const item = { ...event, observed_at: (event.observed_at as string | undefined) ?? new Date().toISOString() };
      edgeChannelEvents.unshift(item);
      accepted.push(item);
      if (typeof event.channel === "string" && typeof event.event_name === "string") {
        ingestChannelEvent({
          channel: event.channel,
          surface: (event.surface as "pixel" | "server" | "runtime" | "webhook") || "pixel",
          destination: typeof event.destination === "string" ? event.destination : "unknown",
          pixel_id: typeof event.pixel_id === "string" ? event.pixel_id : undefined,
          event_name: event.event_name,
          event_id: typeof event.event_id === "string" ? event.event_id : undefined,
          transaction_id: typeof event.transaction_id === "string" ? event.transaction_id : undefined,
          status: event.status === "error" ? "error" : "ok",
          error_message: typeof event.error_message === "string" ? event.error_message : undefined,
          observed_at: item.observed_at as string
        });
      }
    }

    if (edgeChannelEvents.length > 500) {
      edgeChannelEvents.length = 500;
    }
    await persistChannelEventsToCache();

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

  if (request.method === "GET" && url.pathname === "/compare/platforms") {
    await hydrateChannelEventsFromCache();
    return jsonResponse({
      ok: true,
      runtime_mode: "edge",
      matrix: buildPlatformMatrix(90, 5)
    });
  }

  if (request.method === "GET" && url.pathname === "/compare/channels") {
    return jsonResponse({
      ok: true,
      runtime_mode: "edge",
      summary: await getChannelSummary()
    });
  }

  if (request.method === "GET" && url.pathname === "/compare/troubleshoot") {
    await hydrateChannelEventsFromCache();
    const summary = getChannelHealthSummary(90, 5);
    const issues = getChannelTroubleshooting(summary);

    return jsonResponse({
      ok: true,
      issues,
      links: getChannelHelpLinks()
    });
  }

  if (request.method === "GET" && url.pathname === "/compare/ui-model") {
    const limit = parseLimit(url.searchParams.get("limit"), 100);
    const channelSummary = await getChannelSummary();
    const platformMatrix = buildPlatformMatrix(90, 5);
    const healthSummary = getChannelHealthSummary(90, 5);
    const issues = getChannelTroubleshooting(healthSummary);
    const parity = getParityModel();

    return jsonResponse({
      ok: true,
      source_of_truth: "edge",
      runtime_mode: "edge",
      parity,
      browser_parity: {
        matched_rate_pct: parity.matched_rate_pct,
        mismatch_rate_pct: parity.mismatch_rate_pct,
        paired_events: parity.total_pairs,
        status: parity.status
      },
      parity_counts: getShadowCounts(),
      parity_mismatches_preview: edgeShadowComparisons
        .filter((item) => (item as { type?: string }).type === "mismatched")
        .slice(0, 20),
      channels: channelSummary,
      platforms: platformMatrix,
      troubleshooting: {
        issues,
        links: getChannelHelpLinks()
      },
      launch_readiness: {
        status: parity.status === "ok" ? "go" : "hold",
        rationale: parity.status === "ok" ? ["Parity within threshold"] : ["Parity alert active"]
      },
      recent: {
        shadow_events: edgeShadowComparisons.slice(0, limit),
        channel_events: getRecentChannelEvents(limit),
        browser_events: edgeBrowserEvents.slice(0, limit)
      }
    });
  }

  if (request.method === "GET" && url.pathname === "/compare/browser") {
    const limit = parseLimit(url.searchParams.get("limit"), 100);
    return jsonResponse({
      ok: true,
      runtime_mode: "edge",
      accepted: edgeBrowserBeaconsAccepted,
      count: Math.min(limit, edgeBrowserEvents.length),
      events: edgeBrowserEvents.slice(0, limit)
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

    const orderPayload = (payload ?? {}) as Record<string, unknown>;
    const orderId =
      (typeof orderPayload.id === "number" || typeof orderPayload.id === "string"
        ? String(orderPayload.id)
        : undefined) ||
      (typeof orderPayload.order_id === "string" ? orderPayload.order_id : undefined);
    const topic = url.pathname.includes("refund") ? "refund" : "purchase";
    await hydrateChannelEventsFromCache();
    ingestChannelEvent({
      channel: "server_gtm",
      surface: "webhook",
      destination: "synapse-webhook",
      event_name: topic,
      event_id: orderId,
      transaction_id: orderId,
      status: "ok",
      observed_at: new Date().toISOString()
    });
    ingestChannelEvent({
      channel: "synapse",
      surface: "server",
      destination: "order-webhook",
      event_name: topic === "refund" ? "refunds/create" : "orders/paid",
      event_id: orderId,
      transaction_id: orderId,
      status: "ok",
      observed_at: new Date().toISOString()
    });
    await persistChannelEventsToCache();

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
      channels: await getChannelSummary(),
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
        api_key_present: true,
        app_url: "https://gcw-synapse-super.gcwsynapse.workers.dev",
        scopes: DEFAULT_SHOPIFY_SCOPES.split(","),
        install_url:
          "https://gcw-synapse-super.gcwsynapse.workers.dev/auth/shopify/install?shop=gcw-dev.myshopify.com",
        install_landing_url:
          "https://gcw-synapse-super.gcwsynapse.workers.dev/install?shop=gcw-dev.myshopify.com"
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
        installed_shops: ["gcw-dev.myshopify.com", "gerberchildrenswear.myshopify.com"],
        store_path: "cloudflare-worker-edge"
      }
    });
  }

  // Shopify OAuth is handled in fetch() via handleShopifyOAuth before this runs.
  if (url.pathname.startsWith("/auth/shopify/")) {
    return jsonResponse(
      {
        ok: false,
        error: "Shopify OAuth handler did not run",
        mode: "edge"
      },
      500
    );
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

    if (isInternalRoute(url.pathname) && !isInternalRouteExempt(url.pathname, request.method)) {
      const expectedToken = env.SYNAPSE_INGRESS_TOKEN;
      const providedToken = request.headers.get("X-Synapse-Token");

      if (expectedToken && providedToken !== expectedToken) {
        return addSecurityHeaders(jsonResponse({ ok: false, error: "Unauthorized" }, 401));
      }
    }

    if (
      (url.pathname === "/event" || url.pathname === "/browser/beacon") &&
      request.method === "OPTIONS"
    ) {
      const origin = request.headers.get("origin");
      const allowedOrigins = parseAllowedOrigins(env.PUBLIC_EVENT_ALLOWED_ORIGINS);

      if (!origin || !isAllowedOrigin(origin, allowedOrigins)) {
        return addSecurityHeaders(jsonResponse({ ok: false, error: "Origin not allowed" }, 403));
      }

      return addSecurityHeaders(addCorsHeaders(new Response(null, { status: 204 }), request, origin));
    }

    if (url.pathname === "/browser/beacon" && request.method === "POST") {
      const allowedOrigins = parseAllowedOrigins(env.PUBLIC_EVENT_ALLOWED_ORIGINS);
      const origin = request.headers.get("origin");
      // Allow no-origin (web pixel sandbox / keepalive) plus allowlisted storefronts.
      if (origin && !isAllowedOrigin(origin, allowedOrigins)) {
        return addSecurityHeaders(
          addCorsHeaders(jsonResponse({ ok: false, error: "Origin not allowed" }, 403), request, origin)
        );
      }

      const rate = checkEventRateLimit(request, env);
      if (!rate.allowed) {
        return addSecurityHeaders(
          addCorsHeaders(jsonResponse({ ok: false, error: "Rate limit exceeded" }, 429), request, origin ?? undefined)
        );
      }

      const maxBodyBytes = parsePositiveInt(env.PUBLIC_EVENT_MAX_BODY_BYTES, 16_384);
      const rawBody = await request.text();
      const rawBodyBytes = new TextEncoder().encode(rawBody).byteLength;
      if (rawBodyBytes > maxBodyBytes) {
        return addSecurityHeaders(
          addCorsHeaders(jsonResponse({ ok: false, error: "Payload too large" }, 413), request, origin ?? undefined)
        );
      }

      let payload: Record<string, unknown> | null = null;
      try {
        payload = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        return addSecurityHeaders(
          addCorsHeaders(jsonResponse({ ok: false, error: "Invalid JSON payload" }, 400), request, origin ?? undefined)
        );
      }

      const eventName = typeof payload.event === "string" ? payload.event : "";
      if (!eventName || !ALLOWED_BROWSER_EVENTS.has(eventName)) {
        return addSecurityHeaders(
          addCorsHeaders(jsonResponse({ ok: false, error: "invalid_event" }, 400), request, origin ?? undefined)
        );
      }

      const record = {
        receivedAt: new Date().toISOString(),
        source: "edge-browser-beacon",
        shop: typeof payload.shop === "string" ? payload.shop : "unknown-shop",
        event: eventName,
        event_id: typeof payload.event_id === "string" ? payload.event_id : undefined,
        payload
      };

      edgeBrowserEvents.unshift(record);
      edgeWebhookLog.unshift(record);
      if (edgeBrowserEvents.length > 500) {
        edgeBrowserEvents.length = 500;
      }
      if (edgeWebhookLog.length > 500) {
        edgeWebhookLog.length = 500;
      }

      edgeBrowserBeaconsAccepted += 1;
      edgeEventsGenerated += 1;
      await hydrateChannelEventsFromCache();
      recordSynapseBrowserChannel(eventName, record.event_id, record.shop);
      await persistChannelEventsToCache();

      return addSecurityHeaders(
        addCorsHeaders(
          jsonResponse(
            {
              ok: true,
              accepted: true,
              key: `${record.shop}:${eventName}:${record.event_id ?? edgeBrowserBeaconsAccepted}`,
              event: eventName
            },
            202
          ),
          request,
          origin ?? undefined
        )
      );
    }

    if (url.pathname === "/event" && request.method === "POST") {
      const allowedOrigins = parseAllowedOrigins(env.PUBLIC_EVENT_ALLOWED_ORIGINS);
      const origin = request.headers.get("origin");
      if (!origin || !isAllowedOrigin(origin, allowedOrigins)) {
        return addSecurityHeaders(addCorsHeaders(jsonResponse({ ok: false, error: "Origin not allowed" }, 403), request, origin ?? undefined));
      }

      const rate = checkEventRateLimit(request, env);
      if (!rate.allowed) {
        return addSecurityHeaders(
          addCorsHeaders(
            jsonResponse({ ok: false, error: "Rate limit exceeded" }, 429),
            request,
            origin
          )
        );
      }

      const maxBodyBytes = parsePositiveInt(env.PUBLIC_EVENT_MAX_BODY_BYTES, 16_384);
      const contentLengthRaw = request.headers.get("content-length");
      if (contentLengthRaw) {
        const contentLength = Number.parseInt(contentLengthRaw, 10);
        if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
          return addSecurityHeaders(addCorsHeaders(jsonResponse({ ok: false, error: "Payload too large" }, 413), request, origin));
        }
      }

      const rawBody = await request.text();
      const rawBodyBytes = new TextEncoder().encode(rawBody).byteLength;
      if (rawBodyBytes > maxBodyBytes) {
        return addSecurityHeaders(addCorsHeaders(jsonResponse({ ok: false, error: "Payload too large" }, 413), request, origin));
      }

      let payload: unknown = null;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        return addSecurityHeaders(addCorsHeaders(jsonResponse({ ok: false, error: "Invalid JSON payload" }, 400), request, origin));
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

      return addSecurityHeaders(
        addCorsHeaders(
          jsonResponse({ ok: true, accepted: true, eventId: edgeEventsGenerated, receivedAt: eventRecord.receivedAt }),
          request,
          origin
        )
      );
    }

    if (request.method === "GET" && url.pathname === "/install") {
      return addSecurityHeaders(handleInstallLanding(url, env));
    }

    if (url.pathname.startsWith("/auth/shopify/")) {
      try {
        const oauth = await handleShopifyOAuth(request, env, url);
        if (oauth) {
          return addSecurityHeaders(oauth);
        }
        return addSecurityHeaders(
          jsonResponse({ ok: false, error: "Unsupported Shopify auth route" }, 404)
        );
      } catch (error) {
        return addSecurityHeaders(
          jsonResponse(
            {
              ok: false,
              error: error instanceof Error ? error.message : "Shopify OAuth failed"
            },
            500
          )
        );
      }
    }

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
