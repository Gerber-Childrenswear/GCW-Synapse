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
  assert.equal(addToCart.category, "Onesies");
});

test("resolveProductViewDetailsArray returns canonical product view array", () => {
  const details = resolveProductViewDetailsArray(sampleLineItems);

  assert.equal(details.length, 1);
  assert.equal(details[0]?.item_variant, "Blue / M");
});
