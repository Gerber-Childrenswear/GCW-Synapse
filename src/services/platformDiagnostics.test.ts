import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { diagnoseErrorMessage, dedupeKeyFieldForPlatform } from "./platformDiagnostics";
import {
  ingestChannelEvent,
  resetChannelHealthForTests,
  getChannelTroubleshooting
} from "./channelHealth";
import { buildPlatformMatrix } from "./platformMatrix";

describe("platformDiagnostics", () => {
  it("maps Meta token errors to CAPI docs", () => {
    const causes = diagnoseErrorMessage("meta", "OAuthException error code 190 invalid access token");
    assert.ok(causes.some((c) => c.code === "meta.oauth_190"));
    assert.ok(causes[0]?.doc_url.includes("facebook.com") || causes.some((c) => c.doc_url.includes("facebook")));
  });

  it("maps TikTok access token failures", () => {
    const causes = diagnoseErrorMessage("tiktok", "access_token_invalid: Events API access token is invalid");
    assert.ok(causes.some((c) => c.code === "tiktok.token"));
  });

  it("uses transaction_id for GA4 dedupe key field", () => {
    assert.equal(dedupeKeyFieldForPlatform("ga4"), "transaction_id");
    assert.equal(dedupeKeyFieldForPlatform("meta"), "event_id");
  });
});

describe("platformMatrix dedupe", () => {
  it("confirms Meta dedupe when event_id matches across surfaces", () => {
    resetChannelHealthForTests();
    ingestChannelEvent({
      channel: "meta",
      surface: "pixel",
      destination: "Meta Pixel",
      event_name: "Purchase",
      event_id: "evt_shared_1",
      status: "ok"
    });
    ingestChannelEvent({
      channel: "meta",
      surface: "server",
      destination: "Meta CAPI",
      event_name: "Purchase",
      event_id: "evt_shared_1",
      status: "ok"
    });

    const matrix = buildPlatformMatrix(90, 5);
    const meta = matrix.platforms.find((p) => p.id === "meta");
    assert.ok(meta);
    assert.equal(meta.dedupe.status, "confirmed");
    assert.equal(meta.dedupe.confirmed, 1);
    assert.equal(meta.status, "healthy");
  });

  it("diagnoses TikTok server token errors as critical causes", () => {
    resetChannelHealthForTests();
    ingestChannelEvent({
      channel: "tiktok",
      surface: "pixel",
      destination: "TikTok Pixel",
      event_name: "ViewContent",
      event_id: "tt_a",
      status: "ok"
    });
    ingestChannelEvent({
      channel: "tiktok",
      surface: "server",
      destination: "TikTok Events API",
      event_name: "ViewContent",
      event_id: "tt_b",
      status: "error",
      error_message: "access_token_invalid"
    });

    const matrix = buildPlatformMatrix(90, 5);
    const tiktok = matrix.platforms.find((p) => p.id === "tiktok");
    assert.ok(tiktok);
    assert.equal(tiktok.status, "critical");
    assert.ok(tiktok.causes.some((c) => c.code === "tiktok.token" || c.code.includes("token")));

    const issues = getChannelTroubleshooting({
      totals: { tracked_integrations: 1, healthy: 0, warning: 0, critical: 1 },
      channels: []
    });
    assert.ok(Array.isArray(issues));
  });
});
