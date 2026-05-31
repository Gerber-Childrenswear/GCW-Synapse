import test from "node:test";
import assert from "node:assert/strict";
import type { Request, Response, NextFunction } from "express";
import {
  createPublicEventGuard,
  isOriginAllowed,
  parseAllowedOrigins
} from "./publicEventGuard";

function mockRequest(options: { method?: string; origin?: string; ip?: string }): Request {
  return {
    method: options.method ?? "POST",
    ip: options.ip ?? "127.0.0.1",
    get: (header: string) => {
      if (header === "Origin") {
        return options.origin;
      }
      return undefined;
    }
  } as unknown as Request;
}

function mockResponse() {
  const state = {
    statusCode: 200,
    body: undefined as unknown,
    ended: false,
    headers: {} as Record<string, string>
  };
  const res = {
    setHeader: (key: string, value: string) => {
      state.headers[key] = value;
    },
    status: (code: number) => {
      state.statusCode = code;
      return res;
    },
    json: (body: unknown) => {
      state.body = body;
      return res;
    },
    end: () => {
      state.ended = true;
      return res;
    }
  } as unknown as Response;

  return { res, state };
}

test("parseAllowedOrigins normalizes and filters", () => {
  assert.deepEqual(parseAllowedOrigins(undefined), []);
  assert.deepEqual(
    parseAllowedOrigins("https://A.com, https://b.com ,"),
    ["https://a.com", "https://b.com"]
  );
});

test("isOriginAllowed opens when allowlist empty", () => {
  assert.equal(isOriginAllowed(undefined, []), true);
  assert.equal(isOriginAllowed("https://x.com", []), true);
});

test("isOriginAllowed enforces configured list", () => {
  const allowed = ["https://shop.com"];
  assert.equal(isOriginAllowed("https://shop.com", allowed), true);
  assert.equal(isOriginAllowed("https://evil.com", allowed), false);
  assert.equal(isOriginAllowed(undefined, allowed), false);
});

test("guard answers OPTIONS preflight with 204 for allowed origin", () => {
  const guard = createPublicEventGuard({ rateLimitPerMinute: 60, allowedOrigins: [] });
  const req = mockRequest({ method: "OPTIONS", origin: "https://shop.com" });
  const { res, state } = mockResponse();

  let nextCalled = false;
  guard(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(state.statusCode, 204);
  assert.equal(state.ended, true);
});

test("guard rejects disallowed origin with 403", () => {
  const guard = createPublicEventGuard({
    rateLimitPerMinute: 60,
    allowedOrigins: ["https://shop.com"]
  });
  const req = mockRequest({ origin: "https://evil.com" });
  const { res, state } = mockResponse();

  let nextCalled = false;
  guard(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(state.statusCode, 403);
});

test("guard passes an allowed POST through to next", () => {
  const guard = createPublicEventGuard({ rateLimitPerMinute: 60, allowedOrigins: [] });
  const req = mockRequest({ origin: "https://shop.com" });
  const { res } = mockResponse();

  let nextCalled = false;
  const next: NextFunction = () => {
    nextCalled = true;
  };
  guard(req, res, next);

  assert.equal(nextCalled, true);
});

test("guard rate limits a noisy IP with 429", () => {
  const guard = createPublicEventGuard({ rateLimitPerMinute: 1, allowedOrigins: [] });
  const first = mockRequest({ origin: "https://shop.com", ip: "9.9.9.9" });
  const second = mockRequest({ origin: "https://shop.com", ip: "9.9.9.9" });

  let firstNext = false;
  guard(first, mockResponse().res, () => {
    firstNext = true;
  });
  assert.equal(firstNext, true);

  const { res, state } = mockResponse();
  let secondNext = false;
  guard(second, res, () => {
    secondNext = true;
  });
  assert.equal(secondNext, false);
  assert.equal(state.statusCode, 429);
});
