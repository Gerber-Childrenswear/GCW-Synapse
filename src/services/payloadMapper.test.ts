import test from "node:test";
import assert from "node:assert/strict";
import { mapOrderToPurchase } from "./payloadMapper";

test("mapOrderToPurchase maps core purchase fields", () => {
  const payload = mapOrderToPurchase({
    order_number: 12345,
    email: "customer@example.com",
    phone: "+12125550100",
    currency: "USD",
    total_price: "99.95",
    total_tax: "8.00",
    total_shipping_price_set: { shop_money: { amount: "5.00" } },
    customer: {
      id: 999,
      first_name: "Jane",
      last_name: "Doe"
    },
    billing_address: {
      city: "Fremont",
      province_code: "CA",
      zip: "94536",
      country_code: "US"
    },
    line_items: [
      {
        sku: "SKU-123",
        title: "Footie",
        price: "49.98",
        quantity: 2
      }
    ]
  });

  assert.equal(payload.event_name, "purchase");
  assert.equal(payload.transaction_id, "12345");
  assert.equal(payload.value, 99.95);
  assert.equal(payload.currency, "USD");
  assert.equal(payload.items.length, 1);
  assert.equal(payload.items[0]?.item_id, "SKU-123");
  assert.equal(payload.items[0]?.quantity, 2);
  assert.equal(payload.user_data.address.country, "US");
});

test("mapOrderToPurchase normalizes currency code", () => {
  const payload = mapOrderToPurchase({
    order_number: 999,
    currency: "usd",
    total_price: "10.00",
    line_items: []
  });

  assert.equal(payload.currency, "USD");
});

test("mapOrderToPurchase includes event_id when provided", () => {
  const payload = mapOrderToPurchase(
    {
      order_number: 999,
      currency: "USD",
      total_price: "10.00",
      line_items: []
    },
    "USD",
    "evt-12345"
  );

  assert.equal(payload.event_id, "evt-12345");
});

test("mapOrderToPurchase resolves customer identity with fallback", () => {
  const payload = mapOrderToPurchase(
    {
      order_number: 888,
      email: "Checkout@Example.com",
      currency: "USD",
      total_price: "10.00",
      line_items: []
    },
    "USD",
    undefined,
    "guest"
  );

  assert.equal(payload.client_id, "guest");
  assert.equal(payload.user_id, "checkout@example.com");
  assert.equal(payload.user_data.email_address, "checkout@example.com");
});
