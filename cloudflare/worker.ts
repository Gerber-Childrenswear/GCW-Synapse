type CloudflareEnv = {
  ASSETS: Fetcher;
  SYNAPSE_STATE?: KVNamespace;
  SYNAPSE_ORIGIN_URL?: string;
  SYNAPSE_INGRESS_TOKEN?: string;
  ADMIN_UI_PASSWORD?: string;
  SESSION_HMAC_SECRET?: string;
  PUBLIC_EVENT_ALLOWED_ORIGINS?: string;
  PUBLIC_EVENT_MAX_BODY_BYTES?: string;
  PUBLIC_EVENT_RATE_LIMIT_PER_MINUTE?: string;
  SHOPIFY_API_KEY?: string;
  SHOPIFY_API_SECRET?: string;
  SHOPIFY_APP_SCOPES?: string;
  SHOPIFY_APP_URL?: string;
  SHOPIFY_WEBHOOK_SECRET?: string;
  GTM_SERVER_URL?: string;
  GTM_FORWARD_SHARED_SECRET?: string;
  RUNTIME_MODE?: string;
  SHOP_DEFAULT_CURRENCY?: string;
  FACEBOOK_PIXEL_ID?: string;
  PINTEREST_ID?: string;
  GA4_MEASUREMENT_ID?: string;
  GA4_MEASUREMENT_ID_BY_SHOP?: string;
  TIKTOK_PIXEL_ID?: string;
  REDDIT_PIXEL_ID?: string;
  GOOGLE_ADS_CONVERSION_ID?: string;
  BLOOMREACH_ACCOUNT_ID?: string;
  BROWSER_PARITY_MISMATCH_ALERT_PCT?: string;
  SLACK_WEBHOOK_URL?: string;
  ALERT_EMAIL_TO?: string;
  ALERT_EMAIL_FROM?: string;
  ALERT_EMAIL_WEBHOOK_URL?: string;
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
  ingestChannelEvent,
  resetChannelHealth
} from "../src/services/channelHealth";
import { buildPlatformMatrix } from "../src/services/platformMatrix";
import {
  buildDemoSamples,
  resolveDemoSeedScenario
} from "../src/services/platformDemoSeed";
import {
  getBrowserParityReport,
  getRecentBrowserEvents,
  getBrowserEventsSnapshot,
  hydrateBrowserEvents,
  ingestBrowserEvent,
  resetBrowserEventsForTests
} from "../src/services/browserEvents";
import { resolveCurrencyCode } from "../src/services/currencyCode";
import { processPurchaseWebhookEdge, verifyShopifyWebhookHmacEdge } from "../src/services/edgeWebhook";
import { maybeAlertOnParity } from "../src/services/alerts";
import { resolveGa4MeasurementId } from "../src/services/ga4Measurement";
import {
  clearAdminSessionCookie,
  isAdminAuthorized,
  isPublicUnauthenticatedPath,
  loginPageHtml,
  loginRedirect,
  mintAdminSessionCookie,
  resolveAdminPassword,
  resolveSessionSigningKey,
  timingSafeEqualString,
  unauthorizedJson,
  wantsHtml
} from "./adminAuth";
import {
  checkLoginRateLimit,
  escapeHtml,
  isMutatingMethod,
  mutationOriginAllowed,
  redactSensitive
} from "./securityHelpers";
import { buildLaunchReadiness } from "./launchReadinessEdge";

const PROXY_PREFIXES = [
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

const DUAL_RUN_KV_KEY = "dual-run:v1";

type DualRunFlags = {
  synapse_enabled: boolean;
  updated_at?: string;
};

async function getDualRunFlags(env: CloudflareEnv): Promise<DualRunFlags> {
  try {
    const fromKv = await env.SYNAPSE_STATE?.get(DUAL_RUN_KV_KEY, "json");
    if (fromKv && typeof fromKv === "object") {
      const row = fromKv as DualRunFlags;
      return {
        synapse_enabled: row.synapse_enabled !== false,
        updated_at: typeof row.updated_at === "string" ? row.updated_at : undefined
      };
    }
  } catch {
    // default on
  }
  return { synapse_enabled: true };
}

async function setDualRunFlags(
  env: CloudflareEnv,
  next: { synapse_enabled: boolean }
): Promise<DualRunFlags> {
  const flags: DualRunFlags = {
    synapse_enabled: next.synapse_enabled,
    updated_at: new Date().toISOString()
  };
  await env.SYNAPSE_STATE?.put(DUAL_RUN_KV_KEY, JSON.stringify(flags), { expirationTtl: 86400 * 30 });
  return flags;
}

const SYNAPSE_DISABLED_STUB = `"use strict";(()=>{try{window.Synapse={version:"disabled",getSession:()=>({}),push:()=>{}};console.info("[Synapse] soft-disabled via /ops/dual-run");}catch(e){}})();`;

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
      `<h1>Invalid shop</h1><p>${escapeHtml(error instanceof Error ? error.message : "Invalid shop")}</p>`,
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
    <p class="sub">Shop: <span class="mono">${escapeHtml(shop)}</span></p>

    <div class="warn">
      <strong>Installed Partners app</strong> (client <span class="mono">${escapeHtml(apiKey)}</span>) —
      already on gcw-dev. Use <em>Open app</em> below if you need the admin UI.
      Re-auth only if scopes change.
    </div>

    <div class="card">
      <h2>Open / re-authorize</h2>
      <div class="actions">
        <a class="btn btn-primary" href="https://admin.shopify.com/store/${escapeHtml(handle)}/apps/${escapeHtml(apiKey)}">Open app</a>
        <a class="btn btn-secondary" href="${escapeHtml(oauthInstall)}">Re-authorize scopes</a>
        <a class="btn btn-secondary" href="${escapeHtml(embedUrl)}">Enable theme App embed</a>
      </div>
      <p class="meta">Scopes: <span class="mono">${escapeHtml(scopes)}</span></p>
    </div>

    <div class="card">
      <h2>Required staff permissions</h2>
      <ul>
        <li><strong>Apps → Manage and install apps and channels</strong> (all apps — not a named whitelist)</li>
        <li><strong>Settings → View customer events</strong></li>
        <li><strong>Settings → Manage and add custom pixels</strong></li>
        <li>Products, Orders (view), Customers (view), Online store / Themes</li>
      </ul>
      <p class="meta"><a href="${escapeHtml(usersUrl)}">Open Users &amp; permissions</a></p>
    </div>

    <div class="card">
      <h2>After install</h2>
      <ol>
        <li>Confirm <strong>Customer events → App pixels</strong> shows GCW Synapse.</li>
        <li>Enable the theme App embed: <a href="${escapeHtml(embedUrl)}">open App embeds</a>.</li>
        <li>Beacon URL: <span class="mono">${escapeHtml(url.origin)}/browser/beacon</span></li>
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
  if (!timingSafeEqualString(expected, sig)) return { ok: false, error: "Invalid state signature" };
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
  return timingSafeEqualString(digest, hmac);
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

async function obtainShopifyClientCredentialsToken(
  shop: string,
  apiKey: string,
  apiSecret: string
): Promise<{ access_token: string; scope: string; expires_in?: number }> {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: apiKey,
      client_secret: apiSecret,
      grant_type: "client_credentials"
    })
  });
  const data = (await response.json()) as {
    access_token?: string;
    scope?: string;
    expires_in?: number;
    error?: string;
  };
  if (!response.ok || !data.access_token) {
    throw new Error(data.error || `Client credentials failed (${response.status})`);
  }
  return {
    access_token: data.access_token,
    scope: data.scope || "",
    expires_in: data.expires_in
  };
}

type ShopifyGql = (query: string, variables?: Record<string, unknown>) => Promise<Record<string, unknown>>;

function createShopifyGraphql(shop: string, accessToken: string): ShopifyGql {
  return async (query, variables) => {
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
      errors?: Array<{ message: string; extensions?: { code?: string } }>;
    };
    if (!response.ok) {
      throw new Error(`GraphQL HTTP ${response.status}`);
    }
    // Shopify returns RESOURCE_NOT_FOUND for missing webPixel — treat as empty data.
    if (json.errors?.length) {
      const onlyMissing = json.errors.every(
        (e) => e.extensions?.code === "RESOURCE_NOT_FOUND" || /no web pixel/i.test(e.message)
      );
      if (!onlyMissing) {
        throw new Error(json.errors.map((e) => e.message).join("; "));
      }
    }
    return json.data ?? {};
  };
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
  const gql = createShopifyGraphql(shop, accessToken);

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

const WEBHOOK_TOPICS = [
  { topic: "ORDERS_CREATE", path: "/webhooks/shopify/orders/create" },
  { topic: "ORDERS_PAID", path: "/webhooks/shopify/orders/paid" },
  { topic: "REFUNDS_CREATE", path: "/webhooks/shopify/refunds/create" }
] as const;

async function ensureSynapseWebhooks(
  shop: string,
  accessToken: string,
  appOrigin: string
): Promise<{ ok: boolean; detail: Record<string, unknown> }> {
  const gql = createShopifyGraphql(shop, accessToken);
  const listed = (await gql(`query {
    webhookSubscriptions(first: 50) {
      edges { node { id topic endpoint { __typename ... on WebhookHttpEndpoint { callbackUrl } } } }
    }
  }`)) as {
    webhookSubscriptions?: {
      edges?: Array<{
        node: {
          id: string;
          topic: string;
          endpoint?: { callbackUrl?: string };
        };
      }>;
    };
  };

  const byTopic = new Map<string, { id: string; callbackUrl?: string }>();
  for (const edge of listed.webhookSubscriptions?.edges ?? []) {
    byTopic.set(edge.node.topic, {
      id: edge.node.id,
      callbackUrl: edge.node.endpoint?.callbackUrl
    });
  }

  const results: Array<Record<string, unknown>> = [];
  for (const row of WEBHOOK_TOPICS) {
    const callbackUrl = `${appOrigin}${row.path}`;
    const existing = byTopic.get(row.topic);
    if (existing?.callbackUrl === callbackUrl) {
      results.push({ topic: row.topic, action: "unchanged", id: existing.id, callbackUrl });
      continue;
    }
    if (existing?.id) {
      await gql(
        `mutation($id: ID!) {
          webhookSubscriptionDelete(id: $id) {
            userErrors { message }
            deletedWebhookSubscriptionId
          }
        }`,
        { id: existing.id }
      );
    }
    const created = (await gql(
      `mutation($topic: WebhookSubscriptionTopic!, $url: URL!) {
        webhookSubscriptionCreate(topic: $topic, webhookSubscription: { callbackUrl: $url, format: JSON }) {
          userErrors { field message }
          webhookSubscription { id topic endpoint { ... on WebhookHttpEndpoint { callbackUrl } } }
        }
      }`,
      { topic: row.topic, url: callbackUrl }
    )) as {
      webhookSubscriptionCreate?: {
        userErrors?: Array<{ message: string }>;
        webhookSubscription?: { id?: string; topic?: string };
      };
    };
    const errors = created.webhookSubscriptionCreate?.userErrors ?? [];
    if (errors.length) {
      results.push({ topic: row.topic, action: "error", errors });
    } else {
      results.push({
        topic: row.topic,
        action: existing ? "replaced" : "created",
        webhook: created.webhookSubscriptionCreate?.webhookSubscription
      });
    }
  }

  const ok = results.every((r) => r.action !== "error");
  return { ok, detail: { webhooks: results } };
}

async function wireShopToSynapse(
  shop: string,
  env: CloudflareEnv,
  appOrigin: string
): Promise<Record<string, unknown>> {
  const apiKey = env.SHOPIFY_API_KEY;
  const apiSecret = env.SHOPIFY_API_SECRET;
  if (!apiKey || !apiSecret) {
    return { ok: false, error: "Missing SHOPIFY_API_KEY / SHOPIFY_API_SECRET" };
  }

  const token = await obtainShopifyClientCredentialsToken(shop, apiKey, apiSecret);
  const pixel = await ensureSynapseWebPixel(shop, token.access_token, appOrigin);
  const webhooks = await ensureSynapseWebhooks(shop, token.access_token, appOrigin);

  return {
    ok: pixel.ok && webhooks.ok,
    shop,
    scope: token.scope,
    expires_in: token.expires_in,
    pixel,
    webhooks,
    cdn: `${appOrigin}/gcw-synapse.js?v=1.4.1`,
    beacon: `${appOrigin}/browser/beacon`,
    compatibility_ids: `${appOrigin}/compatibility/ids`
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
    return htmlResponse(`<h1>Install failed</h1><p>${escapeHtml(stateCheck.error)}</p>`, 400);
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
    const webhooks = await ensureSynapseWebhooks(shop, token.access_token, appOrigin);
    const pixelStatus = pixel.ok
      ? `Web pixel ${escapeHtml(String(pixel.detail.action))}d successfully.`
      : `Web pixel activation issue: ${escapeHtml(JSON.stringify(pixel.detail.errors || pixel.detail))}`;
    const webhookStatus = webhooks.ok
      ? "Purchase/refund webhooks registered."
      : `Webhook issue: ${escapeHtml(JSON.stringify(webhooks.detail))}`;

    const handle = shop.replace(/\.myshopify\.com$/i, "");
    const appHome = `${appOrigin}/?shop=${encodeURIComponent(shop)}&embedded=1`;
    const adminApp = `https://admin.shopify.com/store/${handle}/apps/${apiKey}`;
    const embedEditor = `https://${shop}/admin/themes/current/editor?context=apps&activateAppId=${apiKey}/gcw-synapse-app-block`;
    const customerEvents = `https://admin.shopify.com/store/${handle}/settings/customer_events`;

    return htmlResponse(`<!doctype html>
<html><head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="2;url=${escapeHtml(appHome)}">
  <title>GCW Synapse installed</title>
  <style>
    body{font-family:IBM Plex Sans,Segoe UI,sans-serif;max-width:640px;margin:40px auto;padding:0 16px;color:#12241c;background:#f5f8f6}
    a.btn{display:inline-block;margin:6px 8px 6px 0;padding:12px 16px;border-radius:8px;background:#0f6b4c;color:#fff;text-decoration:none;font-weight:600}
    a.btn.secondary{background:#e5eee9;color:#12241c}
    .ok{color:#0f6b4c}
  </style>
</head>
<body>
  <h1 class="ok">GCW Synapse is live</h1>
  <p><strong>Shop:</strong> ${escapeHtml(shop)}</p>
  <p><strong>Scopes:</strong> ${escapeHtml(token.scope || scopes)}</p>
  <p>${pixelStatus}</p>
  <p>${webhookStatus}</p>
  <p>Opening the platforms control panel…</p>
  <p>
    <a class="btn" href="${escapeHtml(adminApp)}">Open app in Shopify admin</a>
    <a class="btn secondary" href="${escapeHtml(appHome)}">Open platforms UI</a>
    <a class="btn secondary" href="${escapeHtml(embedEditor)}">Enable theme embed</a>
    <a class="btn secondary" href="${escapeHtml(customerEvents)}">Customer events</a>
  </p>
</body></html>`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Install callback failed";
    return htmlResponse(`<h1>Install failed</h1><p>${escapeHtml(message)}</p>`, 400);
  }
}

function getBrowserParityThreshold(env?: CloudflareEnv): number {
  const raw = env?.BROWSER_PARITY_MISMATCH_ALERT_PCT;
  if (!raw) return 5;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 5;
}

function getAlertConfig(env: CloudflareEnv) {
  return {
    slackWebhookUrl: env.SLACK_WEBHOOK_URL,
    emailTo: env.ALERT_EMAIL_TO,
    emailFrom: env.ALERT_EMAIL_FROM,
    emailWebhookUrl: env.ALERT_EMAIL_WEBHOOK_URL
  };
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

const CHANNEL_CACHE_URL = "https://gcw-synapse-super.internal/channel-events-v3";
const BROWSER_CACHE_URL = "https://gcw-synapse-super.internal/browser-events-v1";
const BROWSER_KV_KEY = "browser-events-v1";
const CHANNEL_KV_KEY = "channel-events-v3";
/** Once-per-isolate: avoid re-ingesting KV/Cache into channel health on every request. */
let channelEventsHydrated = false;

function channelEventFingerprint(event: Record<string, unknown>): string {
  return [
    String(event.channel ?? ""),
    String(event.surface ?? ""),
    String(event.event_name ?? ""),
    String(event.event_id ?? ""),
    String(event.transaction_id ?? ""),
    String(event.observed_at ?? ""),
    String(event.status ?? ""),
    String(event.destination ?? "")
  ].join("|");
}

async function readChannelEventsFromStore(env?: CloudflareEnv): Promise<Array<Record<string, unknown>>> {
  try {
    const fromKv = await env?.SYNAPSE_STATE?.get(CHANNEL_KV_KEY, "json");
    if (Array.isArray(fromKv)) {
      return fromKv as Array<Record<string, unknown>>;
    }
    const cached = await caches.default.match(CHANNEL_CACHE_URL);
    if (cached) {
      const parsed = (await cached.json()) as Array<Record<string, unknown>>;
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

async function writeChannelEventsToStore(
  env: CloudflareEnv | undefined,
  events: Array<Record<string, unknown>>
): Promise<void> {
  const body = JSON.stringify(events);
  await caches.default.put(
    CHANNEL_CACHE_URL,
    new Response(body, {
      headers: {
        "content-type": "application/json",
        "cache-control": "max-age=86400"
      }
    })
  );
  await env?.SYNAPSE_STATE?.put(CHANNEL_KV_KEY, body, { expirationTtl: 86400 });
}

async function clearChannelEventsCache(env?: CloudflareEnv): Promise<void> {
  try {
    // Overwrite with empty so hydrate cannot revive orphans via a Cache delete race.
    await writeChannelEventsToStore(env, []);
    channelEventsHydrated = true;
    await caches.default.delete("https://gcw-synapse-super.internal/channel-events-v1");
    await caches.default.delete("https://gcw-synapse-super.internal/channel-events-v2");
    await caches.default.delete(BROWSER_CACHE_URL);
    await env?.SYNAPSE_STATE?.delete(BROWSER_KV_KEY);
    await env?.SYNAPSE_STATE?.delete("channel-events-v1");
    await env?.SYNAPSE_STATE?.delete("channel-events-v2");
  } catch {
    // ignore
  }
}

async function persistBrowserEventsToCache(env?: CloudflareEnv): Promise<void> {
  try {
    // Merge any KV/cache rows we may be missing before writing, so concurrent
    // isolates cannot clobber each other's synapse/elevar halves.
    await hydrateBrowserEventsFromCache(env);
    const events = getBrowserEventsSnapshot(500);
    const body = JSON.stringify(events);
    await caches.default.put(
      BROWSER_CACHE_URL,
      new Response(body, {
        headers: {
          "content-type": "application/json",
          "cache-control": "max-age=86400"
        }
      })
    );
    await env?.SYNAPSE_STATE?.put(BROWSER_KV_KEY, body, { expirationTtl: 86400 });
  } catch {
    // ignore
  }
}

async function hydrateBrowserEventsFromCache(env?: CloudflareEnv): Promise<void> {
  try {
    let events: Array<Record<string, unknown>> | null = null;
    const fromKv = await env?.SYNAPSE_STATE?.get(BROWSER_KV_KEY, "json");
    if (Array.isArray(fromKv)) {
      events = fromKv as Array<Record<string, unknown>>;
    } else {
      const cached = await caches.default.match(BROWSER_CACHE_URL);
      if (cached) {
        const parsed = (await cached.json()) as Array<Record<string, unknown>>;
        if (Array.isArray(parsed)) events = parsed;
      }
    }
    if (!events?.length) return;
    hydrateBrowserEvents(events as Parameters<typeof hydrateBrowserEvents>[0]);
  } catch {
    // ignore
  }
}

function ingestStoredChannelEvent(event: Record<string, unknown>): void {
  if (typeof event.channel !== "string" || typeof event.event_name !== "string") return;
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

async function persistChannelEventsToCache(env?: CloudflareEnv): Promise<void> {
  try {
    // Merge remote-only rows (other isolates) without full re-ingest of local copies.
    const remote = await readChannelEventsFromStore(env);
    const localFp = new Set(
      getRecentChannelEvents(500).map((event) => channelEventFingerprint(event as unknown as Record<string, unknown>))
    );
    for (const event of remote.slice().reverse()) {
      const fp = channelEventFingerprint(event);
      if (localFp.has(fp)) continue;
      ingestStoredChannelEvent(event);
      localFp.add(fp);
    }
    channelEventsHydrated = true;
    await writeChannelEventsToStore(
      env,
      getRecentChannelEvents(500) as unknown as Array<Record<string, unknown>>
    );
  } catch {
    // Cache API may be unavailable in some runtimes; ignore.
  }
}

async function hydrateChannelEventsFromCache(env?: CloudflareEnv): Promise<void> {
  try {
    const remote = await readChannelEventsFromStore(env);
    const local = getRecentChannelEvents(500);

    // Empty memory + non-empty store: always load (other isolate may have seeded after our reset).
    if (local.length === 0) {
      for (const event of remote.slice().reverse()) {
        ingestStoredChannelEvent(event);
      }
      channelEventsHydrated = true;
      return;
    }

    // Warm isolate: merge any remote-only fingerprints without doubling local rows.
    const localFp = new Set(
      local.map((event) => channelEventFingerprint(event as unknown as Record<string, unknown>))
    );
    for (const event of remote.slice().reverse()) {
      const fp = channelEventFingerprint(event);
      if (localFp.has(fp)) continue;
      ingestStoredChannelEvent(event);
      localFp.add(fp);
    }
    channelEventsHydrated = true;
  } catch {
    // ignore hydrate failures
  }
}

async function getChannelSummary(env?: CloudflareEnv) {
  await hydrateChannelEventsFromCache(env);
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

function addCorsHeaders(
  response: Response,
  request: Request,
  originOverride?: string | null,
  allowedOrigins?: string[]
): Response {
  const headers = new Headers(response.headers);
  const origin = originOverride ?? request.headers.get("origin");
  const allowlist = (allowedOrigins ?? []).map((value) => value.trim().toLowerCase());
  if (origin && allowlist.includes(origin.trim().toLowerCase())) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, X-Synapse-Token");
  headers.set("Access-Control-Max-Age", "86400");

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

async function handleNativeApi(request: Request, env: CloudflareEnv): Promise<Response | null> {
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

  if (request.method === "GET" && url.pathname === "/ops/connection") {
    const apiKey = Boolean(env.SHOPIFY_API_KEY);
    const apiSecret = Boolean(env.SHOPIFY_API_SECRET);
    const webhookSecret = Boolean(env.SHOPIFY_WEBHOOK_SECRET || env.SHOPIFY_API_SECRET);
    const scopes = resolveInstallScopes(env.SHOPIFY_APP_SCOPES);
    const appUrlOk = true; // Worker uses request origin for OAuth callbacks
    const checks = [
      { id: "shopify_api_key", label: "Shopify API key (client id)", ok: apiKey, detail: apiKey ? "set" : "missing" },
      { id: "shopify_api_secret", label: "Shopify API secret", ok: apiSecret, detail: apiSecret ? "set" : "missing" },
      { id: "shopify_webhook_secret", label: "Shopify webhook HMAC secret", ok: webhookSecret, detail: webhookSecret ? "set" : "missing" },
      { id: "shopify_scopes", label: "Install scopes (lean)", ok: scopes.length > 0 && !scopes.includes("read_all_orders"), detail: scopes },
      { id: "oauth_callback", label: "OAuth callback host", ok: appUrlOk, detail: `${url.origin}/auth/shopify/callback` },
      { id: "cdn_script", label: "Storefront CDN script", ok: true, detail: `${url.origin}/gcw-synapse.js?v=1.4.1` },
      { id: "browser_beacon", label: "Browser beacon", ok: true, detail: `${url.origin}/browser/beacon` },
      {
        id: "gtm_forward",
        label: "sGTM purchase forward",
        ok: true,
        detail: env.GTM_SERVER_URL
          ? `configured (${env.RUNTIME_MODE || "shadow_compare"})`
          : "optional — set GTM_SERVER_URL when flipping RUNTIME_MODE=forward"
      },
      {
        id: "elevar_ids",
        label: "Stolen Elevar public IDs (compat)",
        ok: Boolean(env.FACEBOOK_PIXEL_ID && env.GA4_MEASUREMENT_ID),
        detail: env.FACEBOOK_PIXEL_ID
          ? `FB ${env.FACEBOOK_PIXEL_ID} · GA4 ${env.GA4_MEASUREMENT_ID || "unset"} · TT ${env.TIKTOK_PIXEL_ID || "unset"}`
          : "missing — set FACEBOOK_PIXEL_ID / GA4_MEASUREMENT_ID vars"
      }
    ];
    const incomplete = checks.filter((c) => !c.ok);
    return jsonResponse({
      ok: incomplete.length === 0,
      status: incomplete.length === 0 ? "green" : "incomplete",
      client_id_hint: "7d011b70562512bd84b85bd3f9a6e68d",
      incomplete: incomplete.map((c) => c.id),
      checks,
      notes: [
        "Destination API secrets (Meta CAPI, TikTok Events API, etc.) stay in GTM/sGTM — not Worker secrets.",
        "Public pixel/measurement IDs stolen from Elevar GTM constants power /compatibility/* on edge.",
        "Incomplete Shopify keys block OAuth/webhooks; destination tokens are configured in GTM tags."
      ]
    });
  }

  if (request.method === "POST" && url.pathname === "/ops/reset-health") {
    resetChannelHealth();
    resetBrowserEventsForTests();
    channelEventsHydrated = false;
    edgeWebhookLog.length = 0;
    edgeShadowComparisons.length = 0;
    edgeChannelEvents.length = 0;
    edgeBrowserEvents.length = 0;
    edgeEventsGenerated = 0;
    edgeEventsSuppressed = 0;
    edgeBrowserBeaconsAccepted = 0;
    await clearChannelEventsCache(env);
    return jsonResponse({
      ok: true,
      status: "reset",
      message: "Cleared in-memory health, browser parity, and channel-events KV/cache (v3)"
    });
  }

  if (
    (request.method === "POST" || request.method === "GET") &&
    (url.pathname === "/ops/wire" || url.pathname === "/ops/wire-shop")
  ) {
    const shopRaw =
      url.searchParams.get("shop") ||
      (request.method === "POST" ? undefined : "gcw-dev.myshopify.com") ||
      "gcw-dev.myshopify.com";
    let shop: string;
    try {
      shop = normalizeShopDomain(shopRaw.trim());
    } catch (error) {
      return jsonResponse(
        { ok: false, error: error instanceof Error ? error.message : "Invalid shop" },
        400
      );
    }
    try {
      const result = await wireShopToSynapse(shop, env, url.origin);
      return jsonResponse(result, result.ok ? 200 : 500);
    } catch (error) {
      return jsonResponse(
        {
          ok: false,
          error: error instanceof Error ? error.message : "Wire failed"
        },
        500
      );
    }
  }

  if (request.method === "GET" && url.pathname === "/ops/dual-run") {
    const flags = await getDualRunFlags(env);
    return jsonResponse({
      ok: true,
      synapse_enabled: flags.synapse_enabled,
      elevar_note: "Elevar theme embed is controlled in Shopify Theme → App embeds (not via Worker).",
      updated_at: flags.updated_at ?? null,
      how_to: {
        disable_synapse: "POST /ops/dual-run {\"synapse_enabled\":false}",
        enable_synapse: "POST /ops/dual-run {\"synapse_enabled\":true}"
      }
    });
  }

  if (request.method === "POST" && url.pathname === "/ops/dual-run") {
    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }
    const enabled =
      typeof body.synapse_enabled === "boolean"
        ? body.synapse_enabled
        : body.synapse === false
          ? false
          : body.synapse === true
            ? true
            : true;
    const flags = await setDualRunFlags(env, { synapse_enabled: enabled });
    return jsonResponse({
      ok: true,
      synapse_enabled: flags.synapse_enabled,
      updated_at: flags.updated_at,
      note: flags.synapse_enabled
        ? "Synapse CDN + beacons active"
        : "Synapse CDN serves noop stub; Elevar unchanged"
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
    const allowedOrigins = parseAllowedOrigins(env.PUBLIC_EVENT_ALLOWED_ORIGINS);
    const origin = request.headers.get("origin");
    if (!origin || !isAllowedOrigin(origin, allowedOrigins)) {
      return jsonResponse({ ok: false, error: "Origin not allowed" }, 403);
    }
    return addCorsHeaders(new Response(null, { status: 204 }), request, origin, allowedOrigins);
  }

  if (url.pathname === "/event" && request.method === "POST") {
    const allowedOrigins = parseAllowedOrigins(env.PUBLIC_EVENT_ALLOWED_ORIGINS);
    const origin = request.headers.get("origin");
    if (!origin || !isAllowedOrigin(origin, allowedOrigins)) {
      return addCorsHeaders(jsonResponse({ ok: false, error: "Origin not allowed" }, 403), request, origin, allowedOrigins);
    }

    let payload: unknown = null;

    try {
      payload = await request.json();
    } catch {
      return addCorsHeaders(jsonResponse({ ok: false, error: "Invalid JSON payload" }, 400), request, origin, allowedOrigins);
    }

    const eventRecord = {
      receivedAt: new Date().toISOString(),
      source: "edge-event-endpoint",
      payload: redactSensitive(payload)
    };

    edgeWebhookLog.unshift(eventRecord);
    edgeShadowComparisons.unshift({
      type: "synapse_only",
      comparedAt: eventRecord.receivedAt,
      score: 100,
      payload: redactSensitive(payload)
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
      request,
      origin,
      allowedOrigins
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
      await hydrateChannelEventsFromCache(env);
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
      await persistChannelEventsToCache(env);
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
    if (events.length > 50) {
      return jsonResponse({ ok: false, error: "batch_too_large", max: 50 }, 413);
    }

    const accepted: Array<Record<string, unknown>> = [];
    await hydrateChannelEventsFromCache(env);
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
    await persistChannelEventsToCache(env);

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

  if (request.method === "POST" && url.pathname === "/compare/demo-seed") {
    const scenario = resolveDemoSeedScenario(url.searchParams.get("scenario"));
    const samples = buildDemoSamples(scenario);
    const now = Date.now();

    // Healthy seed always starts clean so prior token/orphan pulses cannot keep Meta/TikTok red.
    if (scenario === "healthy") {
      resetChannelHealth();
      channelEventsHydrated = false;
      edgeChannelEvents.length = 0;
      await clearChannelEventsCache(env);
    } else {
      await hydrateChannelEventsFromCache(env);
    }

    let seeded = 0;
    for (const sample of samples) {
      const observedAt = new Date(now - sample.minutesAgo * 60_000).toISOString();
      const item = {
        channel: sample.channel,
        surface: sample.surface,
        destination: sample.destination,
        event_name: sample.event_name,
        status: sample.status,
        pixel_id: sample.pixel_id,
        event_id: sample.event_id,
        transaction_id: sample.transaction_id,
        error_message: sample.error_message,
        observed_at: observedAt
      };
      edgeChannelEvents.unshift(item);
      ingestChannelEvent({
        channel: sample.channel,
        surface: sample.surface,
        destination: sample.destination,
        pixel_id: sample.pixel_id,
        event_name: sample.event_name,
        event_id: sample.event_id,
        transaction_id: sample.transaction_id,
        status: sample.status,
        error_message: sample.error_message,
        observed_at: observedAt
      });
      seeded += 1;
    }
    if (edgeChannelEvents.length > 500) {
      edgeChannelEvents.length = 500;
    }
    await persistChannelEventsToCache(env);
    return jsonResponse(
      {
        ok: true,
        seeded,
        scenario,
        note:
          scenario === "healthy"
            ? "Healthy Meta/TikTok/platform pulses with confirmed dedupe (prior health cleared)"
            : "Broken diagnostic pulses recorded (token failure + orphan dedupe)"
      },
      202
    );
  }

  if (request.method === "GET" && url.pathname === "/api/advisor/alerts") {
    return jsonResponse({
      alerts: [],
      note: "Advisor alerts require the Node control-panel origin; edge returns an empty list."
    });
  }

  if (request.method === "GET" && url.pathname === "/compare/platforms") {
    await hydrateChannelEventsFromCache(env);
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
    await hydrateChannelEventsFromCache(env);
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
    await hydrateBrowserEventsFromCache(env);
    const browserParity = getBrowserParityReport(5);
    const launch = buildLaunchReadiness(parity, browserParity);

    return jsonResponse({
      ok: true,
      source_of_truth: "edge",
      runtime_mode: "edge",
      parity,
      browser_parity: {
        matched_rate_pct: browserParity.matched_rate_pct,
        mismatch_rate_pct: browserParity.mismatch_rate_pct,
        volume_match_pct: browserParity.volume_match_pct,
        fuzzy_paired: browserParity.fuzzy_paired,
        cart_total_coverage_pct: browserParity.cart_total_coverage_pct,
        product_id_coverage_pct: browserParity.product_id_coverage_pct,
        paired_events: browserParity.paired_events,
        synapse_events: browserParity.synapse_events,
        elevar_events: browserParity.elevar_events,
        status: browserParity.status,
        by_event: browserParity.by_event
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
      launch_readiness: launch,
      recent: {
        shadow_events: edgeShadowComparisons.slice(0, limit),
        channel_events: getRecentChannelEvents(limit),
        browser_events: getRecentBrowserEvents(limit)
      }
    });
  }

  if (request.method === "GET" && url.pathname === "/compare/browser") {
    const limit = parseLimit(url.searchParams.get("limit"), 100);
    await hydrateBrowserEventsFromCache(env);
    const browserParity = getBrowserParityReport(5);
    return jsonResponse({
      ok: true,
      runtime_mode: "edge",
      accepted: edgeBrowserBeaconsAccepted,
      parity: browserParity,
      count: Math.min(limit, getRecentBrowserEvents(limit).length),
      events: getRecentBrowserEvents(limit),
      edge_log: edgeBrowserEvents.slice(0, limit)
    });
  }

  if (request.method === "POST" && url.pathname === "/compare/browser/elevar") {
    try {
      const body = (await request.json()) as Record<string, unknown>;
      const eventName = typeof body.event === "string" ? body.event : "";
      if (!eventName) {
        return jsonResponse({ ok: false, error: "event is required" }, 400);
      }
      await hydrateBrowserEventsFromCache(env);
      const record = ingestBrowserEvent({
        source: "elevar",
        shop: typeof body.shop === "string" ? body.shop : undefined,
        event: eventName,
        event_id: typeof body.event_id === "string" ? body.event_id : undefined,
        currency: typeof body.currency === "string" ? body.currency : undefined,
        cart_total: typeof body.cart_total === "string" ? body.cart_total : undefined,
        ecommerce: body.ecommerce,
        marketing:
          body.marketing && typeof body.marketing === "object"
            ? (body.marketing as { session_id?: string; landing_site?: string })
            : undefined,
        observed_at: typeof body.observed_at === "string" ? body.observed_at : undefined
      });
      await persistBrowserEventsToCache(env);
      return jsonResponse({ ok: true, key: record.key }, 202);
    } catch {
      return jsonResponse({ ok: false, error: "invalid_json" }, 400);
    }
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
    await hydrateBrowserEventsFromCache(env);
    const browserParity = getBrowserParityReport(5);
    const report = buildLaunchReadiness(parity, browserParity);
    return jsonResponse({
      ok: true,
      source_of_truth: "edge",
      runtime_mode: "edge",
      report: {
        ...report,
        counts: getShadowCounts(),
        generated_at: new Date().toISOString(),
        actions: report.status === "go" ? [] : ["Review /compare/browser and /compare/parity mismatches"]
      }
    });
  }

  if (request.method === "POST" && url.pathname.startsWith("/webhooks/")) {
    const hmacHeader = request.headers.get("X-Shopify-Hmac-Sha256");
    const shop = request.headers.get("X-Shopify-Shop-Domain") || "unknown-shop";
    const webhookId = request.headers.get("X-Shopify-Webhook-Id");
    const topicHeader = request.headers.get("X-Shopify-Topic") || "";
    const rawBody = await request.arrayBuffer();
    const topic =
      topicHeader ||
      (url.pathname.includes("refund")
        ? "refunds/create"
        : url.pathname.includes("create")
          ? "orders/create"
          : "orders/paid");

    // Refunds: HMAC verify (same as purchase), then accept + log.
    if (topic.toLowerCase().includes("refund")) {
      const secret = (env.SHOPIFY_WEBHOOK_SECRET || env.SHOPIFY_API_SECRET || "").trim();
      if (secret) {
        const valid = await verifyShopifyWebhookHmacEdge(rawBody, hmacHeader, secret);
        if (!valid) {
          return jsonResponse({ ok: false, error: "invalid_hmac" }, 401);
        }
      } else if ((env.RUNTIME_MODE || "").toLowerCase() === "forward") {
        // Fail closed when forwarding is on but secret missing.
        return jsonResponse({ ok: false, error: "webhook_secret_not_configured" }, 401);
      }
      let payload: unknown = null;
      try {
        payload = JSON.parse(new TextDecoder().decode(rawBody));
      } catch {
        return jsonResponse({ ok: false, error: "Invalid webhook payload" }, 400);
      }
      edgeWebhookLog.unshift({
        receivedAt: new Date().toISOString(),
        source: "edge-webhook",
        path: url.pathname,
        topic,
        shop,
        payload: redactSensitive(payload)
      });
      if (edgeWebhookLog.length > 500) edgeWebhookLog.length = 500;
      return jsonResponse({ ok: true, status: "refund_accepted", path: url.pathname }, 202);
    }

    const result = await processPurchaseWebhookEdge({
      env,
      rawBody,
      hmacHeader,
      shop,
      topic,
      webhookId
    });

    edgeWebhookLog.unshift({
      receivedAt: new Date().toISOString(),
      source: "edge-webhook",
      path: url.pathname,
      topic,
      shop,
      result: redactSensitive(result.body)
    });
    if (edgeWebhookLog.length > 500) edgeWebhookLog.length = 500;

    const orderId =
      typeof result.body.transaction_id === "string"
        ? result.body.transaction_id
        : typeof result.body.event_id === "string"
          ? result.body.event_id
          : undefined;

    if (result.ok) {
      edgeShadowComparisons.unshift({
        type: "synapse_only",
        comparedAt: new Date().toISOString(),
        score: 100,
        event_name: "purchase",
        event_id: result.body.event_id,
        transaction_id: result.body.transaction_id,
        session_attached: result.body.session_attached,
        payload: result.body.payload
      });
      if (edgeShadowComparisons.length > 500) edgeShadowComparisons.length = 500;

      await hydrateChannelEventsFromCache(env);
      ingestChannelEvent({
        channel: "server_gtm",
        surface: "webhook",
        destination: "synapse-webhook",
        event_name: "purchase",
        event_id: typeof result.body.event_id === "string" ? result.body.event_id : orderId,
        transaction_id: orderId,
        status: "ok",
        observed_at: new Date().toISOString()
      });
      ingestChannelEvent({
        channel: "synapse",
        surface: "server",
        destination: "order-webhook",
        event_name: topic,
        event_id: typeof result.body.event_id === "string" ? result.body.event_id : orderId,
        transaction_id: orderId,
        status: "ok",
        observed_at: new Date().toISOString()
      });
      await persistChannelEventsToCache(env);
      edgeEventsGenerated += 1;
    }

    return jsonResponse(result.body, result.status);
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
    const browserParity = getBrowserParityReport(getBrowserParityThreshold(env));
    const alerts: Array<{ severity: string; message: string }> = [];
    if (parity.status !== "ok") {
      alerts.push({
        severity: "warning",
        message: `Purchase shadow mismatch ${parity.mismatch_rate_pct}% above threshold`
      });
    }
    if (browserParity.alert_triggered) {
      alerts.push({
        severity: "warning",
        message: `Browser dual-run mismatch ${browserParity.mismatch_rate_pct}% (paired=${browserParity.paired_events})`
      });
    }

    void maybeAlertOnParity({
      config: getAlertConfig(env),
      label: "Purchase shadow",
      mismatchRatePct: parity.mismatch_rate_pct,
      thresholdPct: 5,
      alertTriggered: parity.status !== "ok",
      pairedEvents: parity.total_pairs
    });
    void maybeAlertOnParity({
      config: getAlertConfig(env),
      label: "Browser dual-run",
      mismatchRatePct: browserParity.mismatch_rate_pct,
      thresholdPct: browserParity.threshold_pct,
      alertTriggered: browserParity.alert_triggered,
      pairedEvents: browserParity.paired_events
    });

    return jsonResponse({
      ok: true,
      status: alerts.length === 0 ? "ok" : "warning",
      generated_at: new Date().toISOString(),
      alerts,
      browser_parity: browserParity,
      purchase_parity: parity,
      quick_actions: ["GET /runtime/summary", "GET /compare/parity", "GET /compare/browser", "GET /ops/dead-letter"]
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

  if (url.pathname.startsWith("/auth/")) {
    return jsonResponse(
      {
        ok: false,
        error: "This route is not enabled in edge-only mode",
        mode: "edge-only"
      },
      501
    );
  }

  if (url.pathname.startsWith("/compatibility/")) {
    return handleCompatibilityEdge(request, env);
  }

  return null;
}

/**
 * Elevar-shaped constant / lookup compatibility endpoints for GTM HTTP variables.
 * Public pixel IDs were stolen from live Elevar config + GTM-TKW58K8 constants.
 */
function handleCompatibilityEdge(request: Request, env: CloudflareEnv): Response {
  if (request.method !== "GET") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "") || "/";

  if (path === "/compatibility/ga4-id") {
    const shop = url.searchParams.get("shop") ?? undefined;
    const measurementId = resolveGa4MeasurementId(
      shop,
      env.GA4_MEASUREMENT_ID,
      env.GA4_MEASUREMENT_ID_BY_SHOP
    );
    if (!measurementId) {
      return jsonResponse({ ok: false, error: "GA4 measurement ID is not configured", shop }, 404);
    }
    return jsonResponse({
      ok: true,
      variable: "GA4 ID",
      shop,
      measurement_id: measurementId
    });
  }

  if (path === "/compatibility/facebook-pixel-id") {
    if (!env.FACEBOOK_PIXEL_ID) {
      return jsonResponse({ ok: false, error: "Facebook Pixel ID is not configured" }, 404);
    }
    return jsonResponse({
      ok: true,
      variable: "Facebook - Pixel ID",
      pixel_id: env.FACEBOOK_PIXEL_ID
    });
  }

  if (path === "/compatibility/pinterest-id") {
    if (!env.PINTEREST_ID) {
      return jsonResponse({ ok: false, error: "Pinterest ID is not configured" }, 404);
    }
    return jsonResponse({
      ok: true,
      variable: "Pinterest ID",
      pinterest_id: env.PINTEREST_ID
    });
  }

  if (path === "/compatibility/tiktok-pixel-id") {
    if (!env.TIKTOK_PIXEL_ID) {
      return jsonResponse({ ok: false, error: "TikTok Pixel ID is not configured" }, 404);
    }
    return jsonResponse({
      ok: true,
      variable: "TikTok - Pixel ID",
      pixel_id: env.TIKTOK_PIXEL_ID
    });
  }

  if (path === "/compatibility/reddit-pixel-id") {
    if (!env.REDDIT_PIXEL_ID) {
      return jsonResponse({ ok: false, error: "Reddit Pixel ID is not configured" }, 404);
    }
    return jsonResponse({
      ok: true,
      variable: "Reddit Pixel ID",
      pixel_id: env.REDDIT_PIXEL_ID
    });
  }

  if (path === "/compatibility/google-ads-conversion-id") {
    if (!env.GOOGLE_ADS_CONVERSION_ID) {
      return jsonResponse({ ok: false, error: "Google Ads Conversion ID is not configured" }, 404);
    }
    return jsonResponse({
      ok: true,
      variable: "Google Ads - Conversion ID",
      conversion_id: env.GOOGLE_ADS_CONVERSION_ID
    });
  }

  if (path === "/compatibility/bloomreach-account-id") {
    if (!env.BLOOMREACH_ACCOUNT_ID) {
      return jsonResponse({ ok: false, error: "Bloomreach Account ID is not configured" }, 404);
    }
    return jsonResponse({
      ok: true,
      variable: "BloomReach Account ID",
      account_id: env.BLOOMREACH_ACCOUNT_ID
    });
  }

  if (path === "/compatibility/currency-code") {
    const ecommerceCurrency = url.searchParams.get("ecommerce_currency") ?? undefined;
    const checkoutCurrencyCode = url.searchParams.get("checkout_currency") ?? undefined;
    const shopCurrency = url.searchParams.get("shop_currency") ?? undefined;
    const currency = resolveCurrencyCode(
      { ecommerceCurrency, checkoutCurrencyCode, shopCurrency },
      env.SHOP_DEFAULT_CURRENCY || "USD"
    );
    return jsonResponse({
      ok: true,
      variable: "dlv - Global - Currency Code",
      resolved_currency: currency,
      sources: {
        ecommerce_currency: ecommerceCurrency,
        checkout_currency: checkoutCurrencyCode,
        shop_currency: shopCurrency,
        fallback_currency: env.SHOP_DEFAULT_CURRENCY || "USD"
      }
    });
  }

  if (path === "/compatibility/ids" || path === "/compatibility/elevar-ids") {
    return jsonResponse({
      ok: true,
      source: "elevar-gtm-tkw58k8 + gcw-dev elevar config.js",
      ids: {
        facebook_pixel_id: env.FACEBOOK_PIXEL_ID ?? null,
        ga4_measurement_id: env.GA4_MEASUREMENT_ID ?? null,
        pinterest_id: env.PINTEREST_ID ?? null,
        tiktok_pixel_id: env.TIKTOK_PIXEL_ID ?? null,
        reddit_pixel_id: env.REDDIT_PIXEL_ID ?? null,
        google_ads_conversion_id: env.GOOGLE_ADS_CONVERSION_ID ?? null,
        bloomreach_account_id: env.BLOOMREACH_ACCOUNT_ID ?? null
      },
      notes: [
        "Public destination IDs only. CAPI / Ads API secrets stay in GTM + sGTM.",
        "gcw-dev Elevar market_groups.gtm_container = GTM-WH3W368X (dev web)."
      ]
    });
  }

  return jsonResponse(
    {
      ok: false,
      error: "Compatibility endpoint not implemented on edge",
      mode: "edge",
      hint: "Constant ID routes: /compatibility/ga4-id, facebook-pixel-id, pinterest-id, tiktok-pixel-id, reddit-pixel-id, google-ads-conversion-id, bloomreach-account-id, currency-code, ids"
    },
    501
  );
}

async function serveAsset(request: Request, env: CloudflareEnv): Promise<Response> {
  const response = await env.ASSETS.fetch(request);
  const url = new URL(request.url);
  const acceptsHtml = (request.headers.get("accept") ?? "").includes("text/html");

  async function withAppBridge(htmlResponse: Response): Promise<Response> {
    const contentType = htmlResponse.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return addSecurityHeaders(htmlResponse);
    }

    const apiKey = (env.SHOPIFY_API_KEY || "7d011b70562512bd84b85bd3f9a6e68d").trim();
    let html = await htmlResponse.text();
    if (!html.includes("shopify-api-key")) {
      const bridge = `
    <meta name="shopify-api-key" content="${apiKey}" />
    <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>`;
      html = html.includes("</head>")
        ? html.replace("</head>", `${bridge}\n  </head>`)
        : `${bridge}\n${html}`;
    }

    const headers = new Headers(htmlResponse.headers);
    headers.set("content-type", "text/html; charset=utf-8");
    return addSecurityHeaders(
      new Response(html, {
        status: htmlResponse.status,
        statusText: htmlResponse.statusText,
        headers
      })
    );
  }

  if (response.status !== 404) {
    if (url.pathname === "/" || url.pathname === "/index.html" || acceptsHtml) {
      return withAppBridge(response);
    }

    // Cache the storefront tracking bundle (URL may be unversioned in theme settings).
    // Keep max-age short so dual-run fixes roll out without a theme-editor cache-bust.
    if (url.pathname === "/gcw-synapse.js" || url.pathname.endsWith("/gcw-synapse.js")) {
      const flags = await getDualRunFlags(env);
      if (!flags.synapse_enabled) {
        return addSecurityHeaders(
          new Response(SYNAPSE_DISABLED_STUB, {
            status: 200,
            headers: {
              "Content-Type": "application/javascript; charset=utf-8",
              "Cache-Control": "no-store"
            }
          })
        );
      }
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "public, max-age=60, stale-while-revalidate=600");
      headers.set("Content-Type", "application/javascript; charset=utf-8");
      return addSecurityHeaders(
        new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers
        })
      );
    }

    return addSecurityHeaders(response);
  }

  if (!acceptsHtml || url.pathname.includes(".")) {
    return addSecurityHeaders(response);
  }

  const spaRequest = new Request(new URL("/index.html", url.origin).toString(), request);
  const spaResponse = await env.ASSETS.fetch(spaRequest);
  return withAppBridge(spaResponse);
}

export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    const url = new URL(request.url);

    // Password / token gate for admin UI + internal APIs (storefront + webhooks stay public).
    if (!isPublicUnauthenticatedPath(url.pathname, request.method)) {
      const authorized = await isAdminAuthorized(request, env);
      if (!authorized) {
        if (wantsHtml(request) || url.pathname === "/" || url.pathname === "/index.html") {
          return addSecurityHeaders(loginRedirect(request));
        }
        return addSecurityHeaders(unauthorizedJson());
      }
      // Cookie sessions use SameSite=None (Shopify iframe) — require Origin allowlist on mutations.
      if (isMutatingMethod(request.method) && !mutationOriginAllowed(request, url.host)) {
        return addSecurityHeaders(
          jsonResponse({ ok: false, error: "csrf_origin_rejected" }, 403)
        );
      }
    }

    // Login / logout (public)
    if (
      (url.pathname === "/login" || url.pathname === "/auth/login") &&
      request.method === "GET"
    ) {
      const returnToRaw = url.searchParams.get("return_to") || "/";
      const returnTo =
        returnToRaw.startsWith("/") && !returnToRaw.startsWith("//") ? returnToRaw : "/";
      const embedded =
        url.searchParams.get("embedded") === "1" ||
        returnTo.includes("embedded=1") ||
        Boolean(url.searchParams.get("host"));
      return addSecurityHeaders(
        new Response(
          loginPageHtml({ returnTo, embedded }),
          {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
          }
        )
      );
    }

    if (
      (url.pathname === "/login" || url.pathname === "/auth/login") &&
      request.method === "POST"
    ) {
      const loginIp = getClientIp(request);
      const rate = checkLoginRateLimit(loginIp);
      if (!rate.allowed) {
        return addSecurityHeaders(
          new Response(
            loginPageHtml({
              returnTo: "/",
              error: "Too many attempts. Try again shortly."
            }),
            {
              status: 429,
              headers: {
                "content-type": "text/html; charset=utf-8",
                "cache-control": "no-store",
                "Retry-After": String(rate.retryAfterSec)
              }
            }
          )
        );
      }

      const contentType = request.headers.get("content-type") || "";
      let password = "";
      let returnTo = "/";
      if (contentType.includes("application/json")) {
        try {
          const body = (await request.json()) as Record<string, unknown>;
          password = typeof body.password === "string" ? body.password : "";
          returnTo = typeof body.return_to === "string" ? body.return_to : "/";
        } catch {
          password = "";
        }
      } else {
        const form = await request.formData();
        password = String(form.get("password") ?? "");
        returnTo = String(form.get("return_to") ?? "/");
      }
      if (!returnTo.startsWith("/") || returnTo.startsWith("//")) returnTo = "/";

      const expected = resolveAdminPassword(env);
      if (!timingSafeEqualString(password, expected)) {
        return addSecurityHeaders(
          new Response(
            loginPageHtml({
              returnTo,
              error: "Incorrect password",
              embedded: returnTo.includes("embedded=1")
            }),
            {
              status: 401,
              headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
            }
          )
        );
      }

      const cookie = await mintAdminSessionCookie(expected, resolveSessionSigningKey(env));
      return new Response(null, {
        status: 302,
        headers: {
          Location: returnTo,
          "Set-Cookie": cookie,
          "Cache-Control": "no-store"
        }
      });
    }

    if (url.pathname === "/auth/logout" && request.method === "POST") {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "Set-Cookie": clearAdminSessionCookie(),
          "Cache-Control": "no-store"
        }
      });
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

      return addSecurityHeaders(addCorsHeaders(new Response(null, { status: 204 }), request, origin, allowedOrigins));
    }

    if (url.pathname === "/browser/beacon" && request.method === "POST") {
      const allowedOrigins = parseAllowedOrigins(env.PUBLIC_EVENT_ALLOWED_ORIGINS);
      const origin = request.headers.get("origin");
      // Allow no-origin (web pixel sandbox / keepalive) plus allowlisted storefronts.
      if (origin && !isAllowedOrigin(origin, allowedOrigins)) {
        return addSecurityHeaders(
          addCorsHeaders(jsonResponse({ ok: false, error: "Origin not allowed" }, 403), request, origin, allowedOrigins)
        );
      }

      const rate = checkEventRateLimit(request, env);
      if (!rate.allowed) {
        return addSecurityHeaders(
          addCorsHeaders(jsonResponse({ ok: false, error: "Rate limit exceeded" }, 429), request, origin ?? undefined, allowedOrigins)
        );
      }

      const maxBodyBytes = parsePositiveInt(env.PUBLIC_EVENT_MAX_BODY_BYTES, 16_384);
      const rawBody = await request.text();
      const rawBodyBytes = new TextEncoder().encode(rawBody).byteLength;
      if (rawBodyBytes > maxBodyBytes) {
        return addSecurityHeaders(
          addCorsHeaders(jsonResponse({ ok: false, error: "Payload too large" }, 413), request, origin ?? undefined, allowedOrigins)
        );
      }

      let payload: Record<string, unknown> | null = null;
      try {
        payload = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        return addSecurityHeaders(
          addCorsHeaders(jsonResponse({ ok: false, error: "Invalid JSON payload" }, 400), request, origin ?? undefined, allowedOrigins)
        );
      }

      const eventName = typeof payload.event === "string" ? payload.event : "";
      if (!eventName || !ALLOWED_BROWSER_EVENTS.has(eventName)) {
        return addSecurityHeaders(
          addCorsHeaders(jsonResponse({ ok: false, error: "invalid_event" }, 400), request, origin ?? undefined, allowedOrigins)
        );
      }

      const shop = typeof payload.shop === "string" ? payload.shop : "unknown-shop";
      const eventId = typeof payload.event_id === "string" ? payload.event_id : undefined;
      const marketing =
        payload.marketing && typeof payload.marketing === "object"
          ? (payload.marketing as { session_id?: string; landing_site?: string })
          : undefined;

      const sourceRaw = typeof payload.source === "string" ? payload.source.toLowerCase() : "";
      const browserSource: "synapse" | "elevar" =
        sourceRaw.includes("elevar") ? "elevar" : "synapse";

      if (browserSource === "synapse") {
        const flags = await getDualRunFlags(env);
        if (!flags.synapse_enabled) {
          return addSecurityHeaders(
            addCorsHeaders(
              jsonResponse(
                { ok: true, accepted: false, disabled: true, source: "synapse" },
                202
              ),
              request,
              origin ?? undefined,
              allowedOrigins
            )
          );
        }
      }

      await hydrateBrowserEventsFromCache(env);

      // Drop identical source+event_id retries within a few seconds (client retry / double submit).
      if (eventId) {
        const dup = getRecentBrowserEvents(40).find(
          (row) =>
            row.source === browserSource &&
            row.event === eventName &&
            row.event_id === eventId &&
            Date.now() - Date.parse(row.observed_at) < 8_000
        );
        if (dup) {
          return addSecurityHeaders(
            addCorsHeaders(
              jsonResponse(
                {
                  ok: true,
                  accepted: true,
                  deduped: true,
                  key: dup.key,
                  event: eventName,
                  source: browserSource,
                  ingested: false
                },
                202
              ),
              request,
              origin ?? undefined,
              allowedOrigins
            )
          );
        }
      }

      const ingested = ingestBrowserEvent({
        source: browserSource,
        shop,
        event: eventName,
        event_id: eventId,
        currency: typeof payload.currency === "string" ? payload.currency : undefined,
        cart_total: typeof payload.cart_total === "string" ? payload.cart_total : undefined,
        ecommerce: payload.ecommerce,
        marketing
      });

      const record = {
        receivedAt: ingested.observed_at,
        source: browserSource === "elevar" ? "edge-elevar-mirror" : "edge-browser-beacon",
        shop,
        event: eventName,
        event_id: eventId,
        key: ingested.key,
        payload: redactSensitive(payload)
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
      await persistBrowserEventsToCache(env);
      if (browserSource === "synapse") {
        await hydrateChannelEventsFromCache(env);
        recordSynapseBrowserChannel(eventName, eventId, shop);
        await persistChannelEventsToCache(env);
      }

      return addSecurityHeaders(
        addCorsHeaders(
          jsonResponse(
            {
              ok: true,
              accepted: true,
              key: ingested.key,
              event: eventName,
              source: browserSource,
              ingested: true
            },
            202
          ),
          request,
          origin ?? undefined,
          allowedOrigins
        )
      );
    }

    if (url.pathname === "/event" && request.method === "POST") {
      const allowedOrigins = parseAllowedOrigins(env.PUBLIC_EVENT_ALLOWED_ORIGINS);
      const origin = request.headers.get("origin");
      if (!origin || !isAllowedOrigin(origin, allowedOrigins)) {
        return addSecurityHeaders(addCorsHeaders(jsonResponse({ ok: false, error: "Origin not allowed" }, 403), request, origin ?? undefined, allowedOrigins));
      }

      const rate = checkEventRateLimit(request, env);
      if (!rate.allowed) {
        return addSecurityHeaders(
          addCorsHeaders(
            jsonResponse({ ok: false, error: "Rate limit exceeded" }, 429),
            request,
            origin,
            allowedOrigins
          )
        );
      }

      const maxBodyBytes = parsePositiveInt(env.PUBLIC_EVENT_MAX_BODY_BYTES, 16_384);
      const contentLengthRaw = request.headers.get("content-length");
      if (contentLengthRaw) {
        const contentLength = Number.parseInt(contentLengthRaw, 10);
        if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
          return addSecurityHeaders(addCorsHeaders(jsonResponse({ ok: false, error: "Payload too large" }, 413), request, origin, allowedOrigins));
        }
      }

      const rawBody = await request.text();
      const rawBodyBytes = new TextEncoder().encode(rawBody).byteLength;
      if (rawBodyBytes > maxBodyBytes) {
        return addSecurityHeaders(addCorsHeaders(jsonResponse({ ok: false, error: "Payload too large" }, 413), request, origin, allowedOrigins));
      }

      let payload: unknown = null;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        return addSecurityHeaders(addCorsHeaders(jsonResponse({ ok: false, error: "Invalid JSON payload" }, 400), request, origin, allowedOrigins));
      }

      const eventRecord = {
        receivedAt: new Date().toISOString(),
        source: "edge-event-endpoint",
        payload: redactSensitive(payload)
      };

      edgeWebhookLog.unshift(eventRecord);
      edgeShadowComparisons.unshift({
        type: "synapse_only",
        comparedAt: eventRecord.receivedAt,
        score: 100,
        payload: redactSensitive(payload)
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
          origin,
          allowedOrigins
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

    const native = await handleNativeApi(request, env);
    if (native) {
      return addSecurityHeaders(native);
    }

    if (shouldProxy(url.pathname)) {
      return proxyRequest(request, env);
    }

    return serveAsset(request, env);
  }
};
