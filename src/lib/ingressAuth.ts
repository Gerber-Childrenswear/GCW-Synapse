import type { Request, Response, NextFunction } from "express";
import { incrementCounter } from "../services/metrics";
import { logWarn } from "./logger";

export function createIngressTokenMiddleware(sharedToken: string | undefined) {
  return function requireIngressToken(req: Request, res: Response, next: NextFunction): void {
    if (!sharedToken) {
      next();
      return;
    }

    const token = req.get("X-Synapse-Token");
    if (token === sharedToken) {
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
