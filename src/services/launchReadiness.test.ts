import test from "node:test";
import assert from "node:assert/strict";
import { buildLaunchReadinessReport } from "./launchReadiness";

const baseInput = {
  phase: "validation" as const,
  runtimeMode: "shadow_compare",
  parity: {
    threshold_pct: 5,
    mismatch_rate_pct: 1,
    matched_rate_pct: 99,
    paired_events: 200,
    alert_triggered: false,
    status: "ok" as const
  },
  paritySummary: {
    mode: "shadow_compare",
    counts: {
      synapse_events: 200,
      elevar_events: 200,
      paired_events: 200,
      matched_pairs: 198,
      mismatched_pairs: 2,
      synapse_only: 0,
      elevar_only: 0
    },
    mismatches_preview: []
  },
  channelSummary: {
    totals: {
      tracked_integrations: 3,
      healthy: 3,
      warning: 0,
      critical: 0
    },
    channels: []
  },
  metrics: {
    webhooks_received: 1000,
    webhooks_invalid_signature: 0,
    webhooks_invalid_json: 0,
    webhooks_rejected_topic: 0,
    webhooks_forward_failed: 5
  },
  thresholds: {
    minPairedEvents: 100,
    maxWarningChannels: 0,
    maxWebhookFailureRatePct: 2
  }
};

test("launch readiness returns go when all checks pass", () => {
  const report = buildLaunchReadinessReport(baseInput);
  assert.equal(report.status, "go");
});

test("launch readiness returns hold when parity is above threshold", () => {
  const report = buildLaunchReadinessReport({
    ...baseInput,
    parity: {
      ...baseInput.parity,
      mismatch_rate_pct: 9,
      alert_triggered: true,
      status: "alert"
    }
  });

  assert.equal(report.status, "hold");
});

test("launch readiness returns hold when webhook failure exceeds budget", () => {
  const report = buildLaunchReadinessReport({
    ...baseInput,
    metrics: {
      ...baseInput.metrics,
      webhooks_forward_failed: 100
    }
  });

  assert.equal(report.status, "hold");
});

test("launch readiness includes browser parity checks when provided", () => {
  const report = buildLaunchReadinessReport({
    ...baseInput,
    browserParity: {
      threshold_pct: 5,
      mismatch_rate_pct: 1,
      matched_rate_pct: 99,
      paired_events: 80,
      synapse_events: 80,
      elevar_events: 80,
      alert_triggered: false,
      status: "ok",
      by_event: []
    },
    thresholds: {
      ...baseInput.thresholds,
      minBrowserPairedEvents: 50
    }
  });

  assert.equal(report.status, "go");
  assert.ok(report.checks.some((c) => c.id === "browser_paired_events" && c.status === "pass"));
  assert.ok(report.checks.some((c) => c.id === "browser_parity_threshold" && c.status === "pass"));
});
