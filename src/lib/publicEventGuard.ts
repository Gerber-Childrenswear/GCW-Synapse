import type { Request, Response, NextFunction } from "express";
import { incrementCounter } from "../services/metrics";
import { logWarn } from "./logger";
import { FixedWindowRateLimiter } from "./rateLimiter";

export type PublicEventGuardOptions = {
  rateLimitPerMinute: number;
  allowedOrigins: string[];
};

export function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((origin) => origin.trim().toLowerCase())
    .filter((origin) => origin.length > 0);
}

export function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  // When no allowlist is configured the endpoint is open (rate limited).
  if (allowedOrigins.length === 0) {
    return true;
  }

  if (!origin) {
    return false;
  }

  return allowedOrigins.includes(origin.toLowerCase());
}

function resolveAllowOriginHeader(origin: string | undefined, allowedOrigins: string[]): string {
  if (allowedOrigins.length === 0) {
    return origin ?? "*";
  }

  return origin ?? "";
}

/**
 * Guard for the public browser-facing /event endpoint.
 *
 * The browser cannot safely hold the admin ingress token, so this endpoint
 * is protected by:
 *  - CORS origin allowlist (configurable; open if unset)
 *  - per-IP rate limiting
 *  - strict payload validation + bot/consent suppression downstream
 *
 * It also answers CORS preflight (OPTIONS) requests.
 */
export function createPublicEventGuard(options: PublicEventGuardOptions) {
  const limiter = new FixedWindowRateLimiter({
    windowMs: 60_000,
    max: Math.max(1, options.rateLimitPerMinute)
  });
  let lastPrune = Date.now();

  return function publicEventGuard(req: Request, res: Response, next: NextFunction): void {
    const origin = req.get("Origin");
    const originAllowed = isOriginAllowed(origin, options.allowedOrigins);

    res.setHeader("Access-Control-Allow-Origin", resolveAllowOriginHeader(origin, options.allowedOrigins));
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Synapse-Token");
    res.setHeader("Access-Control-Max-Age", "600");

    if (req.method === "OPTIONS") {
      res.status(originAllowed ? 204 : 403).end();
      return;
    }

    if (!originAllowed) {
      incrementCounter("public_event_origin_rejected");
      logWarn("Public event rejected due to disallowed origin", { origin, ip: req.ip });
      res.status(403).json({ ok: false, error: "Origin not allowed" });
      return;
    }

    const now = Date.now();
    if (now - lastPrune > 60_000) {
      limiter.prune();
      lastPrune = now;
    }

    const key = req.ip ?? "unknown";
    const result = limiter.check(key);

    res.setHeader("X-RateLimit-Limit", String(options.rateLimitPerMinute));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, result.remaining)));

    if (!result.allowed) {
      incrementCounter("public_event_rate_limited");
      const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({ ok: false, error: "Too many requests" });
      return;
    }

    next();
  };
}
