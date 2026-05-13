type CounterKey =
  | "webhooks_received"
  | "webhooks_forwarded"
  | "webhooks_duplicate_ignored"
  | "webhooks_invalid_signature"
  | "webhooks_invalid_json"
  | "webhooks_rejected_topic"
  | "webhooks_forward_failed"
  | "ingress_token_rejected";

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
  ingress_token_rejected: 0
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
