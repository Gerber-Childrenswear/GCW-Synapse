import test from "node:test";
import assert from "node:assert/strict";
import { buildGtmGoLiveGateReport, normalizeGtmGoLiveThresholds } from "./gtmGoLiveGate";

const baseThresholds = normalizeGtmGoLiveThresholds();

const baseInput = {
  thresholds: baseThresholds,
  matrix: [
    {
      priority: "P0" as const,
      legacyVariable: "GA4 ID",
      externalRefs: 39,
      suggestedSource: "resolver",
      endpointPath: "/compatibility/ga4-id",
      status: "available" as const,
      eventFamilies: ["purchase"],
      notes: "ok"
    },
    {
      priority: "P1" as const,
      legacyVariable: "dlv - event_id",
      externalRefs: 27,
      suggestedSource: "resolver",
      endpointPath: "/compatibility/event-id",
      status: "available" as const,
      eventFamilies: ["purchase"],
      notes: "ok"
    }
  ],
  compatibilityFailures: [],
  parity: {
    threshold_pct: 5,
    mismatch_rate_pct: 1,
    matched_rate_pct: 99,
    paired_events: 250,
    alert_triggered: false,
    status: "ok" as const
  },
  paritySummary: {
    mode: "shadow_compare",
    counts: {
      synapse_events: 260,
      elevar_events: 255,
      paired_events: 250,
      matched_pairs: 248,
      mismatched_pairs: 2,
      synapse_only: 10,
      elevar_only: 5
    },
    mismatches_preview: []
  },
  channels: {
    totals: {
      tracked_integrations: 3,
      healthy: 3,
      warning: 0,
      critical: 0
    },
    channels: []
  }
};

test("go-live gate returns go when all checks pass", () => {
  const report = buildGtmGoLiveGateReport(baseInput);

  assert.equal(report.status, "go");
  assert.equal(report.compatibility.coveragePct, 100);
  assert.equal(report.summary.checksFailed, 0);
});

test("go-live gate returns hold when compatibility and parity fail thresholds", () => {
  const report = buildGtmGoLiveGateReport({
    ...baseInput,
    matrix: [
      ...baseInput.matrix,
      {
        priority: "P2" as const,
        legacyVariable: "DOM - Page Title",
        externalRefs: 8,
        suggestedSource: "resolver",
        endpointPath: "/compatibility/page-title",
        status: "partial" as const,
        eventFamilies: ["page_view"],
        notes: "gap"
      }
    ],
    compatibilityFailures: [
      {
        priority: "P2",
        legacyVariable: "dlv - Add to Cart - Add Array",
        endpointPath: "/compatibility/add-to-cart",
        status: "available",
        externalRefs: 6,
        okHits: 10,
        errorHits: 6,
        totalHits: 16,
        failureRatePct: 37.5,
        eventFamilies: ["add_to_cart"],
        reason: "errors"
      }
    ],
    parity: {
      ...baseInput.parity,
      mismatch_rate_pct: 12,
      alert_triggered: true,
      status: "alert"
    },
    channels: {
      totals: {
        tracked_integrations: 3,
        healthy: 1,
        warning: 1,
        critical: 1
      },
      channels: []
    }
  });

  assert.equal(report.status, "hold");
  assert.equal(report.summary.checksFailed > 0, true);
  assert.equal(report.compatibility.nonAvailableHelpers > 0, true);
});
