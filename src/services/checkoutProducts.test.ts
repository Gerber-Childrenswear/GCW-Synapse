import test from "node:test";
import assert from "node:assert/strict";
import { resolveCheckoutProducts } from "./checkoutProducts";

test("resolveCheckoutProducts returns canonical checkout item array", () => {
  const products = resolveCheckoutProducts([
    {
      sku: "SKU-123",
      product_id: 100,
      title: "Footie",
      price: "25.00",
      quantity: 1
    }
  ]);

  assert.equal(products.length, 1);
  assert.equal(products[0]?.item_id, "SKU-123");
  assert.equal(products[0]?.item_name, "Footie");
  assert.equal(products[0]?.quantity, 1);
  assert.equal(products[0]?.price, 25);
});
