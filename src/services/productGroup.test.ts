import test from "node:test";
import assert from "node:assert/strict";
import { resolveProductGroup } from "./productGroup";

test("product group resolver uses product_type when available", () => {
  const result = resolveProductGroup([
    {
      title: "Classic Onesie",
      price: "19.99",
      quantity: 1,
      product_type: "Apparel"
    }
  ]);

  assert.equal(result.productGroup, "Apparel");
  assert.equal(result.source, "product_type");
});

test("product group resolver falls back to title then default", () => {
  const fromTitle = resolveProductGroup([
    {
      title: "Cozy Hat",
      price: "14.99",
      quantity: 1,
      product_type: ""
    }
  ]);

  const fallback = resolveProductGroup([]);

  assert.equal(fromTitle.productGroup, "Cozy Hat");
  assert.equal(fromTitle.source, "title");
  assert.equal(fallback.productGroup, "unknown-group");
  assert.equal(fallback.source, "fallback");
});
