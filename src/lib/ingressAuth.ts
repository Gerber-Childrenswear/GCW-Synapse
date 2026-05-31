import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { incrementCounter } from "../services/metrics";
import { logWarn } from "./logger";

function timingSafeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
}

export function createIngressTokenMiddleware(sharedToken: string | undefined) {
  return function requireIngressToken(req: Request, res: Response, next: NextFunction): void {
    if (!sharedToken) {
      next();
      return;
    }

    const token = req.get("X-Synapse-Token");
    if (token && timingSafeEquals(token, sharedToken)) {
      next();
      return;
    }

    incrementCounter("ingress_token_rejected");
    logWarn("Ingress token rejected", {
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    res.status(401).json({ error: "Unauthorized" });
  };
}
