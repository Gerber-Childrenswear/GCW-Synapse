import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import {
  compareObservations,
  observationFromPayload,
  verifyShopifyHmac
} from "./domain";

test("normalizes matching Synapse and Elevar payloads into a real pair", () => {
  const synapse = observationFromPayload("synapse", {
    event_name: "purchase",
    transaction_id: "1001",
    value: 29.99,
    currency: "usd",
    event_id: "evt-1",
    items: [{ item_id: "SKU-1", quantity: 1, price: 29.99 }]
  });
  const elevar = observationFromPayload("elevar", {
    event: "purchase",
    order_id: "1001",
    value: "29.99",
    currency: "USD",
    event_id: "evt-1",
    contents: [{ sku: "SKU-1", quantity: 1, price: "29.99" }]
  });

  assert.equal(synapse.compareKey, "purchase:1001");
  assert.equal(elevar.compareKey, "purchase:1001");
  assert.deepEqual(compareObservations(synapse, elevar), []);
});

test("reports field and item identifier mismatches", () => {
  const synapse = observationFromPayload("synapse", {
    event_name: "purchase",
    transaction_id: "1002",
    value: 40,
    currency: "USD",
    items: [{ item_id: "SKU-A", quantity: 1, price: 40 }]
  });
  const elevar = observationFromPayload("elevar", {
    event_name: "purchase",
    transaction_id: "1002",
    value: 39,
    currency: "CAD",
    items: [{ item_id: "SKU-B", quantity: 1, price: 39 }]
  });

  assert.deepEqual(
    compareObservations(synapse, elevar).map((diff) => diff.field),
    ["value", "currency", "item_identifiers"]
  );
});

test("redacts PII from persisted payload JSON", () => {
  const observation = observationFromPayload("synapse", {
    event_name: "purchase",
    transaction_id: "1003",
    email: "customer@example.com",
    user_data: {
      phone_number: "+15555550100",
      address: { city: "Atlanta" }
    }
  });

  assert.equal(observation.payloadJson.includes("customer@example.com"), false);
  assert.equal(observation.payloadJson.includes("+15555550100"), false);
  assert.equal(observation.payloadJson.includes("[REDACTED]"), true);
});

test("verifies Shopify HMAC using Web Crypto", async () => {
  const body = JSON.stringify({ id: 123, name: "#1001" });
  const secret = "dev-secret";
  const signature = createHmac("sha256", secret)
    .update(body)
    .digest("base64");

  assert.equal(await verifyShopifyHmac(body, signature, secret), true);
  assert.equal(await verifyShopifyHmac(body, signature, "wrong"), false);
  assert.equal(await verifyShopifyHmac(body, null, secret), false);
});
