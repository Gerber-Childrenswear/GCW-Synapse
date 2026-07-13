import {
  compareObservations,
  type Observation,
  type ObservationDiff
} from "./domain";
import type { SynapseEnv } from "./env";

export type WebhookStatus =
  | "received"
  | "duplicate_ignored"
  | "invalid_signature"
  | "invalid_json"
  | "rejected_shop"
  | "rejected_topic"
  | "shadow_captured"
  | "forwarded"
  | "forward_failed";

export type WebhookReceiptInput = {
  id: string;
  idempotencyKey: string;
  shop: string;
  topic: string;
  webhookId: string | null;
  path: string;
  status: WebhookStatus;
  orderRef: string | null;
  eventId: string | null;
  transactionId: string | null;
  payloadJson: string;
  normalizedPayloadJson: string | null;
  errorMessage: string | null;
  receivedAt: string;
  processedAt: string | null;
};

export type ParityCounts = {
  synapse_events: number;
  elevar_events: number;
  paired_events: number;
  matched_pairs: number;
  mismatched_pairs: number;
  synapse_only: number;
  elevar_only: number;
};

export type ComparisonRecord = {
  key: string;
  type: "matched" | "mismatched" | "synapse_only" | "elevar_only";
  score: number;
  comparedAt: string;
  diffs: ObservationDiff[];
  synapse: Observation | null;
  elevar: Observation | null;
};

type ObservationRow = {
  id: string;
  source: "synapse" | "elevar";
  compare_key: string;
  event_name: string;
  transaction_id: string;
  value_cents: number | null;
  currency: string | null;
  item_count: number;
  items_fingerprint: string;
  event_id: string | null;
  observed_at: string;
  payload_json: string;
};

type CountRow = {
  total: number;
};

type WebhookMetricRow = {
  status: string;
  total: number;
};

type ChannelRow = {
  channel: string;
  surface: string;
  destination: string;
  pixel_id: string | null;
  total: number;
  failed: number;
  last_seen: string;
  last_error: string | null;
};

function rowToObservation(row: ObservationRow): Observation {
  return {
    id: row.id,
    source: row.source,
    compareKey: row.compare_key,
    eventName: row.event_name,
    transactionId: row.transaction_id,
    valueCents: row.value_cents,
    currency: row.currency,
    itemCount: row.item_count,
    itemsFingerprint: row.items_fingerprint,
    eventId: row.event_id,
    observedAt: row.observed_at,
    payloadJson: row.payload_json
  };
}

function emptyCounts(): ParityCounts {
  return {
    synapse_events: 0,
    elevar_events: 0,
    paired_events: 0,
    matched_pairs: 0,
    mismatched_pairs: 0,
    synapse_only: 0,
    elevar_only: 0
  };
}

export class SynapseStore {
  constructor(private readonly db: D1Database) {}

  async ping(): Promise<boolean> {
    try {
      const row = await this.db
        .prepare("SELECT 1 AS total")
        .first<CountRow>();
      return row?.total === 1;
    } catch {
      return false;
    }
  }

  async claimKey(
    key: string,
    scope: "webhook" | "runtime",
    ttlMs: number,
    nowMs = Date.now()
  ): Promise<boolean> {
    await this.db
      .prepare("DELETE FROM idempotency_keys WHERE key = ?1 AND expires_at_ms <= ?2")
      .bind(key, nowMs)
      .run();
    const result = await this.db
      .prepare(
        "INSERT OR IGNORE INTO idempotency_keys (key, scope, expires_at_ms, created_at) VALUES (?1, ?2, ?3, ?4)"
      )
      .bind(key, scope, nowMs + ttlMs, new Date(nowMs).toISOString())
      .run();
    return (result.meta.changes ?? 0) > 0;
  }

  async pruneExpired(nowMs = Date.now()): Promise<void> {
    await this.db
      .prepare("DELETE FROM idempotency_keys WHERE expires_at_ms <= ?1")
      .bind(nowMs)
      .run();
  }

  async recordWebhook(input: WebhookReceiptInput): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO webhook_receipts (
          id, idempotency_key, shop, topic, webhook_id, path, status,
          order_ref, event_id, transaction_id, payload_json,
          normalized_payload_json, error_message, received_at, processed_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`
      )
      .bind(
        input.id,
        input.idempotencyKey,
        input.shop,
        input.topic,
        input.webhookId,
        input.path,
        input.status,
        input.orderRef,
        input.eventId,
        input.transactionId,
        input.payloadJson,
        input.normalizedPayloadJson,
        input.errorMessage,
        input.receivedAt,
        input.processedAt
      )
      .run();
  }

  async updateWebhook(
    id: string,
    status: WebhookStatus,
    fields: {
      eventId?: string | null;
      transactionId?: string | null;
      normalizedPayloadJson?: string | null;
      errorMessage?: string | null;
    } = {}
  ): Promise<void> {
    await this.db
      .prepare(
        `UPDATE webhook_receipts
         SET status = ?2,
             event_id = COALESCE(?3, event_id),
             transaction_id = COALESCE(?4, transaction_id),
             normalized_payload_json = COALESCE(?5, normalized_payload_json),
             error_message = ?6,
             processed_at = ?7
         WHERE id = ?1`
      )
      .bind(
        id,
        status,
        fields.eventId ?? null,
        fields.transactionId ?? null,
        fields.normalizedPayloadJson ?? null,
        fields.errorMessage ?? null,
        new Date().toISOString()
      )
      .run();
  }

  async listWebhooks(limit: number): Promise<Record<string, unknown>[]> {
    const result = await this.db
      .prepare(
        `SELECT id, shop, topic, webhook_id, path, status, order_ref,
                event_id, transaction_id, error_message, received_at, processed_at
         FROM webhook_receipts ORDER BY received_at DESC LIMIT ?1`
      )
      .bind(limit)
      .all<Record<string, unknown>>();
    return result.results;
  }

  async webhookMetrics(): Promise<{
    webhooks_received: number;
    webhooks_invalid_signature: number;
    webhooks_invalid_json: number;
    webhooks_rejected_topic: number;
    webhooks_forward_failed: number;
    webhooks_forwarded: number;
    webhooks_shadow_captured: number;
  }> {
    const result = await this.db
      .prepare("SELECT status, COUNT(*) AS total FROM webhook_receipts GROUP BY status")
      .all<WebhookMetricRow>();
    const counts = new Map(result.results.map((row) => [row.status, row.total]));
    const sum = (...statuses: string[]) =>
      statuses.reduce((total, status) => total + (counts.get(status) ?? 0), 0);
    return {
      webhooks_received: sum(
        "received",
        "duplicate_ignored",
        "invalid_signature",
        "invalid_json",
        "rejected_shop",
        "rejected_topic",
        "shadow_captured",
        "forwarded",
        "forward_failed"
      ),
      webhooks_invalid_signature: sum("invalid_signature"),
      webhooks_invalid_json: sum("invalid_json"),
      webhooks_rejected_topic: sum("rejected_shop", "rejected_topic"),
      webhooks_forward_failed: sum("forward_failed"),
      webhooks_forwarded: sum("forwarded"),
      webhooks_shadow_captured: sum("shadow_captured")
    };
  }

  async requiredTopicHealth(
    shop: string,
    staleMinutes: number
  ): Promise<Array<{ topic: string; last_seen: string | null; fresh: boolean }>> {
    const required = ["orders/create", "orders/paid", "refunds/create"];
    const result = await this.db
      .prepare(
        `SELECT topic, MAX(received_at) AS last_seen
         FROM webhook_receipts
         WHERE shop = ?1 AND status IN ('shadow_captured', 'forwarded')
         GROUP BY topic`
      )
      .bind(shop)
      .all<{ topic: string; last_seen: string }>();
    const byTopic = new Map(result.results.map((row) => [row.topic, row.last_seen]));
    const cutoff = Date.now() - staleMinutes * 60_000;
    return required.map((topic) => {
      const lastSeen = byTopic.get(topic) ?? null;
      return {
        topic,
        last_seen: lastSeen,
        fresh: Boolean(lastSeen && Date.parse(lastSeen) >= cutoff)
      };
    });
  }

  async installedShops(): Promise<string[]> {
    const result = await this.db
      .prepare(
        `SELECT DISTINCT shop FROM webhook_receipts
         WHERE status IN ('shadow_captured', 'forwarded') ORDER BY shop`
      )
      .all<{ shop: string }>();
    return result.results.map((row) => row.shop);
  }

  async upsertObservation(observation: Observation): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO observations (
          id, source, compare_key, event_name, transaction_id, value_cents,
          currency, item_count, items_fingerprint, event_id, observed_at, payload_json
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
        ON CONFLICT(source, compare_key) DO UPDATE SET
          id = excluded.id,
          value_cents = excluded.value_cents,
          currency = excluded.currency,
          item_count = excluded.item_count,
          items_fingerprint = excluded.items_fingerprint,
          event_id = excluded.event_id,
          observed_at = excluded.observed_at,
          payload_json = excluded.payload_json`
      )
      .bind(
        observation.id,
        observation.source,
        observation.compareKey,
        observation.eventName,
        observation.transactionId,
        observation.valueCents,
        observation.currency,
        observation.itemCount,
        observation.itemsFingerprint,
        observation.eventId,
        observation.observedAt,
        observation.payloadJson
      )
      .run();
  }

  private async observations(): Promise<Observation[]> {
    const result = await this.db
      .prepare(
        `SELECT id, source, compare_key, event_name, transaction_id, value_cents,
                currency, item_count, items_fingerprint, event_id, observed_at, payload_json
         FROM observations ORDER BY observed_at DESC LIMIT 5000`
      )
      .all<ObservationRow>();
    return result.results.map(rowToObservation);
  }

  async comparisons(limit = 100): Promise<ComparisonRecord[]> {
    const observations = await this.observations();
    const byKey = new Map<
      string,
      { synapse: Observation | null; elevar: Observation | null }
    >();
    for (const observation of observations) {
      const pair = byKey.get(observation.compareKey) ?? {
        synapse: null,
        elevar: null
      };
      pair[observation.source] = observation;
      byKey.set(observation.compareKey, pair);
    }

    return Array.from(byKey.entries())
      .map(([key, pair]): ComparisonRecord => {
        const diffs =
          pair.synapse && pair.elevar
            ? compareObservations(pair.synapse, pair.elevar)
            : [];
        const type = pair.synapse
          ? pair.elevar
            ? diffs.length === 0
              ? "matched"
              : "mismatched"
            : "synapse_only"
          : "elevar_only";
        const score =
          pair.synapse && pair.elevar
            ? Math.max(0, Math.round((1 - diffs.length / 5) * 100))
            : 0;
        return {
          key,
          type,
          score,
          comparedAt:
            pair.synapse?.observedAt ?? pair.elevar?.observedAt ?? "",
          diffs,
          synapse: pair.synapse,
          elevar: pair.elevar
        };
      })
      .sort((left, right) => right.comparedAt.localeCompare(left.comparedAt))
      .slice(0, limit);
  }

  async paritySummary(): Promise<{
    counts: ParityCounts;
    mismatches_preview: Array<{ key: string; diffs: ObservationDiff[] }>;
  }> {
    const observations = await this.observations();
    const counts = emptyCounts();
    counts.synapse_events = observations.filter(
      (item) => item.source === "synapse"
    ).length;
    counts.elevar_events = observations.filter(
      (item) => item.source === "elevar"
    ).length;
    const comparisons = await this.comparisons(5000);
    for (const comparison of comparisons) {
      if (comparison.type === "matched") {
        counts.paired_events += 1;
        counts.matched_pairs += 1;
      } else if (comparison.type === "mismatched") {
        counts.paired_events += 1;
        counts.mismatched_pairs += 1;
      } else if (comparison.type === "synapse_only") {
        counts.synapse_only += 1;
      } else {
        counts.elevar_only += 1;
      }
    }
    return {
      counts,
      mismatches_preview: comparisons
        .filter((item) => item.type === "mismatched")
        .slice(0, 25)
        .map((item) => ({ key: item.key, diffs: item.diffs }))
    };
  }

  async recordChannel(input: {
    channel: string;
    surface: string;
    destination: string;
    pixelId: string | null;
    eventName: string;
    transactionId: string | null;
    status: "ok" | "error";
    errorMessage: string | null;
    observedAt: string;
  }): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO channel_events (
          id, channel, surface, destination, pixel_id, event_name,
          transaction_id, status, error_message, observed_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
      )
      .bind(
        crypto.randomUUID(),
        input.channel,
        input.surface,
        input.destination,
        input.pixelId,
        input.eventName,
        input.transactionId,
        input.status,
        input.errorMessage,
        input.observedAt
      )
      .run();
  }

  async channelSummary(staleMinutes: number, warnFailurePct: number) {
    const result = await this.db
      .prepare(
        `SELECT channel, surface, destination, pixel_id,
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS failed,
                MAX(observed_at) AS last_seen,
                MAX(CASE WHEN status = 'error' THEN error_message END) AS last_error
         FROM channel_events
         GROUP BY channel, surface, destination, pixel_id`
      )
      .all<ChannelRow>();
    const now = Date.now();
    const channels = result.results.map((row) => {
      const failureRate = row.total > 0 ? (row.failed / row.total) * 100 : 0;
      const minutesSince = Math.max(
        0,
        Math.floor((now - Date.parse(row.last_seen)) / 60_000)
      );
      const status =
        minutesSince > staleMinutes * 2 || failureRate >= 25
          ? "critical"
          : minutesSince > staleMinutes || failureRate > warnFailurePct
            ? "warning"
            : "healthy";
      return {
        key: [row.channel, row.surface, row.destination, row.pixel_id ?? "shared"].join("|"),
        channel: row.channel,
        surface: row.surface,
        destination: row.destination,
        pixel_id: row.pixel_id,
        status,
        failure_rate_pct: Number(failureRate.toFixed(2)),
        minutes_since_last_event: minutesSince,
        total_events: row.total,
        error_events: row.failed,
        last_event_at: row.last_seen,
        last_error_message: row.last_error,
        event_counts: {}
      };
    });
    return {
      totals: {
        tracked_integrations: channels.length,
        healthy: channels.filter((item) => item.status === "healthy").length,
        warning: channels.filter((item) => item.status === "warning").length,
        critical: channels.filter((item) => item.status === "critical").length
      },
      channels
    };
  }

  async recordRuntime(input: {
    eventName: string;
    eventId: string | null;
    source: string;
    status: "forwarded" | "suppressed" | "duplicate" | "accepted";
    reason: string | null;
    payloadJson: string | null;
  }): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO runtime_telemetry (
          id, recorded_at, event_name, event_id, source, status, reason, payload_json
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
      )
      .bind(
        crypto.randomUUID(),
        new Date().toISOString(),
        input.eventName,
        input.eventId,
        input.source,
        input.status,
        input.reason,
        input.payloadJson
      )
      .run();
  }

  async runtimeSummary() {
    const result = await this.db
      .prepare("SELECT status, COUNT(*) AS total FROM runtime_telemetry GROUP BY status")
      .all<{ status: string; total: number }>();
    const counts = new Map(result.results.map((row) => [row.status, row.total]));
    return {
      received: result.results.reduce((sum, row) => sum + row.total, 0),
      forwarded: counts.get("forwarded") ?? 0,
      suppressed: counts.get("suppressed") ?? 0,
      duplicate: counts.get("duplicate") ?? 0,
      accepted: counts.get("accepted") ?? 0
    };
  }

  async listRuntime(limit: number): Promise<Record<string, unknown>[]> {
    const result = await this.db
      .prepare(
        `SELECT id, recorded_at, event_name, event_id, source, status, reason
         FROM runtime_telemetry ORDER BY recorded_at DESC LIMIT ?1`
      )
      .bind(limit)
      .all<Record<string, unknown>>();
    return result.results;
  }

  async addDeadLetter(input: {
    attempt: number;
    httpStatus: number | null;
    errorMessage: string;
    eventName: string;
    eventId: string | null;
    transactionId: string;
    payloadJson: string;
  }): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO dead_letters (
          id, recorded_at, attempt, http_status, error_message,
          event_name, event_id, transaction_id, payload_json
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
      )
      .bind(
        crypto.randomUUID(),
        new Date().toISOString(),
        input.attempt,
        input.httpStatus,
        input.errorMessage,
        input.eventName,
        input.eventId,
        input.transactionId,
        input.payloadJson
      )
      .run();
  }

  async deadLetterSummary() {
    const total = await this.db
      .prepare("SELECT COUNT(*) AS total FROM dead_letters")
      .first<CountRow>();
    const pending = await this.db
      .prepare(
        "SELECT COUNT(*) AS total FROM dead_letters WHERE replay_status = 'pending'"
      )
      .first<CountRow>();
    return {
      total_records: total?.total ?? 0,
      pending_records: pending?.total ?? 0,
      source: "d1"
    };
  }
}

export function createStore(env: SynapseEnv): SynapseStore {
  return new SynapseStore(env.DB);
}
