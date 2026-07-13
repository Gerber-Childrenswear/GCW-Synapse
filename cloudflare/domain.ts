import type { SynapseEventPayload } from "../src/types/shopify";

export type ObservationSource = "synapse" | "elevar";

export type Observation = {
  id: string;
  source: ObservationSource;
  compareKey: string;
  eventName: string;
  transactionId: string;
  valueCents: number | null;
  currency: string | null;
  itemCount: number;
  itemsFingerprint: string;
  eventId: string | null;
  observedAt: string;
  payloadJson: string;
};

export type ObservationDiff = {
  field: "value" | "currency" | "item_count" | "item_identifiers" | "event_id";
  synapse: string | number | null;
  elevar: string | number | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") {
    return null;
  }
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function moneyToCents(value: unknown): number | null {
  const parsed = numberValue(value);
  return parsed === null ? null : Math.round(parsed * 100);
}

function readItems(body: Record<string, unknown>): unknown[] {
  if (Array.isArray(body.items)) {
    return body.items;
  }
  if (Array.isArray(body.contents)) {
    return body.contents;
  }
  const ecommerce = asRecord(body.ecommerce);
  if (Array.isArray(ecommerce.items)) {
    return ecommerce.items;
  }
  const purchase = asRecord(ecommerce.purchase);
  return Array.isArray(purchase.products) ? purchase.products : [];
}

function itemFingerprint(items: unknown[]): string {
  const normalized = items.map((raw) => {
    const item = asRecord(raw);
    const id =
      stringValue(item.item_id) ??
      stringValue(item.sku) ??
      stringValue(item.variant_id) ??
      stringValue(item.product_id) ??
      stringValue(item.id) ??
      "";
    const quantity = numberValue(item.quantity) ?? 0;
    const price = moneyToCents(item.price) ?? 0;
    return `${id}:${quantity}:${price}`;
  });
  return normalized.sort().join("|");
}

function payloadWithoutPii(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    return payload.map(payloadWithoutPii);
  }
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  const sensitive = /email|phone|first_name|last_name|address|postal|zip/i;
  return Object.fromEntries(
    Object.entries(payload as Record<string, unknown>).map(([key, value]) => [
      key,
      sensitive.test(key) ? "[REDACTED]" : payloadWithoutPii(value)
    ])
  );
}

export function redactPayloadJson(payload: unknown): string {
  return JSON.stringify(payloadWithoutPii(payload));
}

export function observationFromPayload(
  source: ObservationSource,
  payload: unknown,
  observedAt = new Date().toISOString()
): Observation {
  const body = asRecord(payload);
  const ecommerce = asRecord(body.ecommerce);
  const eventName =
    stringValue(body.event_name ?? body.event ?? body.name) ?? "purchase";
  const transactionId =
    stringValue(
      body.transaction_id ??
        body.order_id ??
        body.orderId ??
        ecommerce.transaction_id
    ) ?? "unknown-order";
  const items = readItems(body);
  const currency =
    stringValue(body.currency ?? ecommerce.currency)?.toUpperCase() ?? null;
  const valueCents = moneyToCents(body.value ?? ecommerce.value);
  const eventId = stringValue(body.event_id ?? body.eventId);

  return {
    id: crypto.randomUUID(),
    source,
    compareKey: `${eventName}:${transactionId}`,
    eventName,
    transactionId,
    valueCents,
    currency,
    itemCount: items.length,
    itemsFingerprint: itemFingerprint(items),
    eventId,
    observedAt,
    payloadJson: redactPayloadJson(payload)
  };
}

export function observationFromSynapse(
  payload: SynapseEventPayload,
  observedAt = new Date().toISOString()
): Observation {
  return observationFromPayload("synapse", payload, observedAt);
}

export function compareObservations(
  synapse: Observation,
  elevar: Observation
): ObservationDiff[] {
  const diffs: ObservationDiff[] = [];
  if (synapse.valueCents !== elevar.valueCents) {
    diffs.push({
      field: "value",
      synapse: synapse.valueCents,
      elevar: elevar.valueCents
    });
  }
  if (synapse.currency !== elevar.currency) {
    diffs.push({
      field: "currency",
      synapse: synapse.currency,
      elevar: elevar.currency
    });
  }
  if (synapse.itemCount !== elevar.itemCount) {
    diffs.push({
      field: "item_count",
      synapse: synapse.itemCount,
      elevar: elevar.itemCount
    });
  }
  if (synapse.itemsFingerprint !== elevar.itemsFingerprint) {
    diffs.push({
      field: "item_identifiers",
      synapse: synapse.itemsFingerprint,
      elevar: elevar.itemsFingerprint
    });
  }
  if (
    synapse.eventId &&
    elevar.eventId &&
    synapse.eventId !== elevar.eventId
  ) {
    diffs.push({
      field: "event_id",
      synapse: synapse.eventId,
      elevar: elevar.eventId
    });
  }
  return diffs;
}

export async function deterministicEventId(parts: Array<string | number | null | undefined>): Promise<string> {
  const source = parts.map((part) => String(part ?? "unknown")).join("|");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(source)
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

function decodeBase64(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return mismatch === 0;
}

export async function verifyShopifyHmac(
  rawBody: string,
  header: string | null,
  secret: string
): Promise<boolean> {
  if (!header || !secret) {
    return false;
  }
  const provided = decodeBase64(header);
  if (!provided) {
    return false;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody))
  );
  return constantTimeEqual(signature, provided);
}
