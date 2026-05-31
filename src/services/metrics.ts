type CounterKey =
  | "webhooks_received"
  | "webhooks_forwarded"
  | "webhooks_duplicate_ignored"
  | "webhooks_invalid_signature"
  | "webhooks_invalid_json"
  | "webhooks_rejected_topic"
  | "webhooks_forward_failed"
  | "webhooks_shadow_captured"
  | "refunds_received"
  | "refunds_forwarded"
  | "refunds_duplicate_ignored"
  | "refunds_invalid_signature"
  | "refunds_invalid_json"
  | "refunds_rejected_topic"
  | "refunds_forward_failed"
  | "refunds_shadow_captured"
  | "compare_elevar_received"
  | "compare_channel_events_received"
  | "ingress_token_rejected"
  | "runtime_events_received"
  | "runtime_events_rejected_invalid_payload"
  | "runtime_events_forwarded"
  | "runtime_events_suppressed"
  | "runtime_events_duplicate"
  | "public_event_origin_rejected"
  | "public_event_rate_limited"
  | "gtm_dead_letter_written";

type MetricsState = Record<CounterKey, number>;

const startedAt = new Date();

const counters: MetricsState = {
  webhooks_received: 0,
  webhooks_forwarded: 0,
  webhooks_duplicate_ignored: 0,
  webhooks_invalid_signature: 0,
  webhooks_invalid_json: 0,
  webhooks_rejected_topic: 0,
  webhooks_forward_failed: 0,
  webhooks_shadow_captured: 0,
  refunds_received: 0,
  refunds_forwarded: 0,
  refunds_duplicate_ignored: 0,
  refunds_invalid_signature: 0,
  refunds_invalid_json: 0,
  refunds_rejected_topic: 0,
  refunds_forward_failed: 0,
  refunds_shadow_captured: 0,
  compare_elevar_received: 0,
  compare_channel_events_received: 0,
  ingress_token_rejected: 0,
  runtime_events_received: 0,
  runtime_events_rejected_invalid_payload: 0,
  runtime_events_forwarded: 0,
  runtime_events_suppressed: 0,
  runtime_events_duplicate: 0,
  public_event_origin_rejected: 0,
  public_event_rate_limited: 0,
  gtm_dead_letter_written: 0
};

export function incrementCounter(key: CounterKey): void {
  counters[key] += 1;
}

export function getMetricsSnapshot(): { started_at: string; counters: MetricsState } {
  return {
    started_at: startedAt.toISOString(),
    counters: { ...counters }
  };
}
