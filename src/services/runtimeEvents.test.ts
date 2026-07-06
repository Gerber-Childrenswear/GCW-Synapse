import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isRuntimeDuplicate, parseRuntimeEvent } from "./runtimeEvents";

const payload = {
  event_name: "page_view",
  event_id: "evt_123456",
  source: "theme",
  customer: {
    id: "1",
    email: "test@example.com"
  },
  product: {},
  collection: {},
  cart: {},
  checkout: {},
  marketing: {},
  session: {
    id: "session_1",
    page_url: "https://www.gerberchildrenswear.com/products/sku-1"
  },
  consent: {
    analytics_storage: "granted",
    ad_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "granted"
  }
};

describe("runtimeEvents", () => {
  it("parses valid runtime payload", () => {
    const event = parseRuntimeEvent(payload);
    assert.equal(event.event_name, "page_view");
    assert.equal(event.source, "theme");
  });

  it("parses enriched runtime payload fields", () => {
    const enrichedPayload = {
      ...payload,
      source_theme: "expanse",
      source_surface: "web",
      product: {
        product_id: "7000001",
        variant_id: "43000001",
        sku: "GCW-TEST-001",
        name: "Test Product",
        category: "Sleepwear",
        brand: "Gerber",
        product_type: "Onesie",
        variant_title: "Blue / 6M",
        item_list_name: "homepage_featured",
        price: 19.99,
        quantity: 1
      },
      cart: {
        cart_id: "cart_123",
        total: 39.98,
        subtotal: 35.98,
        discount_total: 4,
        currency: "USD",
        item_count: 2,
        items: [
          {
            product_id: "7000001",
            variant_id: "43000001",
            sku: "GCW-TEST-001",
            name: "Test Product",
            category: "Sleepwear",
            brand: "Gerber",
            product_type: "Onesie",
            variant_title: "Blue / 6M",
            item_list_name: "homepage_featured",
            price: 19.99,
            quantity: 1
          }
        ]
      },
      checkout: {
        checkout_id: "checkout_123",
        order_id: "#1001",
        revenue: 39.98,
        shipping: 5,
        tax: 2.8,
        coupon: "SAVE10",
        currency: "USD",
        payment_type: "credit_card",
        shipping_tier: "standard"
      },
      marketing: {
        event_id: "evt_enriched_001",
        user_id: "1",
        source: "google",
        medium: "cpc",
        campaign: "spring_sale",
        term: "baby onesie",
        content: "ad-a",
        click_id: "gclid_abc123",
        fbp: "fb.1.12345",
        fbc: "fb.1.67890",
        destinations: ["ga4", "meta", "instagram", "reddit"]
      },
      session: {
        id: "session_1",
        page_url: "https://www.gerberchildrenswear.com/products/sku-1",
        page_path: "/products/sku-1",
        referrer: "https://www.google.com",
        timestamp: "2026-06-05T12:00:00.000Z",
        sequence: 2,
        locale: "en-US",
        user_agent: "Mozilla/5.0"
      }
    };

    const event = parseRuntimeEvent(enrichedPayload);
    assert.equal(event.source_theme, "expanse");
    assert.equal(event.source_surface, "web");
    assert.deepEqual(event.marketing.destinations, ["ga4", "meta", "instagram", "reddit"]);
    assert.equal(event.checkout.payment_type, "credit_card");
    assert.equal(event.cart.discount_total, 4);
  });

  it("parses server-origin runtime payload", () => {
    const serverPayload = {
      ...payload,
      source: "server",
      source_theme: "unknown",
      source_surface: "webhook"
    };

    const event = parseRuntimeEvent(serverPayload);
    assert.equal(event.source, "server");
    assert.equal(event.source_surface, "webhook");
  });

  it("parses user_data runtime payload", () => {
    const userDataPayload = {
      ...payload,
      event_name: "user_data",
      event_id: "evt_user_data_001",
      cart: {
        cart_id: "cart_abc",
        total: 59.98,
        currency: "USD",
        item_count: 2
      },
      marketing: {
        event_id: "evt_user_data_001",
        user_id: "1"
      }
    };

    const event = parseRuntimeEvent(userDataPayload);
    assert.equal(event.event_name, "user_data");
    assert.equal(event.cart.total, 59.98);
    assert.equal(event.marketing.user_id, "1");
  });

  it("detects duplicate event_id within dedupe window", () => {
    const first = parseRuntimeEvent(payload);
    const second = parseRuntimeEvent(payload);

    assert.equal(isRuntimeDuplicate(first), false);
    assert.equal(isRuntimeDuplicate(second), true);
  });
});
