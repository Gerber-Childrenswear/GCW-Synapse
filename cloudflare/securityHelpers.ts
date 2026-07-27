/**
 * Shared security helpers for the edge Worker.
 */

const SENSITIVE_KEY =
  /^(email|phone|password|token|secret|authorization|hmac|address|first_name|last_name|zip|postal|ssn|credit)/i;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function redactSensitive(value: unknown, depth = 0): unknown {
  if (depth > 6 || value == null) return value;
  if (Array.isArray(value)) return value.map((v) => redactSensitive(v, depth + 1));
  if (typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key)) {
      out[key] = "[redacted]";
      continue;
    }
    out[key] = redactSensitive(child, depth + 1);
  }
  return out;
}

export function isAllowedCorsOrigin(origin: string | null, allowlist: string[]): origin is string {
  if (!origin) return false;
  return allowlist.includes(origin);
}

/** Cookie-authed mutations: require same-origin / Shopify embed Origin (or API token). */
export function mutationOriginAllowed(request: Request, workerHost: string): boolean {
  // Explicit API token / Basic auth callers are not CSRF'd via cookies.
  if (request.headers.get("X-Synapse-Token")?.trim()) return true;
  if ((request.headers.get("authorization") || "").toLowerCase().startsWith("basic ")) return true;

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const host = new URL(origin).host.toLowerCase();
      if (host === workerHost.toLowerCase()) return true;
      if (host === "admin.shopify.com") return true;
      if (host.endsWith(".myshopify.com")) return true;
      return false;
    } catch {
      return false;
    }
  }

  const site = (request.headers.get("sec-fetch-site") || "").toLowerCase();
  if (site === "same-origin" || site === "none") return true;
  // Missing Origin + missing Sec-Fetch-Site (e.g. older curl) — allow only non-browser tools with token.
  // Without token, reject mutating requests that look like cross-site.
  if (!site) return false;
  return false;
}

export function isMutatingMethod(method: string): boolean {
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

type LoginBucket = { count: number; windowStartMs: number };
const loginAttempts = new Map<string, LoginBucket>();

export function checkLoginRateLimit(
  ip: string,
  limit = 20,
  windowMs = 60_000
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const key = ip || "unknown";
  const current = loginAttempts.get(key);
  if (!current || now - current.windowStartMs >= windowMs) {
    loginAttempts.set(key, { count: 1, windowStartMs: now });
    return { allowed: true, retryAfterSec: 0 };
  }
  current.count += 1;
  if (current.count > limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - current.windowStartMs)) / 1000))
    };
  }
  return { allowed: true, retryAfterSec: 0 };
}

export function assertHttpsUrlAllowlisted(
  raw: string,
  allowedHostSuffixes: string[]
): { ok: true; url: URL } | { ok: false; error: string } {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, error: "invalid_url" };
  }
  if (parsed.protocol !== "https:") return { ok: false, error: "https_required" };
  const host = parsed.hostname.toLowerCase();
  const allowed = allowedHostSuffixes.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`)
  );
  if (!allowed) return { ok: false, error: "host_not_allowlisted" };
  return { ok: true, url: parsed };
}
