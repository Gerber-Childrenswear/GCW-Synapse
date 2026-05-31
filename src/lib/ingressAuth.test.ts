import test from "node:test";
import assert from "node:assert/strict";
import type { Request, Response, NextFunction } from "express";
import { createIngressTokenMiddleware } from "./ingressAuth";

function mockRequest(token: string | undefined): Request {
  return {
    get: (header: string) => {
      if (header === "X-Synapse-Token") {
        return token;
      }
      return undefined;
    },
    path: "/diagnostics",
    method: "GET",
    ip: "127.0.0.1"
  } as unknown as Request;
}

function mockResponse() {
  const state = { statusCode: 200, body: undefined as unknown };
  const res = {
    status: (code: number) => {
      state.statusCode = code;
      return res;
    },
    json: (body: unknown) => {
      state.body = body;
      return res;
    }
  } as unknown as Response;

  return { res, state };
}

test("ingress middleware allows request when token is disabled", () => {
  const middleware = createIngressTokenMiddleware(undefined);
  const req = mockRequest(undefined);
  const { res } = mockResponse();

  let nextCalled = false;
  const next: NextFunction = () => {
    nextCalled = true;
  };

  middleware(req, res, next);
  assert.equal(nextCalled, true);
});

test("ingress middleware rejects request with invalid token", () => {
  const middleware = createIngressTokenMiddleware("expected-token");
  const req = mockRequest("wrong-token");
  const { res, state } = mockResponse();

  let nextCalled = false;
  const next: NextFunction = () => {
    nextCalled = true;
  };

  middleware(req, res, next);
  assert.equal(nextCalled, false);
  assert.equal(state.statusCode, 401);
});

test("ingress middleware allows request with valid token", () => {
  const middleware = createIngressTokenMiddleware("expected-token");
  const req = mockRequest("expected-token");
  const { res } = mockResponse();

  let nextCalled = false;
  const next: NextFunction = () => {
    nextCalled = true;
  };

  middleware(req, res, next);
  assert.equal(nextCalled, true);
});
