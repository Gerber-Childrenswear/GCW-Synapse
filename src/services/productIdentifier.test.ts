import test from "node:test";
import assert from "node:assert/strict";
import { resolveProductIdentifier } from "./productIdentifier";

test("resolveProductIdentifier prefers sku", () => {
  const resolved = resolveProductIdentifier({
    sku: " SKU-123 ",
    variantId: 456,
    productId: 789
  });

  assert.equal(resolved, "SKU-123");
});

test("resolveProductIdentifier falls back to variant id", () => {
  const resolved = resolveProductIdentifier({
    variantId: 456,
    productId: 789
  });

  assert.equal(resolved, "456");
});

test("resolveProductIdentifier falls back to product id", () => {
  const resolved = resolveProductIdentifier({
    productId: " 789 "
  });

  assert.equal(resolved, "789");
});
