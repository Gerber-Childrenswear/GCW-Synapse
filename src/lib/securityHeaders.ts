import type { Request, Response, NextFunction } from "express";

/**
 * Minimal, dependency-free security headers for an API service.
 * These are safe defaults for a JSON ingestion/compatibility API that
 * does not serve HTML.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  next();
}
