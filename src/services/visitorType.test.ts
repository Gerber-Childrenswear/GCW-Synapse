import test from "node:test";
import assert from "node:assert/strict";
import { resolveVisitorType } from "./visitorType";

test("resolveVisitorType returns Logged In when id exists", () => {
  assert.equal(resolveVisitorType({ customerId: "123" }), "Logged In");
});

test("resolveVisitorType returns Logged In when email exists", () => {
  assert.equal(resolveVisitorType({ customerEmail: "a@b.com" }), "Logged In");
});

test("resolveVisitorType returns Guest when no identity exists", () => {
  assert.equal(resolveVisitorType({}), "Guest");
});
