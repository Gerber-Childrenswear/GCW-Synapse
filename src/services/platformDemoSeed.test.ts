import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ingestChannelEvent,
  resetChannelHealthForTests
} from "./channelHealth";
import { buildPlatformMatrix } from "./platformMatrix";
import { buildDemoSamples, buildBrokenDemoSamples } from "./platformDemoSeed";

describe("platformDemoSeed", () => {
  it("healthy seed lights Meta + TikTok green with confirmed dedupe", () => {
    resetChannelHealthForTests();
    const now = Date.now();
    for (const sample of buildDemoSamples("healthy")) {
      ingestChannelEvent({
        channel: sample.channel,
        surface: sample.surface,
        destination: sample.destination,
        pixel_id: sample.pixel_id,
        event_name: sample.event_name,
        event_id: sample.event_id,
        transaction_id: sample.transaction_id,
        status: sample.status,
        error_message: sample.error_message,
        observed_at: new Date(now - sample.minutesAgo * 60_000).toISOString()
      });
    }

    const matrix = buildPlatformMatrix(90, 5);
    assert.equal(matrix.totals.critical, 0);
    assert.equal(matrix.totals.warning, 0);
    assert.equal(matrix.totals.idle, 0);
    assert.equal(matrix.totals.healthy, matrix.totals.platforms);

    const meta = matrix.platforms.find((p) => p.id === "meta");
    const tiktok = matrix.platforms.find((p) => p.id === "tiktok");
    assert.ok(meta && tiktok);
    assert.equal(meta.status, "healthy");
    assert.equal(meta.dedupe.status, "confirmed");
    assert.equal(meta.coverage_pct, 100);
    assert.equal(tiktok.status, "healthy");
    assert.equal(tiktok.dedupe.status, "confirmed");
    assert.equal(tiktok.coverage_pct, 100);
  });

  it("broken seed keeps TikTok critical for diagnostics", () => {
    resetChannelHealthForTests();
    const now = Date.now();
    for (const sample of buildBrokenDemoSamples()) {
      ingestChannelEvent({
        channel: sample.channel,
        surface: sample.surface,
        destination: sample.destination,
        pixel_id: sample.pixel_id,
        event_name: sample.event_name,
        event_id: sample.event_id,
        transaction_id: sample.transaction_id,
        status: sample.status,
        error_message: sample.error_message,
        observed_at: new Date(now - sample.minutesAgo * 60_000).toISOString()
      });
    }

    const matrix = buildPlatformMatrix(90, 5);
    const tiktok = matrix.platforms.find((p) => p.id === "tiktok");
    assert.ok(tiktok);
    assert.equal(tiktok.status, "critical");
    assert.ok(tiktok.causes.some((c) => c.code === "tiktok.token"));
  });

  it("treats CJ server-only traffic as healthy (server_primary)", () => {
    resetChannelHealthForTests();
    ingestChannelEvent({
      channel: "cj",
      surface: "server",
      destination: "CJ AffNet",
      event_name: "purchase",
      transaction_id: "GCW-99",
      status: "ok"
    });
    const matrix = buildPlatformMatrix(90, 5);
    const cj = matrix.platforms.find((p) => p.id === "cj");
    assert.ok(cj);
    assert.equal(cj.status, "healthy");
    assert.equal(cj.causes.length, 0);
  });
});
