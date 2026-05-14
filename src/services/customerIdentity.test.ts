import test from "node:test";
import assert from "node:assert/strict";
import { resolveCustomerEmail, resolveCustomerId } from "./customerIdentity";

test("resolveCustomerId prefers numeric customer id", () => {
  const resolved = resolveCustomerId({ customerId: 12345 }, "guest");
  assert.equal(resolved, "12345");
});

test("resolveCustomerId falls back to default when customer id is missing", () => {
  const resolved = resolveCustomerId({}, "guest");
  assert.equal(resolved, "guest");
});

test("resolveCustomerEmail prefers customer email and normalizes casing", () => {
  const resolved = resolveCustomerEmail({
    customerEmail: " Customer@Example.com ",
    checkoutEmail: "checkout@example.com"
  });

  assert.equal(resolved, "customer@example.com");
});

test("resolveCustomerEmail falls back to checkout email", () => {
  const resolved = resolveCustomerEmail({ checkoutEmail: "checkout@example.com" });
  assert.equal(resolved, "checkout@example.com");
});
