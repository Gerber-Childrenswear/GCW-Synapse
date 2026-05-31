import test from "node:test";
import assert from "node:assert/strict";
import { mapOrderToPurchase, mapRefundToRefundEvent } from "./payloadMapper";

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
        variant_title: "Blue / M",
        product_type: "Onesies",
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
  assert.equal(payload.items[0]?.item_variant, "Blue / M");
  assert.equal(payload.items[0]?.item_category, "Onesies");
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

test("mapOrderToPurchase falls back to order name for transaction_id", () => {
  const payload = mapOrderToPurchase({
    name: "#A1001",
    currency: "USD",
    total_price: "25.00",
    line_items: []
  });

  assert.equal(payload.transaction_id, "#A1001");
});

test("mapOrderToPurchase normalizes customer phone to E.164 style", () => {
  const payload = mapOrderToPurchase({
    order_number: 222,
    phone: "(212) 555-0100",
    currency: "USD",
    total_price: "1.00",
    line_items: []
  });

  assert.equal(payload.user_data.phone_number, "+12125550100");
});

test("mapRefundToRefundEvent maps core refund fields", () => {
  const payload = mapRefundToRefundEvent({
    id: 777,
    order_id: 12345,
    currency: "USD",
    customer: {
      id: 999,
      email: "customer@example.com",
      first_name: "Jane",
      last_name: "Doe"
    },
    billing_address: {
      city: "Fremont",
      province_code: "CA",
      zip: "94536",
      country_code: "US"
    },
    refund_line_items: [
      {
        quantity: 1,
        total_tax: "0.80",
        line_item: {
          sku: "SKU-REF-123",
          variant_title: "Blue / M",
          product_type: "Onesies",
          title: "Footie",
          price: "9.99",
          quantity: 2
        }
      }
    ],
    transactions: [
      {
        kind: "refund",
        status: "success",
        amount: "10.79"
      }
    ]
  });

  assert.equal(payload.event_name, "refund");
  assert.equal(payload.transaction_id, "12345");
  assert.equal(payload.value, 10.79);
  assert.equal(payload.currency, "USD");
  assert.equal(payload.items.length, 1);
  assert.equal(payload.items[0]?.item_id, "SKU-REF-123");
  assert.equal(payload.items[0]?.quantity, 1);
  assert.equal(payload.tax, 0.8);
});

test("mapRefundToRefundEvent falls back to refunded line items when transactions missing", () => {
  const payload = mapRefundToRefundEvent({
    order_name: "#A1001",
    currency: "usd",
    refund_line_items: [
      {
        quantity: 2,
        line_item: {
          title: "Sleeper",
          price: "5.00",
          quantity: 2
        }
      }
    ]
  });

  assert.equal(payload.transaction_id, "#A1001");
  assert.equal(payload.value, 10);
  assert.equal(payload.currency, "USD");
});
