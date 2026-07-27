import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_ADMIN_UI_PASSWORD,
  isPublicUnauthenticatedPath,
  mintAdminSessionCookie,
  resolveAdminPassword,
  sessionCookieValid,
  timingSafeEqualString,
  isAdminAuthorized
} from "./adminAuth";

describe("adminAuth", () => {
  it("defaults password to Sugi2.0", () => {
    assert.equal(resolveAdminPassword({}), DEFAULT_ADMIN_UI_PASSWORD);
    assert.equal(DEFAULT_ADMIN_UI_PASSWORD, "Sugi2.0");
  });

  it("keeps storefront and webhook paths public", () => {
    assert.equal(isPublicUnauthenticatedPath("/gcw-synapse.js", "GET"), true);
    assert.equal(isPublicUnauthenticatedPath("/gcw-synapse.js.map", "GET"), false);
    assert.equal(isPublicUnauthenticatedPath("/compatibility/ids", "GET"), true);
    assert.equal(isPublicUnauthenticatedPath("/browser/beacon", "POST"), true);
    assert.equal(isPublicUnauthenticatedPath("/webhooks/shopify/orders/create", "POST"), true);
    assert.equal(isPublicUnauthenticatedPath("/ops/wire", "GET"), false);
    assert.equal(isPublicUnauthenticatedPath("/", "GET"), false);
  });

  it("mints a cookie that authorizes subsequent requests", async () => {
    const password = "Sugi2.0";
    const setCookie = await mintAdminSessionCookie(password);
    const value = setCookie.split(";")[0]?.split("=").slice(1).join("=") ?? "";
    const request = new Request("https://example.com/", {
      headers: { cookie: `synapse_gate=${value}` }
    });
    assert.equal(await sessionCookieValid(request, password), true);
    assert.equal(await isAdminAuthorized(request, { ADMIN_UI_PASSWORD: password }), true);
  });

  it("accepts X-Synapse-Token matching password", async () => {
    const request = new Request("https://example.com/ops/connection", {
      headers: { "X-Synapse-Token": "Sugi2.0" }
    });
    assert.equal(await isAdminAuthorized(request, {}), true);
  });

  it("timingSafeEqualString rejects mismatches", () => {
    assert.equal(timingSafeEqualString("Sugi2.0", "Sugi2.0"), true);
    assert.equal(timingSafeEqualString("Sugi2.0", "wrong"), false);
  });
});
