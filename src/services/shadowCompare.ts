import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { SynapseEventPayload } from "../types/shopify";

type EventSource = "synapse" | "elevar";

export type ComparableEvent = {
  source: EventSource;
  key: string;
  event_name: string;
  transaction_id: string;
  value?: number | undefined;
  currency?: string | undefined;
  item_count: number;
  event_id?: string | undefined;
  observed_at: string;
};

type DiffField = "value" | "currency" | "item_count";

type DiffEntry = {
  field: DiffField;
  synapse?: string | number | undefined;
  elevar?: string | number | undefined;
};

export type ShadowCompareSummary = {
  mode: string;
  counts: {
    synapse_events: number;
    elevar_events: number;
    paired_events: number;
    matched_pairs: number;
    mismatched_pairs: number;
    synapse_only: number;
    elevar_only: number;
  };
  mismatches_preview: Array<{
    key: string;
    diffs: DiffEntry[];
  }>;
};

export type ShadowParityReport = {
  threshold_pct: number;
  mismatch_rate_pct: number;
  matched_rate_pct: number;
  paired_events: number;
  alert_triggered: boolean;
  status: "ok" | "alert";
};

const synapseEvents = new Map<string, ComparableEvent>();
const elevarEvents = new Map<string, ComparableEvent>();
const observedOrder: ComparableEvent[] = [];

let configuredRuntimeMode = "forward";
let configuredMaxRecords = 5000;
let configuredStorePath: string | undefined;

export function configureShadowCompare(options: {
  runtimeMode: string;
  maxRecords: number;
  storePath?: string | undefined;
}): void {
  configuredRuntimeMode = options.runtimeMode;
  configuredMaxRecords = options.maxRecords;
  configuredStorePath = options.storePath;
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function normalizeEventName(value: unknown): string {
  return normalizeString(value) ?? "purchase";
}

function normalizeTransactionId(value: unknown): string {
  return normalizeString(value) ?? "unknown-order";
}

function normalizeCurrency(value: unknown): string | undefined {
  const normalized = normalizeString(value);
  return normalized?.toUpperCase();
}

function buildKey(eventName: string, transactionId: string): string {
  return `${eventName}:${transactionId}`;
}

function buildComparableFromSynapse(payload: SynapseEventPayload): ComparableEvent {
  const eventName = normalizeEventName(payload.event_name);
  const transactionId = normalizeTransactionId(payload.transaction_id);

  return {
    source: "synapse",
    key: buildKey(eventName, transactionId),
    event_name: eventName,
    transaction_id: transactionId,
    value: normalizeNumber(payload.value),
    currency: normalizeCurrency(payload.currency),
    item_count: payload.items.length,
    event_id: normalizeString(payload.event_id),
    observed_at: new Date().toISOString()
  };
}

function readFirstArrayLength(value: unknown): number {
  if (!Array.isArray(value)) {
    return 0;
  }

  return value.length;
}

function buildComparableFromElevar(payload: unknown): ComparableEvent {
  const body = payload as Record<string, unknown>;
  const eventName = normalizeEventName(body.event_name ?? body.event ?? body.name);
  const transactionId = normalizeTransactionId(body.transaction_id ?? body.order_id ?? body.orderId);

  const itemCount =
    readFirstArrayLength(body.items) ||
    readFirstArrayLength(body.contents) ||
    readFirstArrayLength((body.ecommerce as Record<string, unknown> | undefined)?.items);

  return {
    source: "elevar",
    key: buildKey(eventName, transactionId),
    event_name: eventName,
    transaction_id: transactionId,
    value: normalizeNumber(body.value ?? (body.ecommerce as Record<string, unknown> | undefined)?.value),
    currency: normalizeCurrency(body.currency ?? (body.ecommerce as Record<string, unknown> | undefined)?.currency),
    item_count: itemCount,
    event_id: normalizeString(body.event_id),
    observed_at: new Date().toISOString()
  };
}

function keepRecentLimit(): void {
  while (observedOrder.length > configuredMaxRecords) {
    observedOrder.shift();
  }
}

async function appendShadowRecord(event: ComparableEvent): Promise<void> {
  if (!configuredStorePath) {
    return;
  }

  const absolutePath = path.resolve(configuredStorePath);
  const dirPath = path.dirname(absolutePath);
  await mkdir(dirPath, { recursive: true });
  await appendFile(absolutePath, `${JSON.stringify(event)}\n`, "utf8");
}

export async function captureSynapseShadow(payload: SynapseEventPayload): Promise<void> {
  const event = buildComparableFromSynapse(payload);
  synapseEvents.set(event.key, event);
  observedOrder.push(event);
  keepRecentLimit();
  await appendShadowRecord(event);
}

export async function ingestElevarShadow(payload: unknown): Promise<ComparableEvent> {
  const event = buildComparableFromElevar(payload);
  elevarEvents.set(event.key, event);
  observedOrder.push(event);
  keepRecentLimit();
  await appendShadowRecord(event);
  return event;
}

function buildDiff(synapseEvent: ComparableEvent, elevarEvent: ComparableEvent): DiffEntry[] {
  const diffs: DiffEntry[] = [];

  if (synapseEvent.value !== elevarEvent.value) {
    diffs.push({ field: "value", synapse: synapseEvent.value, elevar: elevarEvent.value });
  }

  if (synapseEvent.currency !== elevarEvent.currency) {
    diffs.push({ field: "currency", synapse: synapseEvent.currency, elevar: elevarEvent.currency });
  }

  if (synapseEvent.item_count !== elevarEvent.item_count) {
    diffs.push({ field: "item_count", synapse: synapseEvent.item_count, elevar: elevarEvent.item_count });
  }

  return diffs;
}

export function getShadowCompareSummary(): ShadowCompareSummary {
  const keys = new Set<string>([...synapseEvents.keys(), ...elevarEvents.keys()]);

  let paired = 0;
  let matched = 0;
  let mismatched = 0;
  let synapseOnly = 0;
  let elevarOnly = 0;

  const mismatchesPreview: Array<{ key: string; diffs: DiffEntry[] }> = [];

  for (const key of keys) {
    const synapseEvent = synapseEvents.get(key);
    const elevarEvent = elevarEvents.get(key);

    if (synapseEvent && elevarEvent) {
      paired += 1;
      const diffs = buildDiff(synapseEvent, elevarEvent);
      if (diffs.length === 0) {
        matched += 1;
      } else {
        mismatched += 1;
        if (mismatchesPreview.length < 25) {
          mismatchesPreview.push({ key, diffs });
        }
      }
      continue;
    }

    if (synapseEvent) {
      synapseOnly += 1;
      continue;
    }

    elevarOnly += 1;
  }

  return {
    mode: configuredRuntimeMode,
    counts: {
      synapse_events: synapseEvents.size,
      elevar_events: elevarEvents.size,
      paired_events: paired,
      matched_pairs: matched,
      mismatched_pairs: mismatched,
      synapse_only: synapseOnly,
      elevar_only: elevarOnly
    },
    mismatches_preview: mismatchesPreview
  };
}

export function getRecentShadowEvents(limit = 100): ComparableEvent[] {
  const size = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 500)) : 100;
  return observedOrder.slice(-size).reverse();
}

export function getShadowParityReport(thresholdPct: number): ShadowParityReport {
  const summary = getShadowCompareSummary();
  const paired = summary.counts.paired_events;
  const mismatched = summary.counts.mismatched_pairs;
  const matched = summary.counts.matched_pairs;

  const mismatchRatePct = paired > 0 ? (mismatched / paired) * 100 : 0;
  const matchedRatePct = paired > 0 ? (matched / paired) * 100 : 0;
  const alertTriggered = mismatchRatePct > thresholdPct;

  return {
    threshold_pct: thresholdPct,
    mismatch_rate_pct: Number.parseFloat(mismatchRatePct.toFixed(2)),
    matched_rate_pct: Number.parseFloat(matchedRatePct.toFixed(2)),
    paired_events: paired,
    alert_triggered: alertTriggered,
    status: alertTriggered ? "alert" : "ok"
  };
}
