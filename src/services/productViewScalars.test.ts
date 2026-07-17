import test from "node:test";
import assert from "node:assert/strict";
import { resolveProductViewName, resolveProductViewPrice } from "./productViewScalars";

test("resolveProductViewPrice prefers price then ecommercePrice", () => {
  assert.equal(resolveProductViewPrice({ price: "19.99", ecommercePrice: "9.99" }), 19.99);
  assert.equal(resolveProductViewPrice({ ecommercePrice: 12 }), 12);
  assert.equal(resolveProductViewPrice({}), 0);
});

test("resolveProductViewName prefers name then title then productTitle", () => {
  assert.equal(
    resolveProductViewName({
      name: " Onesie ",
      title: "Title",
      productTitle: "Product"
    }),
    "Onesie"
  );
  assert.equal(resolveProductViewName({ title: " Title " }), "Title");
  assert.equal(resolveProductViewName({ productTitle: " Product " }), "Product");
  assert.equal(resolveProductViewName({}), "");
});
