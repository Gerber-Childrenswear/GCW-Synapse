import type { ChannelHealthSummary } from "./channelHealth";
import type { CompatibilityFailureDiagnostic } from "./compatibilityDiagnostics";
import type { GtmCompatibilityEntry } from "./gtmCompatibilityMatrix";
import type { ShadowParityReport, ShadowCompareSummary } from "./shadowCompare";

type GateCheckStatus = "pass" | "fail";

export type GtmGoLiveGateThresholds = {
  minCoveragePct: number;
  maxNonAvailableHelpers: number;
  minPairedEvents: number;
  maxMismatchRatePct: number;
  maxCriticalChannels: number;
  maxWarningChannels: number;
  maxCompatibilityFailureRatePct: number;
  maxCompatibilityErrorHits: number;
};

export type GtmGoLiveGateCheck = {
  id: string;
  title: string;
  status: GateCheckStatus;
  value: string;
  target: string;
  recommendation: string;
};

export type GtmGoLiveGateReport = {
  status: "go" | "hold";
  readinessScorePct: number;
  summary: {
    checksPassed: number;
    checksFailed: number;
  };
  checks: GtmGoLiveGateCheck[];
  compatibility: {
    totalHelpers: number;
    availableHelpers: number;
    nonAvailableHelpers: number;
    coveragePct: number;
    topFailingHelpers: CompatibilityFailureDiagnostic[];
  };
  parity: {
    mismatchRatePct: number;
    pairedEvents: number;
    synapseOnly: number;
    elevarOnly: number;
  };
  channels: {
    critical: number;
    warning: number;
  };
};

function toPct(value: number): number {
  return Number.parseFloat(value.toFixed(2));
}

function toPctText(value: number): string {
  return `${toPct(value)}%`;
}

function boundedNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

export function normalizeGtmGoLiveThresholds(input?: Partial<GtmGoLiveGateThresholds>): GtmGoLiveGateThresholds {
  return {
    minCoveragePct: boundedNumber(input?.minCoveragePct ?? 95, 0, 100),
    maxNonAvailableHelpers: boundedNumber(input?.maxNonAvailableHelpers ?? 0, 0, 999),
    minPairedEvents: boundedNumber(input?.minPairedEvents ?? 200, 0, 1000000),
    maxMismatchRatePct: boundedNumber(input?.maxMismatchRatePct ?? 5, 0, 100),
    maxCriticalChannels: boundedNumber(input?.maxCriticalChannels ?? 0, 0, 999),
    maxWarningChannels: boundedNumber(input?.maxWarningChannels ?? 0, 0, 999),
    maxCompatibilityFailureRatePct: boundedNumber(input?.maxCompatibilityFailureRatePct ?? 5, 0, 100),
    maxCompatibilityErrorHits: boundedNumber(input?.maxCompatibilityErrorHits ?? 5, 0, 1000000)
  };
}

export function buildGtmGoLiveGateReport(input: {
  thresholds: GtmGoLiveGateThresholds;
  matrix: GtmCompatibilityEntry[];
  compatibilityFailures: CompatibilityFailureDiagnostic[];
  parity: ShadowParityReport;
  paritySummary: ShadowCompareSummary;
  channels: ChannelHealthSummary;
}): GtmGoLiveGateReport {
  const checks: GtmGoLiveGateCheck[] = [];

  const totalHelpers = input.matrix.length;
  const availableHelpers = input.matrix.filter((entry) => entry.status === "available").length;
  const nonAvailableHelpers = totalHelpers - availableHelpers;
  const coveragePct = totalHelpers > 0 ? (availableHelpers / totalHelpers) * 100 : 0;

  const topFailure = input.compatibilityFailures[0];
  const topFailureRate = topFailure?.failureRatePct ?? 0;
  const topFailureHits = topFailure?.errorHits ?? 0;

  const coveragePass = coveragePct >= input.thresholds.minCoveragePct;
  checks.push({
    id: "compatibility_coverage",
    title: "Compatibility Helper Coverage",
    status: coveragePass ? "pass" : "fail",
    value: toPctText(coveragePct),
    target: `>= ${toPct(input.thresholds.minCoveragePct)}%`,
    recommendation: "Raise matrix helper coverage to eliminate unresolved Elevar placeholders before cutover."
  });

  const helperGapPass = nonAvailableHelpers <= input.thresholds.maxNonAvailableHelpers;
  checks.push({
    id: "compatibility_gap_count",
    title: "Non-Available Compatibility Helpers",
    status: helperGapPass ? "pass" : "fail",
    value: nonAvailableHelpers.toString(),
    target: `<= ${input.thresholds.maxNonAvailableHelpers}`,
    recommendation: "Convert remaining partial/missing compatibility helpers into explicit resolver endpoints."
  });

  const pairedEvents = input.paritySummary.counts.paired_events;
  const pairedPass = pairedEvents >= input.thresholds.minPairedEvents;
  checks.push({
    id: "paired_events",
    title: "Shadow Paired Event Volume",
    status: pairedPass ? "pass" : "fail",
    value: pairedEvents.toString(),
    target: `>= ${input.thresholds.minPairedEvents}`,
    recommendation: "Collect more side-by-side volume before trusting parity for cutover."
  });

  const mismatchPass = input.parity.mismatch_rate_pct <= input.thresholds.maxMismatchRatePct;
  checks.push({
    id: "parity_mismatch_rate",
    title: "Shadow Parity Mismatch Rate",
    status: mismatchPass ? "pass" : "fail",
    value: toPctText(input.parity.mismatch_rate_pct),
    target: `<= ${toPct(input.thresholds.maxMismatchRatePct)}%`,
    recommendation: "Resolve mismatches from /compare/parity before elevating Synapse to source of truth."
  });

  const criticalPass = input.channels.totals.critical <= input.thresholds.maxCriticalChannels;
  checks.push({
    id: "channel_critical",
    title: "Critical Channel Integrations",
    status: criticalPass ? "pass" : "fail",
    value: input.channels.totals.critical.toString(),
    target: `<= ${input.thresholds.maxCriticalChannels}`,
    recommendation: "Clear critical channel failures before replacing Elevar in production."
  });

  const warningPass = input.channels.totals.warning <= input.thresholds.maxWarningChannels;
  checks.push({
    id: "channel_warning",
    title: "Warning Channel Integrations",
    status: warningPass ? "pass" : "fail",
    value: input.channels.totals.warning.toString(),
    target: `<= ${input.thresholds.maxWarningChannels}`,
    recommendation: "Reduce warning channel count or explicitly accept rollout risk."
  });

  const compatibilityFailureRatePass = topFailureRate <= input.thresholds.maxCompatibilityFailureRatePct;
  checks.push({
    id: "compatibility_failure_rate",
    title: "Top Compatibility Failure Rate",
    status: compatibilityFailureRatePass ? "pass" : "fail",
    value: toPctText(topFailureRate),
    target: `<= ${toPct(input.thresholds.maxCompatibilityFailureRatePct)}%`,
    recommendation: "Stabilize resolver inputs/outputs for high-failure compatibility helpers."
  });

  const compatibilityErrorHitsPass = topFailureHits <= input.thresholds.maxCompatibilityErrorHits;
  checks.push({
    id: "compatibility_error_hits",
    title: "Top Compatibility Error Hits",
    status: compatibilityErrorHitsPass ? "pass" : "fail",
    value: topFailureHits.toString(),
    target: `<= ${input.thresholds.maxCompatibilityErrorHits}`,
    recommendation: "Lower compatibility endpoint error volume before final cutover."
  });

  const checksPassed = checks.filter((check) => check.status === "pass").length;
  const checksFailed = checks.length - checksPassed;
  const readinessScorePct = checks.length > 0 ? toPct((checksPassed / checks.length) * 100) : 0;

  return {
    status: checksFailed === 0 ? "go" : "hold",
    readinessScorePct,
    summary: {
      checksPassed,
      checksFailed
    },
    checks,
    compatibility: {
      totalHelpers,
      availableHelpers,
      nonAvailableHelpers,
      coveragePct: toPct(coveragePct),
      topFailingHelpers: input.compatibilityFailures.slice(0, 5)
    },
    parity: {
      mismatchRatePct: toPct(input.parity.mismatch_rate_pct),
      pairedEvents,
      synapseOnly: input.paritySummary.counts.synapse_only,
      elevarOnly: input.paritySummary.counts.elevar_only
    },
    channels: {
      critical: input.channels.totals.critical,
      warning: input.channels.totals.warning
    }
  };
}
