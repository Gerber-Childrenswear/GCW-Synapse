import test from "node:test";
import assert from "node:assert/strict";
import { resolveProductIdentifier, toSynapseProduct } from "./product";

test("resolveProductIdentifier prefers sku then variant then product", () => {
  assert.equal(resolveProductIdentifier({ sku: "SKU-1", variantId: 9, productId: 1 }), "SKU-1");
  assert.equal(resolveProductIdentifier({ variantId: 9, productId: 1 }), "9");
  assert.equal(resolveProductIdentifier({ productId: 1 }), "1");
});

test("toSynapseProduct maps Elevar-shaped fields", () => {
  const product = toSynapseProduct({
    sku: "ABC",
    name: "Onesie",
    brand: "Gerber",
    category: "Apparel",
    variant: "0-3M",
    price: 12.5,
    quantity: 2,
    productId: 111,
    variantId: 222,
    compareAtPrice: 15,
    list: "/collections/baby"
  });

  assert.equal(product.id, "ABC");
  assert.equal(product.price, "12.50");
  assert.equal(product.quantity, "2");
  assert.equal(product.product_id, "111");
  assert.equal(product.variant_id, "222");
  assert.equal(product.list, "/collections/baby");
});
