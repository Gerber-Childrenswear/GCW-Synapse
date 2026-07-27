import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildLaunchReadiness } from "./launchReadinessEdge";

describe("buildLaunchReadiness (edge)", () => {
  const purchaseOk = { status: "ok", matched_rate_pct: 100 };

  it("is waiting when only Synapse beacons exist (not a false hold)", () => {
    const report = buildLaunchReadiness(purchaseOk, {
      paired_events: 0,
      synapse_events: 4,
      elevar_events: 0,
      status: "ok",
      matched_rate_pct: 100,
      volume_match_pct: 100
    });
    assert.equal(report.status, "waiting");
    assert.equal(report.checks.find((c) => c.id === "browser_dual_run_volume")?.status, "waiting");
    assert.equal(report.checks.find((c) => c.id === "browser_parity_threshold")?.status, "waiting");
  });

  it("is go when both sides are healthy", () => {
    const report = buildLaunchReadiness(purchaseOk, {
      paired_events: 10,
      synapse_events: 12,
      elevar_events: 11,
      status: "ok",
      matched_rate_pct: 95,
      volume_match_pct: 92,
      fuzzy_paired: 2
    });
    assert.equal(report.status, "go");
  });

  it("is hold when dual-run volume is below threshold", () => {
    const report = buildLaunchReadiness(purchaseOk, {
      paired_events: 10,
      synapse_events: 50,
      elevar_events: 10,
      status: "alert",
      matched_rate_pct: 40,
      volume_match_pct: 40
    });
    assert.equal(report.status, "hold");
  });
});
