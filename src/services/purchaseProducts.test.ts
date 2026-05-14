import test from "node:test";
import assert from "node:assert/strict";
import { resolvePurchaseProducts } from "./purchaseProducts";

test("resolvePurchaseProducts returns normalized purchase items", () => {
  const products = resolvePurchaseProducts([
    {
      sku: " SKU-123 ",
      product_id: 777,
      variant_id: 888,
      variant_title: " Blue / M ",
      product_type: " Onesies ",
      title: " Organic Footie ",
      price: "29.99",
      quantity: 2
    }
  ]);

  assert.equal(products.length, 1);
  assert.equal(products[0]?.item_id, "SKU-123");
  assert.equal(products[0]?.item_name, "Organic Footie");
  assert.equal(products[0]?.item_variant, "Blue / M");
  assert.equal(products[0]?.item_category, "Onesies");
  assert.equal(products[0]?.quantity, 2);
  assert.equal(products[0]?.price, 29.99);
  assert.equal(products[0]?.product_id, "777");
});

test("resolvePurchaseProducts falls back item_id and handles empty values", () => {
  const products = resolvePurchaseProducts([
    {
      product_id: 111,
      variant_id: 222,
      title: "",
      price: "bad-number",
      quantity: Number.NaN
    }
  ]);

  assert.equal(products[0]?.item_id, "222");
  assert.equal(products[0]?.item_name, "unknown-item");
  assert.equal(products[0]?.price, 0);
  assert.equal(products[0]?.quantity, 0);
});
