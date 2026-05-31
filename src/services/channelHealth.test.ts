import test from "node:test";
import assert from "node:assert/strict";
import {
  getChannelHealthSummary,
  getChannelTroubleshooting,
  ingestChannelEvent,
  resetChannelHealthForTests
} from "./channelHealth";

test("channel health tracks per-pixel events and marks healthy", () => {
  resetChannelHealthForTests();

  ingestChannelEvent({
    channel: "facebook",
    surface: "pixel",
    destination: "meta",
    pixel_id: "12345",
    event_name: "purchase",
    status: "ok"
  });

  const summary = getChannelHealthSummary(90, 5);
  assert.equal(summary.totals.tracked_integrations, 1);
  assert.equal(summary.channels[0]?.status, "healthy");
});

test("channel health detects elevated failures and emits troubleshooting", () => {
  resetChannelHealthForTests();

  ingestChannelEvent({
    channel: "reddit",
    surface: "server",
    destination: "reddit-capi",
    event_name: "purchase",
    status: "error",
    error_message: "400 invalid value"
  });

  ingestChannelEvent({
    channel: "reddit",
    surface: "server",
    destination: "reddit-capi",
    event_name: "purchase",
    status: "ok"
  });

  const summary = getChannelHealthSummary(90, 5);
  assert.equal(summary.channels[0]?.status !== "healthy", true);

  const issues = getChannelTroubleshooting(summary);
  assert.equal(issues.length >= 1, true);
});
