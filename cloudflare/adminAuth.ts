/**
 * Admin UI + internal API gate for the public workers.dev / Shopify embed surface.
 * Accepts: session cookie, HTTP Basic, or X-Synapse-Token.
 */

export type AdminAuthEnv = {
  ADMIN_UI_PASSWORD?: string;
  SYNAPSE_INGRESS_TOKEN?: string;
};

const COOKIE_NAME = "synapse_gate";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours
/** Default password requested for the public admin / Shopify embed gate. */
export const DEFAULT_ADMIN_UI_PASSWORD = "Sugi2.0";

export function resolveAdminPassword(env: AdminAuthEnv): string {
  const fromAdmin = env.ADMIN_UI_PASSWORD?.trim();
  if (fromAdmin) return fromAdmin;
  const fromIngress = env.SYNAPSE_INGRESS_TOKEN?.trim();
  if (fromIngress) return fromIngress;
  return DEFAULT_ADMIN_UI_PASSWORD;
}

/** Session HMAC key — derived so raw password reuse alone is not enough if rotated separately later. */
export function resolveSessionSigningKey(env: AdminAuthEnv & { SESSION_HMAC_SECRET?: string }): string {
  const dedicated = env.SESSION_HMAC_SECRET?.trim();
  if (dedicated) return dedicated;
  return `synapse_session_v1:${resolveAdminPassword(env)}`;
}

export function timingSafeEqualString(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const left = enc.encode(a);
  const right = enc.encode(b);
  const len = Math.max(left.length, right.length);
  let mismatch = left.length === right.length ? 0 : 1;
  for (let i = 0; i < len; i += 1) {
    mismatch |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return mismatch === 0;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function mintAdminSessionCookie(
  password: string,
  sessionKey = `synapse_session_v1:${password}`
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const sig = await hmacHex(sessionKey, `synapse_gate_v1:${exp}`);
  const value = `${exp}.${sig}`;
  // SameSite=None so Shopify admin iframe can keep the session.
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearAdminSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0`;
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === name) return rest.join("=") || "";
  }
  return null;
}

export async function sessionCookieValid(
  request: Request,
  password: string,
  sessionKey = `synapse_session_v1:${password}`
): Promise<boolean> {
  const raw = readCookie(request, COOKIE_NAME);
  if (!raw) return false;
  const [expRaw, sig] = raw.split(".");
  const exp = Number(expRaw);
  if (!expRaw || !sig || !Number.isFinite(exp)) return false;
  if (exp < Math.floor(Date.now() / 1000)) return false;
  const expected = await hmacHex(sessionKey, `synapse_gate_v1:${exp}`);
  return timingSafeEqualString(sig, expected);
}

function basicAuthPassword(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header || !header.toLowerCase().startsWith("basic ")) return null;
  try {
    const decoded = atob(header.slice(6).trim());
    const colon = decoded.indexOf(":");
    if (colon < 0) return decoded;
    return decoded.slice(colon + 1);
  } catch {
    return null;
  }
}

export async function isAdminAuthorized(
  request: Request,
  env: AdminAuthEnv & { SESSION_HMAC_SECRET?: string }
): Promise<boolean> {
  const password = resolveAdminPassword(env);
  const sessionKey = resolveSessionSigningKey(env);
  const token = request.headers.get("X-Synapse-Token")?.trim() ?? "";
  if (token && timingSafeEqualString(token, password)) return true;

  const ingress = env.SYNAPSE_INGRESS_TOKEN?.trim();
  if (token && ingress && timingSafeEqualString(token, ingress)) return true;

  const basic = basicAuthPassword(request);
  if (basic && timingSafeEqualString(basic, password)) return true;

  if (await sessionCookieValid(request, password, sessionKey)) return true;
  return false;
}

/** Routes that must stay public (storefront + Shopify signed traffic). */
export function isPublicUnauthenticatedPath(pathname: string, method: string): boolean {
  if (pathname === "/health" && method === "GET") return true;
  if (pathname === "/event" && (method === "POST" || method === "OPTIONS")) return true;
  if (pathname === "/browser/beacon" && (method === "POST" || method === "OPTIONS")) return true;
  if (method === "POST" && pathname.startsWith("/webhooks/")) return true;
  if (
    method === "GET" &&
    (pathname === "/install" ||
      pathname === "/auth/shopify/install" ||
      pathname === "/auth/shopify/callback")
  ) {
    return true;
  }
  if (method === "GET" && (pathname === "/login" || pathname === "/auth/login")) return true;
  if (method === "POST" && (pathname === "/login" || pathname === "/auth/login")) return true;
  if (method === "POST" && pathname === "/auth/logout") return true;
  // Theme CDN bundle — must load without password on storefront.
  if (method === "GET" && pathname === "/gcw-synapse.js") {
    return true;
  }
  // Public pixel / measurement IDs only (no secrets) — used by GTM HTTP variables.
  if (method === "GET" && pathname.startsWith("/compatibility/")) {
    return true;
  }
  return false;
}

export function wantsHtml(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("text/html");
}

export function loginPageHtml(options: {
  returnTo: string;
  error?: string;
  embedded?: boolean;
}): string {
  const err = options.error
    ? `<p class="err">${escapeHtml(options.error)}</p>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SYNAPSE · Sign in</title>
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      font-family: "IBM Plex Sans", system-ui, sans-serif;
      background:
        radial-gradient(ellipse 60% 50% at 20% 30%, rgba(61,214,255,.18), transparent 55%),
        radial-gradient(ellipse 50% 40% at 80% 20%, rgba(177,75,255,.22), transparent 50%),
        #07111f;
      color: #e8f0fa;
    }
    form {
      width: min(360px, 92vw); padding: 28px 24px; border-radius: 16px;
      border: 1px solid rgba(61,214,255,.22);
      background: rgba(8,18,32,.88);
      box-shadow: 0 20px 60px rgba(0,0,0,.45);
    }
    h1 { margin: 0 0 6px; font-size: 1.35rem; letter-spacing: .18em; }
    p { margin: 0 0 18px; color: #8aa0b8; font-size: .92rem; }
    label { display: block; font-size: .78rem; letter-spacing: .08em; text-transform: uppercase; color: #8aa0b8; margin-bottom: 6px; }
    input[type=password] {
      width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 10px;
      border: 1px solid rgba(255,255,255,.18); background: #0a1628; color: #fff; font-size: 1rem;
    }
    button {
      margin-top: 16px; width: 100%; padding: 12px 14px; border: 0; border-radius: 10px;
      font-weight: 700; cursor: pointer; color: #061018;
      background: linear-gradient(135deg, #3dd6ff, #7b6cff);
    }
    .err { color: #ff8f8f; margin: 0 0 12px; font-size: .9rem; }
  </style>
</head>
<body>
  <form method="POST" action="/login">
    <h1>SYNAPSE</h1>
    <p>${options.embedded ? "Shopify app unlock" : "Admin access"}</p>
    ${err}
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required autofocus />
    <input type="hidden" name="return_to" value="${escapeHtml(options.returnTo)}" />
    <button type="submit">Unlock</button>
  </form>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function unauthorizedJson(): Response {
  return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
    status: 401,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "WWW-Authenticate": 'Basic realm="GCW Synapse"'
    }
  });
}

export function loginRedirect(request: Request): Response {
  const url = new URL(request.url);
  const returnTo = `${url.pathname}${url.search}`;
  const loc = `/login?return_to=${encodeURIComponent(returnTo)}`;
  return new Response(null, {
    status: 302,
    headers: { Location: loc, "Cache-Control": "no-store" }
  });
}
