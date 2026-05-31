import test from "node:test";
import assert from "node:assert/strict";
import { buildOpsAlerts } from "./opsAlerts";

function baseCounters() {
  return {
    webhooks_received: 0,
    webhooks_forwarded: 0,
    webhooks_forward_failed: 0,
    webhooks_invalid_signature: 0,
    refunds_received: 0,
    refunds_forwarded: 0,
    refunds_forward_failed: 0,
    refunds_invalid_signature: 0,
    ingress_token_rejected: 0,
    runtime_events_received: 0,
    runtime_events_rejected_invalid_payload: 0,
    runtime_events_forwarded: 0,
    runtime_events_suppressed: 0,
    gtm_dead_letter_written: 0
  };
}

test("buildOpsAlerts returns ok when no issues", () => {
  const result = buildOpsAlerts({
    counters: baseCounters(),
    runtimeTelemetry: { total: 0, forwarded: 0, suppressed: 0 },
    deadLetter: {
      configured: true,
      exists: false,
      total_records: 0,
      malformed_records: 0
    }
  });

  assert.equal(result.status, "ok");
  assert.equal(result.alerts.length, 0);
});

test("buildOpsAlerts escalates to critical on dead-letter backlog", () => {
  const counters = baseCounters();
  counters.webhooks_forward_failed = 2;

  const result = buildOpsAlerts({
    counters,
    runtimeTelemetry: { total: 10, forwarded: 8, suppressed: 2 },
    deadLetter: {
      configured: true,
      exists: true,
      total_records: 3,
      malformed_records: 0,
      last_recorded_at: "2026-05-30T02:00:00.000Z"
    }
  });

  assert.equal(result.status, "critical");
  assert.ok(result.alerts.some((a) => a.code === "dead_letter_backlog"));
  assert.ok(result.alerts.some((a) => a.code === "forward_failures_detected"));
});
