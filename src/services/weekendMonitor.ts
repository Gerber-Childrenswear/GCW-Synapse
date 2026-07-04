import type { ChannelHealthSummary, TroubleshootingIssue } from "./channelHealth";
import type { ThemeAdapterReadinessSummary } from "./controlPanelData";
import type { CompatibilityFailureDiagnostic } from "./compatibilityDiagnostics";
import type { OpsAlert } from "./opsAlerts";
import type { PlaceholderMatrixReport } from "./gtmPlaceholderMatrix";
import type { ShadowParityReport, ShadowCompareSummary } from "./shadowCompare";

export type WeekendMonitorSummary = {
  status: "ok" | "warning" | "critical";
  parity: {
    status: ShadowParityReport["status"];
    mismatch_rate_pct: number;
    paired_events: number;
    synapse_only: number;
    elevar_only: number;
  };
  hyper: ThemeAdapterReadinessSummary;
  placeholders: {
    heaviestEventFamilies: Array<{
      eventName: string;
      placeholderCount: number;
      tagCount: number;
    }>;
  };
  compatibility: {
    topFailingHelpers: CompatibilityFailureDiagnostic[];
  };
  channels: {
    warning: number;
    critical: number;
    topIssues: TroubleshootingIssue[];
  };
  ops: {
    status: "ok" | "warning" | "critical";
    alerts: OpsAlert[];
  };
  nextActions: string[];
};

export function buildWeekendMonitorSummary(input: {
  parity: ShadowParityReport;
  paritySummary: ShadowCompareSummary;
  hyper: ThemeAdapterReadinessSummary;
  placeholderMatrix: PlaceholderMatrixReport;
  compatibilityFailures: CompatibilityFailureDiagnostic[];
  channels: ChannelHealthSummary;
  topChannelIssues: TroubleshootingIssue[];
  ops: { status: "ok" | "warning" | "critical"; alerts: OpsAlert[] };
}): WeekendMonitorSummary {
  const heaviestEventFamilies = [...input.placeholderMatrix.families]
    .sort((left, right) => {
      if (right.placeholderCount !== left.placeholderCount) {
        return right.placeholderCount - left.placeholderCount;
      }

      return right.tagCount - left.tagCount;
    })
    .slice(0, 5)
    .map((family) => ({
      eventName: family.eventName,
      placeholderCount: family.placeholderCount,
      tagCount: family.tagCount
    }));

  const nextActions: string[] = [];

  if (input.parity.status === "alert") {
    nextActions.push("Review /compare/parity mismatches before promoting any Synapse-owned tags.");
  }

  if (input.hyper.topGaps.length > 0) {
    nextActions.push(`Close Hyper adapter gaps for: ${input.hyper.topGaps.join(", ")}.`);
  }

  const topPlaceholderFamily = heaviestEventFamilies[0];
  if (topPlaceholderFamily) {
    nextActions.push(
      `Prioritize replicating Elevar placeholder translation for ${topPlaceholderFamily.eventName} (${topPlaceholderFamily.placeholderCount} placeholders across ${topPlaceholderFamily.tagCount} tags).`
    );
  }

  if (input.channels.totals.critical > 0 || input.channels.totals.warning > 0) {
    nextActions.push("Inspect /compare/troubleshoot and destination-specific failures before widening rollout.");
  }

  const topCompatibilityFailure = input.compatibilityFailures[0];
  if (topCompatibilityFailure) {
    nextActions.push(
      `Stabilize ${topCompatibilityFailure.legacyVariable} via ${topCompatibilityFailure.endpointPath} (${topCompatibilityFailure.errorHits} errors, ${topCompatibilityFailure.failureRatePct}% failure rate).`
    );
  }

  if (input.ops.alerts.length > 0) {
    nextActions.push("Work the active ops alerts queue to keep weekend monitoring signal clean.");
  }

  const status =
    input.ops.status === "critical" ||
    input.channels.totals.critical > 0 ||
    input.parity.status === "alert" ||
    (topCompatibilityFailure?.status === "missing") ||
    ((topCompatibilityFailure?.errorHits ?? 0) >= 5)
      ? "critical"
      : input.ops.status === "warning" ||
          input.channels.totals.warning > 0 ||
          input.hyper.status !== "ready" ||
          !!topCompatibilityFailure
        ? "warning"
        : "ok";

  return {
    status,
    parity: {
      status: input.parity.status,
      mismatch_rate_pct: input.parity.mismatch_rate_pct,
      paired_events: input.parity.paired_events,
      synapse_only: input.paritySummary.counts.synapse_only,
      elevar_only: input.paritySummary.counts.elevar_only
    },
    hyper: input.hyper,
    placeholders: {
      heaviestEventFamilies
    },
    compatibility: {
      topFailingHelpers: input.compatibilityFailures.slice(0, 5)
    },
    channels: {
      warning: input.channels.totals.warning,
      critical: input.channels.totals.critical,
      topIssues: input.topChannelIssues.slice(0, 5)
    },
    ops: input.ops,
    nextActions
  };
}