/**
 * Edge launch-gate summary for dual-run (Synapse vs Elevar browser beacons).
 * Distinguishes "waiting for Elevar side" from a true parity hold.
 */

export type BrowserParityLike = {
  paired_events: number;
  synapse_events: number;
  elevar_events: number;
  status: string;
  matched_rate_pct: number;
  volume_match_pct?: number;
  fuzzy_paired?: number;
};

export type PurchaseParityLike = {
  status: string;
  matched_rate_pct: number;
};

export type LaunchCheck = {
  id: string;
  status: "pass" | "hold" | "waiting";
  detail: string;
};

export function buildLaunchReadiness(
  purchaseParity: PurchaseParityLike,
  browserParity: BrowserParityLike
): {
  status: "go" | "hold" | "ready" | "waiting";
  rationale: string[];
  checks: LaunchCheck[];
  purchase_parity: PurchaseParityLike;
  browser_parity: BrowserParityLike;
} {
  const hasSynapse = browserParity.synapse_events > 0;
  const hasElevar = browserParity.elevar_events > 0;
  const bothSides = hasSynapse && hasElevar;
  const hasVolume = browserParity.paired_events > 0 || hasSynapse || hasElevar;
  // Dual-run GO uses volume match (event_ids intentionally differ across vendors).
  const volumePct = browserParity.volume_match_pct ?? browserParity.matched_rate_pct;
  const browserGo = !bothSides || (browserParity.status === "ok" && volumePct >= 80);
  const purchaseGo = purchaseParity.status === "ok";

  const checks: LaunchCheck[] = [
    {
      id: "purchase_shadow_parity",
      status: purchaseGo ? "pass" : "hold",
      detail: `matched ${purchaseParity.matched_rate_pct}%`
    },
    {
      id: "browser_parity_threshold",
      status: !bothSides ? "waiting" : browserGo ? "pass" : "hold",
      detail: bothSides
        ? `Synapse covers ${volumePct}% of Elevar core funnel (fuzzy=${browserParity.fuzzy_paired ?? 0}, elevar_events=${browserParity.paired_events})`
        : hasSynapse
          ? "waiting for Elevar dual-run beacons (Synapse-only so far)"
          : hasElevar
            ? "waiting for Synapse storefront beacons"
            : "waiting for storefront traffic (no dual-run volume yet)"
    },
    {
      id: "browser_dual_run_volume",
      status: bothSides ? "pass" : "waiting",
      detail: `synapse=${browserParity.synapse_events} elevar=${browserParity.elevar_events}`
    }
  ];

  const hold = checks.some((c) => c.status === "hold");
  const waiting = checks.some((c) => c.status === "waiting");

  let status: "go" | "hold" | "ready" | "waiting";
  if (hold) status = "hold";
  else if (waiting) status = hasVolume ? "waiting" : "ready";
  else status = "go";

  return {
    status,
    rationale: checks.filter((c) => c.status === "hold" || c.status === "waiting").map((c) => c.detail),
    checks,
    purchase_parity: purchaseParity,
    browser_parity: browserParity
  };
}
