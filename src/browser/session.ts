const SESSION_COOKIE = "synapse_sid";
const LANDING_COOKIE = "synapse_landing";
const UTM_COOKIE = "synapse_utm";
const COOKIE_DAYS = 365;

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function writeCookie(name: string, value: string, days = COOKIE_DAYS): void {
  if (typeof document === "undefined") return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export type SynapseSession = {
  session_id: string;
  landing_site: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
};

export function getOrCreateSession(): SynapseSession {
  let sessionId = readCookie(SESSION_COOKIE);
  if (!sessionId) {
    sessionId = randomId();
    writeCookie(SESSION_COOKIE, sessionId);
  }

  const href = typeof location !== "undefined" ? location.href : "";
  let landing = readCookie(LANDING_COOKIE);
  if (!landing && href) {
    landing = href;
    writeCookie(LANDING_COOKIE, landing);
  }

  const params = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
  const existingUtm = readCookie(UTM_COOKIE);
  let utm: Record<string, string> = {};
  if (existingUtm) {
    try {
      utm = JSON.parse(existingUtm) as Record<string, string>;
    } catch {
      utm = {};
    }
  }

  const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
  let touched = false;
  for (const key of utmKeys) {
    const value = params.get(key);
    if (value) {
      utm[key] = value;
      touched = true;
    }
  }
  if (touched) {
    writeCookie(UTM_COOKIE, JSON.stringify(utm));
  }

  const session: SynapseSession = {
    session_id: sessionId,
    landing_site: landing ?? href
  };

  if (utm.utm_source) session.utm_source = utm.utm_source;
  if (utm.utm_medium) session.utm_medium = utm.utm_medium;
  if (utm.utm_campaign) session.utm_campaign = utm.utm_campaign;
  if (utm.utm_content) session.utm_content = utm.utm_content;
  if (utm.utm_term) session.utm_term = utm.utm_term;

  return session;
}

/** Persist session markers onto the Shopify cart so order webhooks can enrich purchase. */
export async function syncCartAttributes(session: SynapseSession): Promise<void> {
  if (typeof fetch === "undefined") return;
  try {
    await fetch("/cart/update.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attributes: {
          synapse_session_id: session.session_id,
          synapse_landing_site: session.landing_site,
          synapse_utm_source: session.utm_source ?? "",
          synapse_utm_medium: session.utm_medium ?? "",
          synapse_utm_campaign: session.utm_campaign ?? ""
        }
      }),
      credentials: "same-origin",
      keepalive: true
    });
  } catch {
    // Cart API may be unavailable on some pages.
  }
}
