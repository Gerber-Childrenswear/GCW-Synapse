import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeContext } from "./logger";

test("sanitizeContext redacts sensitive keys recursively", () => {
  const input = {
    email: "user@example.com",
    transaction_id: "123",
    nested: {
      phoneNumber: "+12125550100",
      token: "abc123",
      safe: "ok"
    },
    items: [
      {
        external_id: "xyz",
        sku: "SKU-1"
      }
    ]
  };

  const out = sanitizeContext(input);
  assert.equal(out?.email, "[REDACTED]");
  assert.equal(out?.transaction_id, "123");

  const nested = out?.nested as { phoneNumber: string; token: string; safe: string };
  assert.equal(nested.phoneNumber, "[REDACTED]");
  assert.equal(nested.token, "[REDACTED]");
  assert.equal(nested.safe, "ok");

  const item = (out?.items as Array<{ external_id: string; sku: string }>)[0];
  assert.ok(item);
  assert.equal(item.external_id, "[REDACTED]");
  assert.equal(item.sku, "SKU-1");
});
