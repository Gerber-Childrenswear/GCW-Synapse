import test from "node:test";
import assert from "node:assert/strict";
import { resolveOrderRevenue } from "./orderRevenue";

test("resolveOrderRevenue prefers ecommerce value", () => {
  assert.equal(resolveOrderRevenue({ ecommerceValue: "79.95", totalPrice: "89.95" }), 79.95);
});

test("resolveOrderRevenue falls back to total price and zero", () => {
  assert.equal(resolveOrderRevenue({ totalPrice: "19.99" }), 19.99);
  assert.equal(resolveOrderRevenue({}), 0);
});
