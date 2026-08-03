import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_PURCHASE_CANONICAL_TOPIC,
  PURCHASE_DEDUPE_TTL_SECONDS,
  claimPurchaseForward,
  isCanonicalPurchaseTopic,
  isStrongPurchaseIdentity,
  releasePurchaseClaim,
  resolveCanonicalPurchaseTopic,
  resolvePurchaseIdentity
} from "./purchaseIdentity";
import type { PurchaseDedupeStore } from "./purchaseIdentity";
import type { ShopifyOrder } from "../types/shopify";

const SHOP = "gerberchildrenswear.myshopify.com";

/** Only the identity fields vary across these cases, and each may be absent. */
type OrderOverrides = {
  id?: number | undefined;
  admin_graphql_api_id?: string | undefined;
  order_number?: number | undefined;
  name?: string | undefined;
};

function order(overrides: OrderOverrides = {}): ShopifyOrder {
  const built: ShopifyOrder = {
    id: 5544332211,
    name: "#1001",
    order_number: 1001,
    currency: "USD",
    total_price: "25.00",
    line_items: []
  };

  // An explicit `undefined` override means "Shopify did not send this field".
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete (built as Record<string, unknown>)[key];
    } else {
      (built as Record<string, unknown>)[key] = value;
    }
  }

  return built;
}

/** In-memory stand-in for SYNAPSE_STATE, with per-key put/delete counts. */
function memoryStore(): PurchaseDedupeStore & { keys(): string[]; writes: number } {
  const values = new Map<string, string>();
  return {
    writes: 0,
    keys: () => [...values.keys()],
    async get(key: string) {
      return values.get(key) ?? null;
    },
    async put(key: string, value: string) {
      this.writes += 1;
      values.set(key, value);
    },
    async delete(key: string) {
      values.delete(key);
    }
  };
}

test("resolveCanonicalPurchaseTopic defaults to orders/paid and only accepts known topics", () => {
  assert.equal(resolveCanonicalPurchaseTopic({}), DEFAULT_PURCHASE_CANONICAL_TOPIC);
  assert.equal(resolveCanonicalPurchaseTopic({ PURCHASE_CANONICAL_TOPIC: "orders/create" }), "orders/create");
  assert.equal(resolveCanonicalPurchaseTopic({ PURCHASE_CANONICAL_TOPIC: " ORDERS/PAID " }), "orders/paid");
  assert.equal(resolveCanonicalPurchaseTopic({ PURCHASE_CANONICAL_TOPIC: "orders/updated" }), "orders/paid");
});

test("isCanonicalPurchaseTopic follows the configured topic", () => {
  assert.equal(isCanonicalPurchaseTopic("orders/paid", {}), true);
  assert.equal(isCanonicalPurchaseTopic("orders/create", {}), false);
  const env = { PURCHASE_CANONICAL_TOPIC: "orders/create" };
  assert.equal(isCanonicalPurchaseTopic("orders/create", env), true);
  assert.equal(isCanonicalPurchaseTopic("orders/paid", env), false);
});

test("resolvePurchaseIdentity prefers the stable numeric order id", () => {
  const identity = resolvePurchaseIdentity(SHOP, order());
  assert.equal(identity.order_key, "5544332211");
  assert.equal(identity.order_key_source, "id");
  assert.equal(identity.idempotency_key, `purchase:${SHOP}:5544332211`);
  assert.equal(identity.event_id.length, 32);
});

test("resolvePurchaseIdentity is topic-independent and delivery-independent", () => {
  const paid = resolvePurchaseIdentity(SHOP, order());
  const created = resolvePurchaseIdentity(SHOP, order({ name: "#1001", order_number: 1001 }));
  assert.equal(paid.event_id, created.event_id);
  assert.equal(paid.idempotency_key, created.idempotency_key);
});

test("resolvePurchaseIdentity separates shops and orders", () => {
  const a = resolvePurchaseIdentity(SHOP, order());
  const b = resolvePurchaseIdentity("gcw-dev.myshopify.com", order());
  const c = resolvePurchaseIdentity(SHOP, order({ id: 5544332212 }));
  assert.notEqual(a.event_id, b.event_id);
  assert.notEqual(a.event_id, c.event_id);
  assert.notEqual(a.idempotency_key, b.idempotency_key);
});

test("resolvePurchaseIdentity strips the admin GraphQL gid so it matches the numeric id", () => {
  const numeric = resolvePurchaseIdentity(SHOP, order());
  const gid = resolvePurchaseIdentity(
    SHOP,
    order({ id: undefined, admin_graphql_api_id: "gid://shopify/Order/5544332211" })
  );
  assert.equal(gid.order_key_source, "admin_graphql_api_id");
  assert.equal(gid.order_key, numeric.order_key);
  assert.equal(gid.event_id, numeric.event_id);
});

test("resolvePurchaseIdentity falls back to order_number then name, and reports none", () => {
  const byNumber = resolvePurchaseIdentity(SHOP, order({ id: undefined }));
  assert.equal(byNumber.order_key_source, "order_number");
  assert.equal(byNumber.order_key, "1001");
  assert.equal(isStrongPurchaseIdentity(byNumber), false);

  const byName = resolvePurchaseIdentity(SHOP, order({ id: undefined, order_number: undefined }));
  assert.equal(byName.order_key_source, "name");
  assert.equal(byName.order_key, "#1001");
  assert.equal(isStrongPurchaseIdentity(byName), false);

  const none = resolvePurchaseIdentity(
    SHOP,
    order({ id: undefined, order_number: undefined, name: undefined })
  );
  assert.equal(none.order_key_source, "none");
  assert.equal(none.order_key, "");
  assert.equal(isStrongPurchaseIdentity(none), false);

  assert.equal(isStrongPurchaseIdentity(resolvePurchaseIdentity(SHOP, order())), true);
  assert.equal(
    isStrongPurchaseIdentity(
      resolvePurchaseIdentity(
        SHOP,
        order({ id: undefined, admin_graphql_api_id: "gid://shopify/Order/5544332211" })
      )
    ),
    true
  );
});

test("claimPurchaseForward claims once per order key and reports later deliveries as duplicates", async () => {
  const store = memoryStore();
  const key = `purchase:${SHOP}:5544332211`;

  const first = await claimPurchaseForward({ store, key, eventId: "evt", topic: "orders/paid" });
  assert.equal(first.status, "claimed");

  const second = await claimPurchaseForward({ store, key, eventId: "evt", topic: "orders/create" });
  assert.equal(second.status, "duplicate");
  assert.equal(second.first_seen_topic, "orders/paid");
  assert.equal(typeof second.first_seen_at, "string");

  assert.equal(store.writes, 1);
  assert.deepEqual(store.keys(), [key]);
});

test("claimPurchaseForward writes one key per order rather than one shared key", async () => {
  const store = memoryStore();
  for (const orderKey of ["1", "2", "3"]) {
    const claim = await claimPurchaseForward({
      store,
      key: `purchase:${SHOP}:${orderKey}`,
      eventId: `evt_${orderKey}`,
      topic: "orders/paid"
    });
    assert.equal(claim.status, "claimed");
  }
  assert.deepEqual(store.keys().sort(), [
    `purchase:${SHOP}:1`,
    `purchase:${SHOP}:2`,
    `purchase:${SHOP}:3`
  ]);
});

test("claimPurchaseForward applies a bounded TTL", async () => {
  const seen: Array<{ expirationTtl?: number }> = [];
  const values = new Map<string, string>();
  const store: PurchaseDedupeStore = {
    async get(key) {
      return values.get(key) ?? null;
    },
    async put(key, value, options) {
      seen.push(options ?? {});
      values.set(key, value);
    },
    async delete() {
      // not used
    }
  };
  const claim = await claimPurchaseForward({ store, key: "k", eventId: "evt", topic: "orders/paid" });
  assert.equal(claim.status, "claimed");
  assert.equal(seen[0]?.expirationTtl, PURCHASE_DEDUPE_TTL_SECONDS);
  assert.equal(PURCHASE_DEDUPE_TTL_SECONDS, 604800);
});

test("claimPurchaseForward loses a last-write race instead of double-claiming", async () => {
  let puts = 0;
  const store: PurchaseDedupeStore = {
    async get() {
      // Always empty on the pre-check; after the put, return a foreign claim.
      if (puts === 0) return null;
      return JSON.stringify({
        event_id: "other",
        topic: "orders/paid",
        claimed_at: "2026-01-01T00:00:00.000Z",
        claim_nonce: "foreign-nonce"
      });
    },
    async put() {
      puts += 1;
    },
    async delete() {
      // not used
    }
  };

  const claim = await claimPurchaseForward({
    store,
    key: "purchase:race",
    eventId: "evt",
    topic: "orders/paid"
  });
  assert.equal(claim.status, "duplicate");
  assert.equal(claim.first_seen_topic, "orders/paid");
  assert.equal(puts, 1);
});

test("claimPurchaseForward surfaces a missing store instead of silently allowing a forward", async () => {
  const claim = await claimPurchaseForward({ key: "k", eventId: "evt", topic: "orders/paid" });
  assert.equal(claim.status, "unavailable");
  assert.equal(claim.error, "dedupe_store_not_bound");
});

test("claimPurchaseForward surfaces read and write failures", async () => {
  const readFails: PurchaseDedupeStore = {
    async get() {
      throw new Error("kv read exploded");
    },
    async put() {
      // not reached
    },
    async delete() {
      // not reached
    }
  };
  const readClaim = await claimPurchaseForward({
    store: readFails,
    key: "k",
    eventId: "evt",
    topic: "orders/paid"
  });
  assert.equal(readClaim.status, "error");
  assert.equal(readClaim.error, "kv read exploded");

  const writeFails: PurchaseDedupeStore = {
    async get() {
      return null;
    },
    async put() {
      throw new Error("kv write exploded");
    },
    async delete() {
      // not reached
    }
  };
  const writeClaim = await claimPurchaseForward({
    store: writeFails,
    key: "k",
    eventId: "evt",
    topic: "orders/paid"
  });
  assert.equal(writeClaim.status, "error");
  assert.equal(writeClaim.error, "kv write exploded");
});

test("releasePurchaseClaim frees the key so a retry can claim it again", async () => {
  const store = memoryStore();
  const key = `purchase:${SHOP}:5544332211`;
  await claimPurchaseForward({ store, key, eventId: "evt", topic: "orders/paid" });

  const released = await releasePurchaseClaim(store, key);
  assert.equal(released.released, true);
  assert.deepEqual(store.keys(), []);

  const retry = await claimPurchaseForward({ store, key, eventId: "evt", topic: "orders/paid" });
  assert.equal(retry.status, "claimed");
});
