import test from "node:test";
import assert from "node:assert/strict";
import { resolveThankYouActionField } from "./thankYouActionField";

test("resolveThankYouActionField builds id revenue currency object", () => {
  const resolved = resolveThankYouActionField({
    orderNumber: 1001,
    ecommerceValue: "49.99",
    currency: "usd",
    tax: "4.00",
    shipping: "5.50"
  });

  assert.deepEqual(resolved, {
    id: "1001",
    revenue: 49.99,
    currency: "USD",
    tax: 4,
    shipping: 5.5
  });
});

test("resolveThankYouActionField falls back for missing revenue and order id", () => {
  const resolved = resolveThankYouActionField({
    orderName: "#1002"
  });

  assert.equal(resolved.id, "#1002");
  assert.equal(resolved.revenue, 0);
  assert.equal(resolved.currency, undefined);
});
