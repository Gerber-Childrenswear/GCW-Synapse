import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveAddToCartCompatibility,
  resolveEcommerceImpressions,
  resolveProductViewDetailsArray
} from "./catalogCompatibility";

const sampleLineItems = [
  {
    sku: "SKU-123",
    product_id: 101,
    variant_id: 202,
    variant_title: "Blue / M",
    product_type: "Onesies",
    title: "Footie",
    price: "25.00",
    quantity: 2
  }
];

test("resolveEcommerceImpressions maps items into canonical impression format", () => {
  const impressions = resolveEcommerceImpressions(sampleLineItems);

  assert.equal(impressions.length, 1);
  assert.equal(impressions[0]?.item_id, "SKU-123");
  assert.equal(impressions[0]?.item_name, "Footie");
});

test("resolveAddToCartCompatibility returns add array and scalar fields", () => {
  const addToCart = resolveAddToCartCompatibility(sampleLineItems);

  assert.equal(addToCart.add_array.length, 1);
  assert.equal(addToCart.quantity, 2);
  assert.equal(addToCart.price, 25);
  assert.equal(addToCart.value, 50);
  assert.equal(addToCart.category, "Onesies");
  assert.equal(addToCart.product_id, "101");
  assert.equal(addToCart.product_name, "Footie");
  assert.equal(addToCart.sku, "SKU-123");
  assert.equal(addToCart.variant_id, "Blue / M");
  assert.equal(addToCart.facebook_contents[0]?.id, "SKU-123");
  assert.equal(addToCart.facebook_contents[0]?.quantity, 2);
  assert.equal(addToCart.ga4_items.length, 1);
  assert.equal(addToCart.tiktok_contents[0]?.content_id, "SKU-123");
  assert.equal(addToCart.google_ads_shopify_ids[0], "101");
});

test("resolveProductViewDetailsArray returns canonical product view array", () => {
  const details = resolveProductViewDetailsArray(sampleLineItems);

  assert.equal(details.length, 1);
  assert.equal(details[0]?.item_variant, "Blue / M");
});
