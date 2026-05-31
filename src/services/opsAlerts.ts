import type { DeadLetterSummary } from "./deadLetter";

export type OpsAlert = {
  severity: "warning" | "critical";
  code: string;
  message: string;
  recommendation: string;
};

type Counters = {
  webhooks_received: number;
  webhooks_forwarded: number;
  webhooks_forward_failed: number;
  webhooks_invalid_signature: number;
  refunds_received: number;
  refunds_forwarded: number;
  refunds_forward_failed: number;
  refunds_invalid_signature: number;
  ingress_token_rejected: number;
  runtime_events_received: number;
  runtime_events_rejected_invalid_payload: number;
  runtime_events_forwarded: number;
  runtime_events_suppressed: number;
  gtm_dead_letter_written: number;
};

export function buildOpsAlerts(input: {
  counters: Counters;
  runtimeTelemetry: {
    total: number;
    forwarded: number;
    suppressed: number;
  };
  deadLetter: DeadLetterSummary;
}): { status: "ok" | "warning" | "critical"; alerts: OpsAlert[] } {
  const alerts: OpsAlert[] = [];
  const { counters, runtimeTelemetry, deadLetter } = input;

  if (counters.webhooks_forward_failed > 0 || counters.refunds_forward_failed > 0) {
    alerts.push({
      severity: "critical",
      code: "forward_failures_detected",
      message: `Forward failures detected (orders=${counters.webhooks_forward_failed}, refunds=${counters.refunds_forward_failed}).`,
      recommendation: "Check GTM endpoint health and run dead-letter replay after recovery."
    });
  }

  if (deadLetter.total_records > 0) {
    alerts.push({
      severity: "critical",
      code: "dead_letter_backlog",
      message: `Dead-letter backlog present (${deadLetter.total_records} records).`,
      recommendation: "Run npm run replay:dead-letter:dry, then npm run replay:dead-letter -- --limit 50."
    });
  }

  if (counters.webhooks_invalid_signature > 0 || counters.refunds_invalid_signature > 0) {
    alerts.push({
      severity: "warning",
      code: "invalid_webhook_signatures",
      message: `Invalid webhook signatures observed (orders=${counters.webhooks_invalid_signature}, refunds=${counters.refunds_invalid_signature}).`,
      recommendation: "Verify Shopify webhook secret and endpoint routing configuration."
    });
  }

  if (counters.runtime_events_rejected_invalid_payload > 0) {
    alerts.push({
      severity: "warning",
      code: "runtime_invalid_payloads",
      message: `${counters.runtime_events_rejected_invalid_payload} runtime payloads were rejected as invalid.`,
      recommendation: "Inspect theme/pixel payload shape and keep event schema aligned with Synapse runtime contract."
    });
  }

  if (counters.ingress_token_rejected >= 10) {
    alerts.push({
      severity: "warning",
      code: "high_unauthorized_traffic",
      message: `${counters.ingress_token_rejected} ingress requests were rejected by token guard.`,
      recommendation: "Rotate token if abuse is suspected and verify all internal callers use the current token."
    });
  }

  const runtimeTotal = runtimeTelemetry.total || counters.runtime_events_received;
  const suppressed = runtimeTelemetry.suppressed || counters.runtime_events_suppressed;
  if (runtimeTotal >= 20) {
    const suppressedRate = (suppressed / runtimeTotal) * 100;
    if (suppressedRate >= 50) {
      alerts.push({
        severity: "warning",
        code: "high_runtime_suppression_rate",
        message: `Runtime suppression rate is high (${suppressedRate.toFixed(1)}%).`,
        recommendation: "Review consent implementation and bot classification to avoid over-suppressing valid traffic."
      });
    }
  }

  const hasCritical = alerts.some((alert) => alert.severity === "critical");
  if (hasCritical) {
    return { status: "critical", alerts };
  }

  if (alerts.length > 0) {
    return { status: "warning", alerts };
  }

  return { status: "ok", alerts };
}
