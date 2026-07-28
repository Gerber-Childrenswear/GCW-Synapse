/**
 * Contract tests for Worker security / launch-gate behavior.
 * These exercise the same modules the Worker fetch handler uses
 * (auth, webhooks, synthetic exclusion) without spinning Miniflare.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAdminAuthorized, resolveAdminPassword } from "./adminAuth";
import { buildLaunchReadiness } from "./launchReadinessEdge";
import {
  getBrowserParityReport,
  ingestBrowserEvent,
  resetBrowserEventsForTests
} from "../src/services/browserEvents";
import { processPurchaseWebhookEdge } from "../src/services/edgeWebhook";

describe("worker HTTP contracts", () => {
  it("ops-style auth: Bearer-style token alone is not enough; X-Synapse-Token works", async () => {
    const env = { ADMIN_UI_PASSWORD: "gate-secret" };
    const bearer = new Request("https://edge.example/ops/connection", {
      headers: { Authorization: "Bearer gate-secret" }
    });
    const synapse = new Request("https://edge.example/ops/connection", {
      headers: { "X-Synapse-Token": "gate-secret" }
    });
    assert.equal(await isAdminAuthorized(bearer, env), false);
    assert.equal(await isAdminAuthorized(synapse, env), true);
  });

  it("webhook POST without secret is always 401", async () => {
    const raw = new TextEncoder().encode(JSON.stringify({ name: "#9", total_price: "10.00" }));
    for (const mode of ["forward", "shadow_compare", "shadow"]) {
      const result = await processPurchaseWebhookEdge({
        env: { RUNTIME_MODE: mode },
        rawBody: raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
        hmacHeader: "anything",
        shop: "gcw-dev.myshopify.com",
        topic: "orders/paid"
      });
      assert.equal(result.status, 401, mode);
      assert.equal(result.body.error, "webhook_secret_not_configured", mode);
    }
  });

  it("launch/readiness GO cannot be faked by demo-seed synthetic pairs", () => {
    resetBrowserEventsForTests();
    for (let i = 0; i < 8; i += 1) {
      ingestBrowserEvent({
        source: "synapse",
        shop: "gcw-dev.myshopify.com",
        event: "dl_purchase",
        event_id: `demo_syn_dl_purchase_${i}`,
        cart_total: "29.99",
        synthetic: true
      });
      ingestBrowserEvent({
        source: "elevar",
        shop: "gcw-dev.myshopify.com",
        event: "dl_purchase",
        event_id: `demo_elv_dl_purchase_${i}`,
        cart_total: "29.99",
        synthetic: true
      });
    }

    const all = getBrowserParityReport(5);
    assert.ok(all.synapse_events >= 5);

    const real = getBrowserParityReport(5, { excludeSynthetic: true });
    const launch = buildLaunchReadiness(
      { status: "ok", matched_rate_pct: 100 },
      real
    );
    assert.notEqual(launch.status, "go");
    assert.ok(launch.status === "ready" || launch.status === "waiting");
  });

  it("empty ADMIN_UI_PASSWORD resolves to deny", () => {
    assert.equal(resolveAdminPassword({ ADMIN_UI_PASSWORD: "  " }), "");
  });
});
