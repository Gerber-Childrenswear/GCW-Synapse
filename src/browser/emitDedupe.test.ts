import test from "node:test";
import assert from "node:assert/strict";
import { resetEmitDedupeForTests, shouldEmitOnce } from "./emitDedupe";

test("emit dedupe suppresses rapid duplicates", () => {
  resetEmitDedupeForTests();
  assert.equal(shouldEmitOnce("atc:sku-1", 1000), true);
  assert.equal(shouldEmitOnce("atc:sku-1", 1000), false);
  assert.equal(shouldEmitOnce("atc:sku-2", 1000), true);
});
