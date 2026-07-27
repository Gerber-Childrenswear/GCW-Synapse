import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertHttpsUrlAllowlisted,
  checkLoginRateLimit,
  escapeHtml,
  isMutatingMethod,
  mutationOriginAllowed,
  redactSensitive
} from "./securityHelpers";

describe("securityHelpers", () => {
  it("escapes HTML", () => {
    assert.equal(escapeHtml(`<script>"x"'`), "&lt;script&gt;&quot;x&quot;&#39;");
  });

  it("redacts sensitive keys", () => {
    const redacted = redactSensitive({
      email: "a@b.com",
      phone: "123",
      order_id: "1",
      nested: { password: "x", ok: true }
    }) as Record<string, unknown>;
    assert.equal(redacted.email, "[redacted]");
    assert.equal(redacted.phone, "[redacted]");
    assert.equal(redacted.order_id, "1");
    assert.equal((redacted.nested as Record<string, unknown>).password, "[redacted]");
    assert.equal((redacted.nested as Record<string, unknown>).ok, true);
  });

  it("allows same-origin mutations and token callers", () => {
    const host = "gcw-synapse-super.gcwsynapse.workers.dev";
    const same = new Request("https://example.com/ops", {
      method: "POST",
      headers: { Origin: `https://${host}` }
    });
    assert.equal(mutationOriginAllowed(same, host), true);

    const evil = new Request("https://example.com/ops", {
      method: "POST",
      headers: { Origin: "https://evil.example" }
    });
    assert.equal(mutationOriginAllowed(evil, host), false);

    const token = new Request("https://example.com/ops", {
      method: "POST",
      headers: { Origin: "https://evil.example", "X-Synapse-Token": "Sugi2.0" }
    });
    assert.equal(mutationOriginAllowed(token, host), true);
  });

  it("rate limits login attempts", () => {
    const ip = `test-${Math.random()}`;
    for (let i = 0; i < 20; i += 1) {
      assert.equal(checkLoginRateLimit(ip, 20).allowed, true);
    }
    assert.equal(checkLoginRateLimit(ip, 20).allowed, false);
  });

  it("validates https allowlisted URLs", () => {
    assert.equal(assertHttpsUrlAllowlisted("https://sgtm.example.com/collect", ["example.com"]).ok, true);
    assert.equal(assertHttpsUrlAllowlisted("http://sgtm.example.com/collect", ["example.com"]).ok, false);
    assert.equal(assertHttpsUrlAllowlisted("https://evil.com/x", ["example.com"]).ok, false);
  });

  it("detects mutating methods", () => {
    assert.equal(isMutatingMethod("POST"), true);
    assert.equal(isMutatingMethod("GET"), false);
  });
});
