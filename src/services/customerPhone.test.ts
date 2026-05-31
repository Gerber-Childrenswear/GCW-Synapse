import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCustomerPhone } from "./customerPhone";

test("normalizeCustomerPhone preserves international format", () => {
  assert.equal(normalizeCustomerPhone("+44 7700 900123"), "+447700900123");
});

test("normalizeCustomerPhone defaults US 10-digit to +1", () => {
  assert.equal(normalizeCustomerPhone("(212) 555-0100"), "+12125550100");
});

test("normalizeCustomerPhone handles empty input", () => {
  assert.equal(normalizeCustomerPhone("   "), undefined);
  assert.equal(normalizeCustomerPhone(undefined), undefined);
});
