export type BrowserEventSource = "synapse" | "elevar";

export type BrowserEventRecord = {
  source: BrowserEventSource;
  shop: string;
  event: string;
  event_id?: string | undefined;
  currency?: string | undefined;
  cart_total?: string | undefined;
  product_ids: string[];
  session_id?: string | undefined;
  landing_site?: string | undefined;
  observed_at: string;
  key: string;
};

export type BrowserParityReport = {
  threshold_pct: number;
  mismatch_rate_pct: number;
  matched_rate_pct: number;
  paired_events: number;
  synapse_events: number;
  elevar_events: number;
  alert_triggered: boolean;
  status: "ok" | "alert";
  by_event: Array<{
    event: string;
    synapse: number;
    elevar: number;
  }>;
};

const CORE_FUNNEL = new Set([
  "dl_view_item",
  "dl_add_to_cart",
  "dl_begin_checkout",
  "dl_purchase"
]);

const synapseByKey = new Map<string, BrowserEventRecord>();
const elevarByKey = new Map<string, BrowserEventRecord>();
const recent: BrowserEventRecord[] = [];

let maxRecords = 5000;

export function configureBrowserEvents(options: { maxRecords?: number }): void {
  if (options.maxRecords && options.maxRecords > 0) {
    maxRecords = options.maxRecords;
  }
}

function extractProductIds(ecommerce: unknown): string[] {
  if (!ecommerce || typeof ecommerce !== "object") return [];
  const root = ecommerce as Record<string, unknown>;
  const buckets: unknown[] = [];

  for (const key of ["detail", "add", "remove", "click", "checkout", "purchase", "cart_contents"]) {
    const nested = root[key];
    if (nested && typeof nested === "object") {
      const products = (nested as Record<string, unknown>).products;
      if (Array.isArray(products)) buckets.push(...products);
    }
  }
  if (Array.isArray(root.impressions)) buckets.push(...root.impressions);
  if (Array.isArray(root.products)) buckets.push(...root.products);

  const ids: string[] = [];
  for (const item of buckets) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = row.id ?? row.product_id ?? row.variant_id;
    if (id != null && String(id).trim()) ids.push(String(id));
  }
  return ids;
}

function buildKey(shop: string, event: string, eventId: string | undefined, observedAt: string): string {
  if (eventId && eventId.trim()) {
    return `${shop}:${event}:${eventId.trim()}`;
  }
  // Pair loosely by shop+event+minute bucket when event_id missing.
  const minute = observedAt.slice(0, 16);
  return `${shop}:${event}:${minute}`;
}

export type IngestBrowserEventInput = {
  source: BrowserEventSource;
  shop?: string | undefined;
  event?: string | undefined;
  event_id?: string | undefined;
  currency?: string | undefined;
  cart_total?: string | undefined;
  ecommerce?: unknown;
  marketing?:
    | {
        session_id?: string | undefined;
        landing_site?: string | undefined;
      }
    | undefined;
  observed_at?: string | undefined;
};

export function ingestBrowserEvent(input: IngestBrowserEventInput): BrowserEventRecord {
  const shop = (input.shop || "unknown-shop").trim();
  const event = (input.event || "unknown").trim();
  const observedAt = input.observed_at || new Date().toISOString();
  const record: BrowserEventRecord = {
    source: input.source,
    shop,
    event,
    event_id: input.event_id,
    currency: input.currency,
    cart_total: input.cart_total,
    product_ids: extractProductIds(input.ecommerce),
    session_id: input.marketing?.session_id,
    landing_site: input.marketing?.landing_site,
    observed_at: observedAt,
    key: buildKey(shop, event, input.event_id, observedAt)
  };

  const map = input.source === "synapse" ? synapseByKey : elevarByKey;
  map.set(record.key, record);
  recent.unshift(record);

  while (recent.length > maxRecords) {
    recent.pop();
  }
  while (map.size > maxRecords) {
    const first = map.keys().next().value;
    if (first == null) break;
    map.delete(first);
  }

  return record;
}

export function getRecentBrowserEvents(limit = 50): BrowserEventRecord[] {
  return recent.slice(0, Math.max(1, Math.min(limit, 500)));
}

export function getBrowserEventCounts(): {
  synapse_events: number;
  elevar_events: number;
  by_event: Array<{ event: string; synapse: number; elevar: number }>;
} {
  const byEvent = new Map<string, { synapse: number; elevar: number }>();

  for (const row of synapseByKey.values()) {
    const current = byEvent.get(row.event) ?? { synapse: 0, elevar: 0 };
    current.synapse += 1;
    byEvent.set(row.event, current);
  }
  for (const row of elevarByKey.values()) {
    const current = byEvent.get(row.event) ?? { synapse: 0, elevar: 0 };
    current.elevar += 1;
    byEvent.set(row.event, current);
  }

  return {
    synapse_events: synapseByKey.size,
    elevar_events: elevarByKey.size,
    by_event: [...byEvent.entries()]
      .map(([event, counts]) => ({ event, ...counts }))
      .sort((a, b) => a.event.localeCompare(b.event))
  };
}

export function getBrowserParityReport(thresholdPct = 5): BrowserParityReport {
  const counts = getBrowserEventCounts();
  let paired = 0;
  let mismatched = 0;

  for (const row of counts.by_event) {
    if (!CORE_FUNNEL.has(row.event)) continue;
    const min = Math.min(row.synapse, row.elevar);
    const max = Math.max(row.synapse, row.elevar);
    if (max === 0) continue;
    paired += max;
    mismatched += max - min;
  }

  // Also score product-id overlap on paired keys for core events.
  for (const [key, syn] of synapseByKey.entries()) {
    if (!CORE_FUNNEL.has(syn.event)) continue;
    const el = elevarByKey.get(key);
    if (!el) continue;
    const synIds = new Set(syn.product_ids);
    const overlap = el.product_ids.filter((id) => synIds.has(id)).length;
    const union = new Set([...syn.product_ids, ...el.product_ids]).size;
    if (union > 0 && overlap / union < 0.95) {
      mismatched += 1;
      paired += 1;
    }
  }

  const mismatchRate = paired > 0 ? (mismatched / paired) * 100 : 0;
  const matchedRate = paired > 0 ? 100 - mismatchRate : 100;
  const alert = paired > 0 && mismatchRate > thresholdPct;

  return {
    threshold_pct: thresholdPct,
    mismatch_rate_pct: Number(mismatchRate.toFixed(2)),
    matched_rate_pct: Number(matchedRate.toFixed(2)),
    paired_events: paired,
    synapse_events: counts.synapse_events,
    elevar_events: counts.elevar_events,
    alert_triggered: alert,
    status: alert ? "alert" : "ok",
    by_event: counts.by_event
  };
}

/** Test helper */
export function resetBrowserEventsForTests(): void {
  synapseByKey.clear();
  elevarByKey.clear();
  recent.length = 0;
}
