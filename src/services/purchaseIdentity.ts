/**
 * Purchase identity, canonical-topic gating and topic-independent idempotency.
 *
 * Shopify delivers one paid order twice — `orders/create` and `orders/paid` —
 * and both deliveries used to forward a `purchase` event carrying a per-delivery
 * `event_id`. GA4 survives that because it dedupes on `transaction_id`, but Meta
 * CAPI and TikTok Events API dedupe on `event_id`, so every conversion counted
 * twice.
 *
 * Everything here keys off Shopify's stable numeric order id — never the webhook
 * delivery id, never the topic — so both topics, and every Shopify retry of
 * either topic, resolve to the same `event_id` and the same dedupe key.
 */

import { normalizeShopDomain } from "./shopRuntime";
import type { ShopifyOrder } from "../types/shopify";

/** Deterministic event id without Node crypto (Workers-safe). */
export function resolveEdgeEventId(parts: Array<string | number | undefined>): string {
  const source = parts
    .map((part) => (part == null ? "" : String(part).trim()))
    .filter((part) => part.length > 0)
    .join("|");
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  let hash2 = 5381;
  for (let i = 0; i < source.length; i += 1) {
    hash2 = (hash2 * 33) ^ source.charCodeAt(i);
  }
  const hex2 = (hash2 >>> 0).toString(16).padStart(8, "0");
  return `${hex}${hex2}${hex}${hex2}`.slice(0, 32);
}

/** Topics Shopify can deliver for a new order. Exactly one of them may forward. */
export const PURCHASE_TOPICS = ["orders/paid", "orders/create"] as const;

/**
 * `orders/paid` is the accurate revenue signal: it fires when Shopify marks the
 * order paid, so authorization failures and cancelled-before-capture orders
 * never reach the ad platforms. Configurable because a shop that starts taking
 * unpaid/pending/COD orders would need `orders/create` instead.
 */
export const DEFAULT_PURCHASE_CANONICAL_TOPIC = "orders/paid";

/** 7 days comfortably outlasts Shopify's ~48h webhook retry window. */
export const PURCHASE_DEDUPE_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Namespace so a future refund id can never collide with a purchase id. */
const PURCHASE_EVENT_ID_NAMESPACE = "purchase";

export type PurchaseTopicEnv = {
  /** `orders/paid` (default) or `orders/create`. Anything else falls back to the default. */
  PURCHASE_CANONICAL_TOPIC?: string;
};

export function normalizePurchaseTopic(topic: string | undefined | null): string {
  return (topic ?? "").trim().toLowerCase();
}

export function resolveCanonicalPurchaseTopic(env: PurchaseTopicEnv): string {
  const configured = normalizePurchaseTopic(env.PURCHASE_CANONICAL_TOPIC);
  return (PURCHASE_TOPICS as readonly string[]).includes(configured)
    ? configured
    : DEFAULT_PURCHASE_CANONICAL_TOPIC;
}

export function isCanonicalPurchaseTopic(topic: string | undefined, env: PurchaseTopicEnv): boolean {
  return normalizePurchaseTopic(topic) === resolveCanonicalPurchaseTopic(env);
}

export type PurchaseOrderKeySource =
  | "id"
  | "admin_graphql_api_id"
  | "order_number"
  | "name"
  | "none";

export type PurchaseIdentity = {
  /** Stable per-order key. Same value on every topic and every retry. */
  order_key: string;
  order_key_source: PurchaseOrderKeySource;
  event_id: string;
  idempotency_key: string;
};

/** `gid://shopify/Order/123` → `123`, so it agrees with the numeric `order.id`. */
function stripOrderGid(value: string): string {
  const tail = value.split("/").pop();
  return tail && tail.length > 0 ? tail : value;
}

/**
 * Resolve the stable identity for one order. Preference order is strict: the
 * numeric Shopify order id first, because it is the only field guaranteed
 * identical across topics, retries and the checkout pixel.
 */
export function resolvePurchaseIdentity(
  shopDomain: string | undefined,
  order: ShopifyOrder
): PurchaseIdentity {
  const shop = normalizeShopDomain(shopDomain) || "unknown-shop";
  const candidates: Array<[PurchaseOrderKeySource, unknown]> = [
    ["id", order.id],
    ["admin_graphql_api_id", order.admin_graphql_api_id],
    ["order_number", order.order_number],
    ["name", order.name]
  ];

  let orderKey = "";
  let orderKeySource: PurchaseOrderKeySource = "none";
  for (const [source, value] of candidates) {
    const normalized = value == null ? "" : String(value).trim();
    if (normalized.length === 0) continue;
    orderKey = source === "admin_graphql_api_id" ? stripOrderGid(normalized) : normalized;
    orderKeySource = source;
    break;
  }

  return {
    order_key: orderKey,
    order_key_source: orderKeySource,
    event_id: resolveEdgeEventId([PURCHASE_EVENT_ID_NAMESPACE, shop, orderKey]),
    idempotency_key: `${PURCHASE_EVENT_ID_NAMESPACE}:${shop}:${orderKey || "unknown-order"}`
  };
}

/**
 * Minimal KV surface used for dedupe. One key per order — never a shared key
 * that every request read-modify-writes, which Cloudflare rate limits to about
 * one write per second per key.
 */
export type PurchaseDedupeStore = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
};

export type PurchaseClaimStatus = "claimed" | "duplicate" | "unavailable" | "error";

export type PurchaseClaim = {
  status: PurchaseClaimStatus;
  key: string;
  claimed_at?: string;
  first_seen_at?: string;
  first_seen_topic?: string;
  error?: string;
};

type PurchaseClaimRecord = {
  event_id?: string;
  topic?: string;
  webhook_id?: string;
  claimed_at?: string;
};

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readClaimRecord(raw: string): PurchaseClaimRecord {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as PurchaseClaimRecord) : {};
  } catch {
    return {};
  }
}

/**
 * Claim the right to forward one order exactly once. Callers must treat
 * `unavailable` and `error` as "do not forward": we cannot prove this is the
 * first delivery, and a silently forwarded unknown is exactly the double-count
 * this module exists to prevent.
 */
export async function claimPurchaseForward(options: {
  store?: PurchaseDedupeStore | undefined;
  key: string;
  eventId: string;
  topic: string;
  webhookId?: string | null | undefined;
  ttlSeconds?: number;
}): Promise<PurchaseClaim> {
  const store = options.store;
  if (!store) {
    return { status: "unavailable", key: options.key, error: "dedupe_store_not_bound" };
  }

  let existing: string | null = null;
  try {
    existing = await store.get(options.key);
  } catch (error) {
    return { status: "error", key: options.key, error: describeError(error) };
  }

  if (existing) {
    const record = readClaimRecord(existing);
    return {
      status: "duplicate",
      key: options.key,
      ...(record.claimed_at ? { first_seen_at: record.claimed_at } : {}),
      ...(record.topic ? { first_seen_topic: record.topic } : {})
    };
  }

  const claimedAt = new Date().toISOString();
  const record: PurchaseClaimRecord = {
    event_id: options.eventId,
    topic: options.topic,
    ...(options.webhookId ? { webhook_id: options.webhookId } : {}),
    claimed_at: claimedAt
  };

  try {
    await store.put(options.key, JSON.stringify(record), {
      expirationTtl: options.ttlSeconds ?? PURCHASE_DEDUPE_TTL_SECONDS
    });
  } catch (error) {
    return { status: "error", key: options.key, error: describeError(error) };
  }

  return { status: "claimed", key: options.key, claimed_at: claimedAt };
}

/**
 * Drop a claim whose forward did not land, so Shopify's retry can try again.
 * Without this a single 5xx from sGTM would silently discard the conversion for
 * the whole TTL.
 */
export async function releasePurchaseClaim(
  store: PurchaseDedupeStore | undefined,
  key: string
): Promise<{ released: boolean; error?: string }> {
  if (!store) {
    return { released: false, error: "dedupe_store_not_bound" };
  }
  try {
    await store.delete(key);
    return { released: true };
  } catch (error) {
    return { released: false, error: describeError(error) };
  }
}
