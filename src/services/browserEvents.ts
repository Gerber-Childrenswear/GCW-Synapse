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
  /** Demo-seed / dual-run simulator traffic — excluded from launch GO. */
  synthetic?: boolean | undefined;
};

export type BrowserParityReport = {
  threshold_pct: number;
  mismatch_rate_pct: number;
  matched_rate_pct: number;
  /** Volume balance across core funnel (ignores divergent event_ids). */
  volume_match_pct: number;
  /** Fuzzy pairs matched by shop+event+product within a time window. */
  fuzzy_paired: number;
  /** % of Synapse core funnel events that include cart_total (Elevar field completeness). */
  cart_total_coverage_pct: number;
  /** % of Synapse core funnel events that include at least one product id. */
  product_id_coverage_pct: number;
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
  "dl_view_cart",
  "dl_begin_checkout",
  "dl_purchase"
]);

const CART_TOTAL_EVENTS = new Set([
  "dl_user_data",
  "dl_add_to_cart",
  "dl_remove_from_cart",
  "dl_view_cart",
  "dl_begin_checkout",
  "dl_add_shipping_info",
  "dl_add_payment_info",
  "dl_purchase"
]);

const PRODUCT_ID_EVENTS = new Set([
  "dl_view_item",
  "dl_select_item",
  "dl_add_to_cart",
  "dl_remove_from_cart",
  "dl_view_cart",
  "dl_begin_checkout",
  "dl_add_shipping_info",
  "dl_add_payment_info",
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
  synthetic?: boolean | undefined;
};

/** Demo-seed / simulator event_id prefixes (legacy rows without synthetic flag). */
const SYNTHETIC_EVENT_ID_RE = /^(demo_|sim_)/i;

export function isSyntheticBrowserEvent(
  row: Pick<BrowserEventRecord, "synthetic" | "event_id">
): boolean {
  if (row.synthetic === true) return true;
  const id = row.event_id?.trim() ?? "";
  return Boolean(id && SYNTHETIC_EVENT_ID_RE.test(id));
}

export function ingestBrowserEvent(input: IngestBrowserEventInput): BrowserEventRecord {
  const shop = (input.shop || "unknown-shop").trim();
  const event = (input.event || "unknown").trim();
  const observedAt = input.observed_at || new Date().toISOString();
  const synthetic =
    input.synthetic === true || isSyntheticBrowserEvent({ synthetic: false, event_id: input.event_id });
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
    key: buildKey(shop, event, input.event_id, observedAt),
    ...(synthetic ? { synthetic: true } : {})
  };

  const map = input.source === "synapse" ? synapseByKey : elevarByKey;
  const existed = map.has(record.key);
  map.set(record.key, record);
  if (!existed) {
    recent.unshift(record);
  } else {
    // Refresh the in-place recent row if present; avoid double-counting volume.
    const idx = recent.findIndex((row) => row.key === record.key && row.source === record.source);
    if (idx >= 0) recent[idx] = record;
    else recent.unshift(record);
  }

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

/** Snapshot for Cache API persistence across Worker isolates. */
export function getBrowserEventsSnapshot(limit = 500): BrowserEventRecord[] {
  return recent.slice(0, Math.max(1, Math.min(limit, maxRecords)));
}

/** Merge persisted records into in-memory maps (upsert by key). */
export function hydrateBrowserEvents(records: BrowserEventRecord[]): number {
  let loaded = 0;
  for (const row of [...records].reverse()) {
    if (!row || (row.source !== "synapse" && row.source !== "elevar")) continue;
    if (!row.shop || !row.event || !row.key || !row.observed_at) continue;
    const map = row.source === "synapse" ? synapseByKey : elevarByKey;
    const normalized: BrowserEventRecord = {
      ...row,
      product_ids: Array.isArray(row.product_ids) ? row.product_ids : [],
      ...(isSyntheticBrowserEvent(row) ? { synthetic: true } : {})
    };
    const existed = map.has(row.key);
    map.set(row.key, normalized);
    if (!existed) {
      recent.unshift(normalized);
      loaded += 1;
    }
  }
  while (recent.length > maxRecords) {
    recent.pop();
  }
  return loaded;
}

export function getBrowserEventCounts(options?: { excludeSynthetic?: boolean }): {
  synapse_events: number;
  elevar_events: number;
  synthetic_excluded: number;
  by_event: Array<{ event: string; synapse: number; elevar: number }>;
} {
  const excludeSynthetic = options?.excludeSynthetic === true;
  const byEvent = new Map<string, { synapse: number; elevar: number }>();
  let syntheticExcluded = 0;

  for (const row of synapseByKey.values()) {
    if (excludeSynthetic && isSyntheticBrowserEvent(row)) {
      syntheticExcluded += 1;
      continue;
    }
    const current = byEvent.get(row.event) ?? { synapse: 0, elevar: 0 };
    current.synapse += 1;
    byEvent.set(row.event, current);
  }
  for (const row of elevarByKey.values()) {
    if (excludeSynthetic && isSyntheticBrowserEvent(row)) {
      syntheticExcluded += 1;
      continue;
    }
    const current = byEvent.get(row.event) ?? { synapse: 0, elevar: 0 };
    current.elevar += 1;
    byEvent.set(row.event, current);
  }

  let synapseEvents = 0;
  let elevarEvents = 0;
  for (const counts of byEvent.values()) {
    synapseEvents += counts.synapse;
    elevarEvents += counts.elevar;
  }

  return {
    synapse_events: synapseEvents,
    elevar_events: elevarEvents,
    synthetic_excluded: syntheticExcluded,
    by_event: [...byEvent.entries()]
      .map(([event, counts]) => ({ event, ...counts }))
      .sort((a, b) => a.event.localeCompare(b.event))
  };
}

export type BrowserParityOptions = {
  excludeSynthetic?: boolean;
};

export function getBrowserParityReport(
  thresholdPct = 5,
  options?: BrowserParityOptions
): BrowserParityReport & { synthetic_excluded: number } {
  const excludeSynthetic = options?.excludeSynthetic === true;
  const counts = getBrowserEventCounts({ excludeSynthetic });

  // Beat-Elevar volume score: how much of Elevar's core funnel Synapse covers.
  // Synapse-only extras (ahead of Elevar) do not count as mismatch.
  let elevarVolume = 0;
  let coveredVolume = 0;

  for (const row of counts.by_event) {
    if (!CORE_FUNNEL.has(row.event)) continue;
    if (row.elevar === 0) continue;
    elevarVolume += row.elevar;
    coveredVolume += Math.min(row.synapse, row.elevar);
  }

  // Fuzzy pair Synapse↔Elevar when event_ids differ (normal during dual-run):
  // same shop + event + overlapping product id within ±2 minutes.
  let fuzzyPaired = 0;
  const usedElevar = new Set<string>();
  for (const syn of synapseByKey.values()) {
    if (excludeSynthetic && isSyntheticBrowserEvent(syn)) continue;
    if (!CORE_FUNNEL.has(syn.event)) continue;
    const synMs = Date.parse(syn.observed_at);
    if (!Number.isFinite(synMs)) continue;
    for (const el of elevarByKey.values()) {
      if (excludeSynthetic && isSyntheticBrowserEvent(el)) continue;
      if (usedElevar.has(el.key)) continue;
      if (el.shop !== syn.shop || el.event !== syn.event) continue;
      const elMs = Date.parse(el.observed_at);
      if (!Number.isFinite(elMs)) continue;
      if (Math.abs(synMs - elMs) > 120_000) continue;
      const synIds = new Set(syn.product_ids.map(String));
      const overlap =
        synIds.size === 0 && el.product_ids.length === 0
          ? 1
          : el.product_ids.filter((id) => synIds.has(String(id))).length;
      if (overlap > 0 || (synIds.size === 0 && el.product_ids.length === 0)) {
        fuzzyPaired += 1;
        usedElevar.add(el.key);
        break;
      }
    }
  }

  const volumeMatchPct =
    elevarVolume > 0 ? Number(((coveredVolume / elevarVolume) * 100).toFixed(2)) : 100;
  const mismatchRate = elevarVolume > 0 ? Number((((elevarVolume - coveredVolume) / elevarVolume) * 100).toFixed(2)) : 0;
  const matchedRate = volumeMatchPct;
  const alert = elevarVolume > 0 && mismatchRate > thresholdPct;

  let cartTotalEligible = 0;
  let cartTotalPresent = 0;
  let productIdEligible = 0;
  let productIdPresent = 0;
  for (const syn of synapseByKey.values()) {
    if (excludeSynthetic && isSyntheticBrowserEvent(syn)) continue;
    if (CART_TOTAL_EVENTS.has(syn.event)) {
      cartTotalEligible += 1;
      if (syn.cart_total != null && String(syn.cart_total).trim() !== "") {
        cartTotalPresent += 1;
      }
    }
    if (PRODUCT_ID_EVENTS.has(syn.event)) {
      productIdEligible += 1;
      if (syn.product_ids.length > 0) productIdPresent += 1;
    }
  }
  const cartTotalCoveragePct =
    cartTotalEligible > 0
      ? Number(((cartTotalPresent / cartTotalEligible) * 100).toFixed(2))
      : 100;
  const productIdCoveragePct =
    productIdEligible > 0
      ? Number(((productIdPresent / productIdEligible) * 100).toFixed(2))
      : 100;

  return {
    threshold_pct: thresholdPct,
    mismatch_rate_pct: mismatchRate,
    matched_rate_pct: matchedRate,
    volume_match_pct: volumeMatchPct,
    fuzzy_paired: fuzzyPaired,
    cart_total_coverage_pct: cartTotalCoveragePct,
    product_id_coverage_pct: productIdCoveragePct,
    paired_events: elevarVolume,
    synapse_events: counts.synapse_events,
    elevar_events: counts.elevar_events,
    alert_triggered: alert,
    status: alert ? "alert" : "ok",
    by_event: counts.by_event,
    synthetic_excluded: counts.synthetic_excluded
  };
}

/** Test helper */
export function resetBrowserEventsForTests(): void {
  synapseByKey.clear();
  elevarByKey.clear();
  recent.length = 0;
}
