import test from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { securityHeaders } from "./securityHeaders";

test("securityHeaders sets hardened defaults and calls next", () => {
  const headers: Record<string, string> = {};
  const res = {
    setHeader: (key: string, value: string) => {
      headers[key] = value;
    }
  } as unknown as Response;

  let nextCalled = false;
  securityHeaders({} as Request, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["Referrer-Policy"], "no-referrer");
});
