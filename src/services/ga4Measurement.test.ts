import test from "node:test";
import assert from "node:assert/strict";
import { parseGa4Overrides, resolveGa4MeasurementId } from "./ga4Measurement";

test("parseGa4Overrides parses valid shop to GA4 mappings", () => {
  const overrides = parseGa4Overrides("store-a.myshopify.com=G-AAAA1111, store-b.myshopify.com=G-BBBB2222");

  assert.equal(overrides["store-a.myshopify.com"], "G-AAAA1111");
  assert.equal(overrides["store-b.myshopify.com"], "G-BBBB2222");
});

test("resolveGa4MeasurementId prefers shop override over fallback", () => {
  const resolved = resolveGa4MeasurementId(
    "store-b.myshopify.com",
    "G-DEFAULT9999",
    "store-a.myshopify.com=G-AAAA1111, store-b.myshopify.com=G-BBBB2222"
  );

  assert.equal(resolved, "G-BBBB2222");
});

test("resolveGa4MeasurementId falls back to default when shop is unknown", () => {
  const resolved = resolveGa4MeasurementId(
    "unknown.myshopify.com",
    "G-DEFAULT9999",
    "store-a.myshopify.com=G-AAAA1111"
  );

  assert.equal(resolved, "G-DEFAULT9999");
});
