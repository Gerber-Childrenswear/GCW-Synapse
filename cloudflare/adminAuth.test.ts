import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAdminAuthorized,
  isAdminPasswordConfigured,
  mintAdminSessionCookie,
  resolveAdminPassword,
  sessionCookieValid,
  timingSafeEqualString,
  isPublicUnauthenticatedPath
} from "./adminAuth";

describe("adminAuth", () => {
  it("requires env password — no repo default", () => {
    assert.equal(resolveAdminPassword({}), "");
    assert.equal(isAdminPasswordConfigured({}), false);
    assert.equal(isAdminPasswordConfigured({ ADMIN_UI_PASSWORD: "Sugi2.0" }), true);
  });

  it("keeps storefront and webhook paths public", () => {
    assert.equal(isPublicUnauthenticatedPath("/gcw-synapse.js", "GET"), true);
    assert.equal(isPublicUnauthenticatedPath("/gcw-synapse.js", "HEAD"), true);
    assert.equal(isPublicUnauthenticatedPath("/gcw-synapse.js.map", "GET"), false);
    assert.equal(isPublicUnauthenticatedPath("/compatibility/ids", "GET"), true);
    assert.equal(isPublicUnauthenticatedPath("/compatibility/ids", "HEAD"), true);
    assert.equal(isPublicUnauthenticatedPath("/browser/beacon", "POST"), true);
    assert.equal(isPublicUnauthenticatedPath("/webhooks/shopify/orders/create", "POST"), true);
    assert.equal(isPublicUnauthenticatedPath("/ops/wire", "GET"), false);
    assert.equal(isPublicUnauthenticatedPath("/", "GET"), false);
  });

  it("mints a cookie that authorizes subsequent requests", async () => {
    const password = "test-admin-pass";
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
      headers: { "X-Synapse-Token": "test-admin-pass" }
    });
    assert.equal(await isAdminAuthorized(request, { ADMIN_UI_PASSWORD: "test-admin-pass" }), true);
  });

  it("denies all admin auth when password is unset", async () => {
    const request = new Request("https://example.com/ops/connection", {
      headers: { "X-Synapse-Token": "Sugi2.0" }
    });
    assert.equal(await isAdminAuthorized(request, {}), false);
  });

  it("timingSafeEqualString rejects mismatches", () => {
    assert.equal(timingSafeEqualString("abc", "abc"), true);
    assert.equal(timingSafeEqualString("abc", "wrong"), false);
  });
});
