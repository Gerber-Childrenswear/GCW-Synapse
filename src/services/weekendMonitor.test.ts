import test from "node:test";
import assert from "node:assert/strict";
import { buildWeekendMonitorSummary } from "./weekendMonitor";

test("weekend monitor summary prioritizes placeholder-heavy purchase replication and parity alerts", () => {
  const summary = buildWeekendMonitorSummary({
    parity: {
      threshold_pct: 5,
      mismatch_rate_pct: 12,
      matched_rate_pct: 88,
      paired_events: 120,
      alert_triggered: true,
      status: "alert"
    },
    paritySummary: {
      mode: "shadow_compare",
      counts: {
        synapse_events: 125,
        elevar_events: 130,
        paired_events: 120,
        matched_pairs: 106,
        mismatched_pairs: 14,
        synapse_only: 5,
        elevar_only: 10
      },
      mismatches_preview: []
    },
    hyper: {
      adapter: "hyper",
      status: "in_progress",
      validation: {
        warnings: 3,
        errors: 1
      },
      recommendations: ["Verify mapped events."],
      topGaps: ["purchase", "begin_checkout"]
    },
    placeholderMatrix: {
      sourceBundlePath: "bundle.json",
      tagsScanned: 10,
      triggersScanned: 5,
      eventGroups: 2,
      families: [
        {
          eventName: "purchase",
          tagCount: 8,
          placeholderCount: 61,
          tags: ["Facebook - Purchase"],
          placeholders: ["dlv - Thank You Page - Order ID"]
        },
        {
          eventName: "add_to_cart",
          tagCount: 7,
          placeholderCount: 40,
          tags: ["GA4 - Add to Cart"],
          placeholders: ["dlv - Add to Cart - Product ID"]
        }
      ]
    },
    compatibilityFailures: [
      {
        priority: "P2",
        legacyVariable: "dlv - Add to Cart - Add Array",
        endpointPath: "/compatibility/add-to-cart",
        status: "partial",
        externalRefs: 6,
        okHits: 15,
        errorHits: 3,
        totalHits: 18,
        failureRatePct: 16.67,
        eventFamilies: ["add_to_cart"],
        reason: "Endpoint exists but translation parity is still partial for some vendor tag placeholders."
      }
    ],
    channels: {
      totals: {
        tracked_integrations: 3,
        healthy: 2,
        warning: 1,
        critical: 0
      },
      channels: []
    },
    topChannelIssues: [
      {
        key: "facebook|runtime|collect|shared",
        severity: "warning",
        title: "Facebook runtime integration needs attention",
        details: "Failure rate 5%.",
        recommendations: ["Check payloads"],
        links: []
      }
    ],
    ops: {
      status: "warning",
      alerts: []
    }
  });

  assert.equal(summary.status, "critical");
  assert.equal(summary.placeholders.heaviestEventFamilies[0]?.eventName, "purchase");
  assert.equal(summary.nextActions.some((item) => item.includes("purchase (61 placeholders")), true);
  assert.equal(summary.compatibility.topFailingHelpers.length, 1);
  assert.equal(summary.nextActions.some((item) => item.includes("/compatibility/add-to-cart")), true);
});