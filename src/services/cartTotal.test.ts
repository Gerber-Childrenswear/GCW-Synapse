import test from "node:test";
import assert from "node:assert/strict";
import { resolveCartTotal } from "./cartTotal";

test("resolveCartTotal prefers ecommerce value", () => {
  const total = resolveCartTotal({ ecommerceValue: "19.95", checkoutTotalPrice: "29.95" });
  assert.equal(total, 19.95);
});

test("resolveCartTotal falls back in order", () => {
  const checkoutFallback = resolveCartTotal({ checkoutTotalPrice: "29.95" });
  const subtotalFallback = resolveCartTotal({ subtotalPrice: "9.99" });
  const defaultFallback = resolveCartTotal({});

  assert.equal(checkoutFallback, 29.95);
  assert.equal(subtotalFallback, 9.99);
  assert.equal(defaultFallback, 0);
});
