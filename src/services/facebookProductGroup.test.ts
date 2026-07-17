import test from "node:test";
import assert from "node:assert/strict";
import { resolveFacebookProductGroup } from "./facebookProductGroup";

test("resolveFacebookProductGroup defaults content_type to product_group", () => {
  const resolved = resolveFacebookProductGroup({});
  assert.equal(resolved.content_type, "product_group");
  assert.equal(resolved.item_group_id, undefined);
});

test("resolveFacebookProductGroup surfaces product_id as item_group_id", () => {
  const resolved = resolveFacebookProductGroup({ productId: 12345 });
  assert.equal(resolved.content_type, "product_group");
  assert.equal(resolved.item_group_id, "12345");
});

test("resolveFacebookProductGroup accepts content_type override", () => {
  const resolved = resolveFacebookProductGroup({
    contentType: " product ",
    productId: " 99 "
  });
  assert.equal(resolved.content_type, "product");
  assert.equal(resolved.item_group_id, "99");
});
