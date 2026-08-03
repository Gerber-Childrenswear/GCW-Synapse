import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import {
  mapOrderToPurchaseEdge,
  processPurchaseWebhookEdge,
  resolveEdgeEventId,
  verifyShopifyWebhookHmacEdge
} from "./edgeWebhook";
import type { PurchaseDedupeStore } from "./purchaseIdentity";
import type { ShopifyOrder } from "../types/shopify";

test("resolveEdgeEventId is stable", () => {
  const a = resolveEdgeEventId(["shop", "orders/paid", 1001, "#1001"]);
  const b = resolveEdgeEventId(["shop", "orders/paid", 1001, "#1001"]);
  assert.equal(a, b);
  assert.equal(a.length, 32);
});

test("verifyShopifyWebhookHmacEdge accepts valid digest", async () => {
  const body = JSON.stringify({ id: 1, name: "#1001" });
  const secret = "test-secret";
  const digest = createHmac("sha256", secret).update(body, "utf8").digest("base64");
  const bytes = new TextEncoder().encode(body);
  const ok = await verifyShopifyWebhookHmacEdge(bytes.buffer.slice(0) as ArrayBuffer, digest, secret);
  assert.equal(ok, true);
});

test("mapOrderToPurchaseEdge attaches currency and items", () => {
  const order: ShopifyOrder = {
    name: "#2002",
    order_number: 2002,
    currency: "USD",
    total_price: "42.50",
    total_tax: "2.50",
    note_attributes: [
      { name: "synapse_session_id", value: "sess_abc" },
      { name: "synapse_landing_site", value: "https://example.com/?utm_source=google" }
    ],
    line_items: [
      {
        title: "Onesie",
        sku: "SKU-1",
        product_id: 11,
        variant_id: 22,
        price: "40.00",
        quantity: 1
      }
    ]
  };
  const payload = mapOrderToPurchaseEdge(order, "evt_1");
  assert.equal(payload.event_name, "purchase");
  assert.equal(payload.value, 42.5);
  assert.equal(payload.items.length, 1);
  assert.equal(payload.items[0]?.sku, "SKU-1");
});

test("processPurchaseWebhookEdge shadows with session marketing", async () => {
  const order = {
    name: "#3003",
    order_number: 3003,
    currency: "USD",
    total_price: "10.00",
    note_attributes: [{ name: "synapse_session_id", value: "sid_1" }],
    line_items: [{ title: "Hat", price: "10.00", quantity: 1, sku: "HAT" }]
  };
  const raw = new TextEncoder().encode(JSON.stringify(order));
  const secret = "whsec";
  const digest = createHmac("sha256", secret).update(Buffer.from(raw)).digest("base64");

  const result = await processPurchaseWebhookEdge({
    env: {
      SHOPIFY_WEBHOOK_SECRET: secret,
      RUNTIME_MODE: "shadow_compare"
    },
    rawBody: raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
    hmacHeader: digest,
    shop: "gcw-dev.myshopify.com",
    topic: "orders/paid",
    webhookId: "wh_1"
  });

  assert.equal(result.ok, true);
  assert.equal(result.body.status, "shadow_captured_no_forward");
  assert.equal(result.body.session_attached, true);
  assert.equal((result.body.marketing as { session_id?: string }).session_id, "sid_1");
});

test("processPurchaseWebhookEdge fail-closed in forward without webhook secret", async () => {
  const raw = new TextEncoder().encode(JSON.stringify({ name: "#1", total_price: "1.00" }));
  const result = await processPurchaseWebhookEdge({
    env: { RUNTIME_MODE: "forward" },
    rawBody: raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
    hmacHeader: null,
    shop: "gcw-dev.myshopify.com",
    topic: "orders/paid"
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
  assert.equal(result.body.error, "webhook_secret_not_configured");
});

test("processPurchaseWebhookEdge fail-closed in shadow_compare without webhook secret", async () => {
  const raw = new TextEncoder().encode(JSON.stringify({ name: "#1", total_price: "1.00" }));
  const result = await processPurchaseWebhookEdge({
    env: { RUNTIME_MODE: "shadow_compare" },
    rawBody: raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
    hmacHeader: null,
    shop: "gcw-dev.myshopify.com",
    topic: "orders/paid"
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
  assert.equal(result.body.error, "webhook_secret_not_configured");
});

const WEBHOOK_SECRET = "whsec-isolation";
const PROD_SHOP = "gerberchildrenswear.myshopify.com";
const DEV_SHOP = "gcw-dev.myshopify.com";
const PROD_COLLECT = "https://sgtm.example.com/g/collect";

const ISOLATION_ENV = {
  SHOPIFY_WEBHOOK_SECRET: WEBHOOK_SECRET,
  RUNTIME_MODE: "forward",
  SHOP_RUNTIME_MODES: `${PROD_SHOP}=forward,${DEV_SHOP}=shadow`,
  GTM_SERVER_URL_BY_SHOP: `${PROD_SHOP}=${PROD_COLLECT}`,
  GTM_SERVER_URL: PROD_COLLECT
};

function signedOrder(overrides: Record<string, unknown> = {}): {
  rawBody: ArrayBuffer;
  hmacHeader: string;
} {
  const raw = new TextEncoder().encode(
    JSON.stringify({
      id: 4004004004,
      name: "#4004",
      order_number: 4004,
      currency: "USD",
      total_price: "25.00",
      line_items: [{ title: "Bib", price: "25.00", quantity: 1, sku: "BIB" }],
      ...overrides
    })
  );
  return {
    rawBody: raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
    hmacHeader: createHmac("sha256", WEBHOOK_SECRET).update(Buffer.from(raw)).digest("base64")
  };
}

/** In-memory stand-in for the SYNAPSE_STATE KV namespace. */
function memoryDedupeStore(): PurchaseDedupeStore & { keys(): string[] } {
  const values = new Map<string, string>();
  return {
    keys: () => [...values.keys()],
    async get(key: string) {
      return values.get(key) ?? null;
    },
    async put(key: string, value: string) {
      values.set(key, value);
    },
    async delete(key: string) {
      values.delete(key);
    }
  };
}

/** Capture forward attempts so a test can assert nothing left the Worker. */
async function withFetchSpy<T>(
  run: () => Promise<T>
): Promise<{ result: T; requestedUrls: string[] }> {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedUrls.push(typeof input === "string" ? input : String(input));
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof globalThis.fetch;

  try {
    return { result: await run(), requestedUrls };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("per-shop isolation: known production shop forwards to its own sGTM destination", async () => {
  const { rawBody, hmacHeader } = signedOrder();
  const { result, requestedUrls } = await withFetchSpy(() =>
    processPurchaseWebhookEdge({
      env: ISOLATION_ENV,
      rawBody,
      hmacHeader,
      shop: PROD_SHOP,
      topic: "orders/paid",
      webhookId: "wh_prod",
      dedupeStore: memoryDedupeStore()
    })
  );

  assert.equal(result.ok, true);
  assert.equal(result.body.status, "forwarded");
  assert.equal(result.body.runtime_mode, "forward");
  assert.deepEqual(requestedUrls, [PROD_COLLECT]);
});

test("per-shop isolation: known dev shop shadows and never forwards", async () => {
  const { rawBody, hmacHeader } = signedOrder();
  const { result, requestedUrls } = await withFetchSpy(() =>
    processPurchaseWebhookEdge({
      env: ISOLATION_ENV,
      rawBody,
      hmacHeader,
      shop: DEV_SHOP,
      topic: "orders/paid",
      webhookId: "wh_dev"
    })
  );

  assert.equal(result.body.status, "shadow_captured_no_forward");
  assert.equal(result.body.runtime_mode, "shadow");
  assert.deepEqual(requestedUrls, []);
});

test("per-shop isolation: missing or unknown shop never forwards", async () => {
  for (const shop of ["unknown-shop", "attacker.myshopify.com"]) {
    const { rawBody, hmacHeader } = signedOrder();
    const { result, requestedUrls } = await withFetchSpy(() =>
      processPurchaseWebhookEdge({
        env: ISOLATION_ENV,
        rawBody,
        hmacHeader,
        shop,
        topic: "orders/paid",
        webhookId: `wh_${shop}`
      })
    );

    assert.equal(result.body.status, "shadow_captured_no_forward", shop);
    assert.equal(result.body.runtime_mode, "shadow", shop);
    assert.deepEqual(requestedUrls, [], shop);
  }
});

test("per-shop isolation: unmapped shop never forwards even with a global collect URL set", async () => {
  const { rawBody, hmacHeader } = signedOrder();
  const { result, requestedUrls } = await withFetchSpy(() =>
    processPurchaseWebhookEdge({
      env: {
        SHOPIFY_WEBHOOK_SECRET: WEBHOOK_SECRET,
        RUNTIME_MODE: "forward",
        GTM_SERVER_URL: PROD_COLLECT
      },
      rawBody,
      hmacHeader,
      shop: PROD_SHOP,
      topic: "orders/paid",
      webhookId: "wh_unmapped"
    })
  );

  assert.equal(result.body.status, "shadow_captured_no_forward");
  assert.equal(result.body.runtime_mode, "shadow");
  assert.deepEqual(requestedUrls, []);
});

/** Deliver one order on a topic, sharing a dedupe store across deliveries. */
function deliverPurchase(options: {
  topic: string;
  webhookId: string;
  dedupeStore?: PurchaseDedupeStore | undefined;
  shop?: string;
  env?: Record<string, string>;
  order?: Record<string, unknown>;
}) {
  const { rawBody, hmacHeader } = signedOrder(options.order ?? {});
  return withFetchSpy(() =>
    processPurchaseWebhookEdge({
      env: { ...ISOLATION_ENV, ...(options.env ?? {}) },
      rawBody,
      hmacHeader,
      shop: options.shop ?? PROD_SHOP,
      topic: options.topic,
      webhookId: options.webhookId,
      dedupeStore: options.dedupeStore
    })
  );
}

test("purchase identity: both order topics for one order produce the same event_id", async () => {
  const paid = await deliverPurchase({
    topic: "orders/paid",
    webhookId: "wh_paid",
    dedupeStore: memoryDedupeStore()
  });
  const created = await deliverPurchase({
    topic: "orders/create",
    webhookId: "wh_created",
    dedupeStore: memoryDedupeStore()
  });

  assert.equal(paid.result.body.event_id, created.result.body.event_id);
  assert.equal(paid.result.body.idempotency_key, created.result.body.idempotency_key);
  assert.equal(paid.result.body.idempotency_key, `purchase:${PROD_SHOP}:4004004004`);
  assert.equal(paid.result.body.order_key_source, "id");
});

test("purchase identity: event_id ignores the per-delivery webhook id", async () => {
  const first = await deliverPurchase({
    topic: "orders/paid",
    webhookId: "wh_delivery_1",
    dedupeStore: memoryDedupeStore()
  });
  const second = await deliverPurchase({
    topic: "orders/paid",
    webhookId: "wh_delivery_2",
    dedupeStore: memoryDedupeStore()
  });

  assert.equal(first.result.body.event_id, second.result.body.event_id);
  assert.notEqual(first.result.body.event_id, "wh_delivery_1");
});

test("canonical topic: only orders/paid forwards; orders/create is accepted without forwarding", async () => {
  const store = memoryDedupeStore();

  const created = await deliverPurchase({
    topic: "orders/create",
    webhookId: "wh_created",
    dedupeStore: store
  });
  assert.equal(created.result.ok, true);
  assert.equal(created.result.status, 200);
  assert.equal(created.result.body.status, "non_canonical_topic_no_forward");
  assert.equal(created.result.body.canonical_topic, "orders/paid");
  assert.deepEqual(created.requestedUrls, []);
  assert.deepEqual(store.keys(), []);

  const paid = await deliverPurchase({
    topic: "orders/paid",
    webhookId: "wh_paid",
    dedupeStore: store
  });
  assert.equal(paid.result.body.status, "forwarded");
  assert.deepEqual(paid.requestedUrls, [PROD_COLLECT]);
});

test("canonical topic is configurable: PURCHASE_CANONICAL_TOPIC flips which topic forwards", async () => {
  const env = { PURCHASE_CANONICAL_TOPIC: "orders/create" };

  const created = await deliverPurchase({
    topic: "orders/create",
    webhookId: "wh_created",
    dedupeStore: memoryDedupeStore(),
    env
  });
  assert.equal(created.result.body.status, "forwarded");
  assert.deepEqual(created.requestedUrls, [PROD_COLLECT]);

  const paid = await deliverPurchase({
    topic: "orders/paid",
    webhookId: "wh_paid",
    dedupeStore: memoryDedupeStore(),
    env
  });
  assert.equal(paid.result.body.status, "non_canonical_topic_no_forward");
  assert.deepEqual(paid.requestedUrls, []);
});

test("idempotency: a duplicate delivery of the canonical topic forwards only once", async () => {
  const store = memoryDedupeStore();

  const first = await deliverPurchase({ topic: "orders/paid", webhookId: "wh_1", dedupeStore: store });
  const second = await deliverPurchase({ topic: "orders/paid", webhookId: "wh_1", dedupeStore: store });

  assert.equal(first.result.body.status, "forwarded");
  assert.deepEqual(first.requestedUrls, [PROD_COLLECT]);

  assert.equal(second.result.ok, true);
  assert.equal(second.result.status, 200);
  assert.equal(second.result.body.status, "duplicate_purchase_no_forward");
  assert.deepEqual(second.requestedUrls, []);
  assert.equal(store.keys().length, 1);
});

test("idempotency: a Shopify retry with a different webhook id still dedupes", async () => {
  const store = memoryDedupeStore();

  const first = await deliverPurchase({ topic: "orders/paid", webhookId: "wh_a", dedupeStore: store });
  const retry = await deliverPurchase({ topic: "orders/paid", webhookId: "wh_b", dedupeStore: store });

  assert.deepEqual(first.requestedUrls, [PROD_COLLECT]);
  assert.equal(retry.result.body.status, "duplicate_purchase_no_forward");
  assert.deepEqual(retry.requestedUrls, []);
  assert.equal(
    (retry.result.body.dedupe as { first_seen_topic?: string }).first_seen_topic,
    "orders/paid"
  );
});

test("idempotency: distinct orders each forward once", async () => {
  const store = memoryDedupeStore();

  const first = await deliverPurchase({ topic: "orders/paid", webhookId: "wh_1", dedupeStore: store });
  const other = await deliverPurchase({
    topic: "orders/paid",
    webhookId: "wh_2",
    dedupeStore: store,
    order: { id: 4004004005, name: "#4005", order_number: 4005 }
  });

  assert.deepEqual(first.requestedUrls, [PROD_COLLECT]);
  assert.deepEqual(other.requestedUrls, [PROD_COLLECT]);
  assert.deepEqual(store.keys().sort(), [
    `purchase:${PROD_SHOP}:4004004004`,
    `purchase:${PROD_SHOP}:4004004005`
  ]);
});

test("dedupe failures fail closed: an unbound store refuses the forward with 503", async () => {
  const { result, requestedUrls } = await deliverPurchase({
    topic: "orders/paid",
    webhookId: "wh_no_store"
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.equal(result.body.status, "dedupe_unavailable_no_forward");
  assert.equal((result.body.dedupe as { error?: string }).error, "dedupe_store_not_bound");
  assert.deepEqual(requestedUrls, []);
});

test("dedupe failures fail closed: a KV error refuses the forward and surfaces the cause", async () => {
  const brokenStore: PurchaseDedupeStore = {
    async get() {
      throw new Error("kv unavailable");
    },
    async put() {
      // not reached
    },
    async delete() {
      // not reached
    }
  };

  const { result, requestedUrls } = await deliverPurchase({
    topic: "orders/paid",
    webhookId: "wh_broken",
    dedupeStore: brokenStore
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.equal(result.body.status, "dedupe_error_no_forward");
  assert.equal((result.body.dedupe as { error?: string }).error, "kv unavailable");
  assert.deepEqual(requestedUrls, []);
});

test("a failed forward releases the claim so the Shopify retry can forward", async () => {
  const store = memoryDedupeStore();
  const { rawBody, hmacHeader } = signedOrder();

  const originalFetch = globalThis.fetch;
  const failedUrls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    failedUrls.push(typeof input === "string" ? input : String(input));
    return new Response("upstream down", { status: 502 });
  }) as typeof globalThis.fetch;

  let failure;
  try {
    failure = await processPurchaseWebhookEdge({
      env: ISOLATION_ENV,
      rawBody,
      hmacHeader,
      shop: PROD_SHOP,
      topic: "orders/paid",
      webhookId: "wh_fail",
      dedupeStore: store
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(failure.body.status, "forward_failed");
  assert.deepEqual(failedUrls, [PROD_COLLECT]);
  assert.equal((failure.body.dedupe as { released?: boolean }).released, true);
  assert.deepEqual(store.keys(), []);

  const retry = await deliverPurchase({ topic: "orders/paid", webhookId: "wh_retry", dedupeStore: store });
  assert.equal(retry.result.body.status, "forwarded");
  assert.deepEqual(retry.requestedUrls, [PROD_COLLECT]);
});

test("an order without any stable identity is accepted but never forwarded", async () => {
  const { result, requestedUrls } = await deliverPurchase({
    topic: "orders/paid",
    webhookId: "wh_no_identity",
    dedupeStore: memoryDedupeStore(),
    order: { id: undefined, name: undefined, order_number: undefined }
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.equal(result.body.status, "missing_order_identity_no_forward");
  assert.deepEqual(requestedUrls, []);
});

test("per-shop isolation: the dev shop never forwards on either order topic", async () => {
  const store = memoryDedupeStore();
  for (const topic of ["orders/paid", "orders/create"]) {
    const { result, requestedUrls } = await deliverPurchase({
      topic,
      webhookId: `wh_dev_${topic}`,
      dedupeStore: store,
      shop: DEV_SHOP
    });

    assert.equal(result.body.runtime_mode, "shadow", topic);
    assert.ok(
      ["shadow_captured_no_forward", "non_canonical_topic_no_forward"].includes(
        String(result.body.status)
      ),
      String(result.body.status)
    );
    assert.deepEqual(requestedUrls, [], topic);
  }
  assert.deepEqual(store.keys(), []);
});
