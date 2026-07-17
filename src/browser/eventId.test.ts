import test from "node:test";
import assert from "node:assert/strict";
import { resolveBrowserEventId } from "./eventId";

test("resolveBrowserEventId is stable and 32 chars", () => {
  const a = resolveBrowserEventId(["shop", "dl_view_item", "/products/x", 1]);
  const b = resolveBrowserEventId(["shop", "dl_view_item", "/products/x", 1]);
  assert.equal(a, b);
  assert.equal(a.length, 32);
});
