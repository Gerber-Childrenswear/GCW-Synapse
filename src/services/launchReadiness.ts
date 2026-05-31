import type { ChannelHealthSummary } from "./channelHealth";
import type { ShadowParityReport, ShadowCompareSummary } from "./shadowCompare";

type CheckStatus = "pass" | "fail";

export type LaunchCheck = {
  id: string;
  title: string;
  status: CheckStatus;
  value: string;
  target: string;
  recommendation: string;
};

export type LaunchPhase = "validation" | "cutover";

export type LaunchReadinessInput = {
  phase: LaunchPhase;
  runtimeMode: string;
  parity: ShadowParityReport;
  paritySummary: ShadowCompareSummary;
  channelSummary: ChannelHealthSummary;
  metrics: {
    webhooks_received: number;
    webhooks_invalid_signature: number;
    webhooks_invalid_json: number;
    webhooks_rejected_topic: number;
    webhooks_forward_failed: number;
  };
  thresholds: {
    minPairedEvents: number;
    maxWarningChannels: number;
    maxWebhookFailureRatePct: number;
  };
};

export type LaunchReadinessReport = {
  phase: LaunchPhase;
  status: "go" | "hold";
  summary: {
    checks_passed: number;
    checks_failed: number;
  };
  checks: LaunchCheck[];
};

function pct(value: number): string {
  return `${value.toFixed(2)}%`;
}

function webhookFailureRate(metrics: LaunchReadinessInput["metrics"]): number {
  const received = metrics.webhooks_received;
  if (received <= 0) {
    return 0;
  }

  const failed =
    metrics.webhooks_invalid_signature +
    metrics.webhooks_invalid_json +
    metrics.webhooks_rejected_topic +
    metrics.webhooks_forward_failed;

  return (failed / received) * 100;
}

function expectedRuntimeMode(phase: LaunchPhase): string {
  return phase === "validation" ? "shadow_compare" : "forward";
}

export function buildLaunchReadinessReport(input: LaunchReadinessInput): LaunchReadinessReport {
  const checks: LaunchCheck[] = [];

  const runtimeExpected = expectedRuntimeMode(input.phase);
  const runtimePass = input.runtimeMode === runtimeExpected;
  checks.push({
    id: "runtime_mode",
    title: "Runtime Mode",
    status: runtimePass ? "pass" : "fail",
    value: input.runtimeMode,
    target: runtimeExpected,
    recommendation:
      input.phase === "validation"
        ? "Keep shadow_compare mode during side-by-side validation."
        : "Switch to forward mode only after readiness checks are green."
  });

  const paired = input.paritySummary.counts.paired_events;
  const pairedPass = paired >= input.thresholds.minPairedEvents;
  checks.push({
    id: "paired_events",
    title: "Paired Event Volume",
    status: pairedPass ? "pass" : "fail",
    value: paired.toString(),
    target: `>= ${input.thresholds.minPairedEvents}`,
    recommendation: "Collect more parallel data before making a launch decision if below target."
  });

  const parityPass = !input.parity.alert_triggered;
  checks.push({
    id: "parity_threshold",
    title: "Parity Mismatch Rate",
    status: parityPass ? "pass" : "fail",
    value: pct(input.parity.mismatch_rate_pct),
    target: `<= ${input.parity.threshold_pct}%`,
    recommendation: "Investigate mismatches in /compare/parity and resolve mapping gaps before cutover."
  });

  const criticalChannels = input.channelSummary.totals.critical;
  const criticalPass = criticalChannels === 0;
  checks.push({
    id: "critical_channels",
    title: "Critical Channel Integrations",
    status: criticalPass ? "pass" : "fail",
    value: criticalChannels.toString(),
    target: "0",
    recommendation: "Resolve critical channel issues in /compare/troubleshoot before launch."
  });

  const warningChannels = input.channelSummary.totals.warning;
  const warningPass = warningChannels <= input.thresholds.maxWarningChannels;
  checks.push({
    id: "warning_channels",
    title: "Warning Channel Budget",
    status: warningPass ? "pass" : "fail",
    value: warningChannels.toString(),
    target: `<= ${input.thresholds.maxWarningChannels}`,
    recommendation: "Reduce warning channels or raise accepted budget intentionally for this release."
  });

  const webhookFailurePct = webhookFailureRate(input.metrics);
  const webhookFailurePass = webhookFailurePct <= input.thresholds.maxWebhookFailureRatePct;
  checks.push({
    id: "webhook_failure_rate",
    title: "Webhook Failure Rate",
    status: webhookFailurePass ? "pass" : "fail",
    value: pct(webhookFailurePct),
    target: `<= ${input.thresholds.maxWebhookFailureRatePct}%`,
    recommendation: "Address signature/topic/forward errors before launch to avoid data gaps."
  });

  let checksPassed = 0;
  for (const check of checks) {
    if (check.status === "pass") {
      checksPassed += 1;
    }
  }

  const checksFailed = checks.length - checksPassed;

  return {
    phase: input.phase,
    status: checksFailed === 0 ? "go" : "hold",
    summary: {
      checks_passed: checksPassed,
      checks_failed: checksFailed
    },
    checks
  };
}
