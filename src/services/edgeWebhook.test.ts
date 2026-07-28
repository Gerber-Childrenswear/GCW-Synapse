import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import {
  mapOrderToPurchaseEdge,
  processPurchaseWebhookEdge,
  resolveEdgeEventId,
  verifyShopifyWebhookHmacEdge
} from "./edgeWebhook";
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
