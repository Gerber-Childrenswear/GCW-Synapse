import test from "node:test";
import assert from "node:assert/strict";
import { resolveOrderId } from "./orderId";

test("resolveOrderId prefers numeric order number", () => {
  const resolved = resolveOrderId({ orderNumber: 12345, orderName: "#12345" });
  assert.equal(resolved, "12345");
});

test("resolveOrderId falls back to transaction id", () => {
  const resolved = resolveOrderId({ transactionId: "txn-987", orderName: "#12345" });
  assert.equal(resolved, "txn-987");
});

test("resolveOrderId falls back to order name then unknown", () => {
  const named = resolveOrderId({ orderName: " #A1001 " });
  const unknown = resolveOrderId({});
  assert.equal(named, "#A1001");
  assert.equal(unknown, "unknown-order");
});
