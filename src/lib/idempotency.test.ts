import test from "node:test";
import assert from "node:assert/strict";
import { IdempotencyStore } from "./idempotency";

test("IdempotencyStore tracks duplicate keys within TTL", async () => {
  const store = new IdempotencyStore(250);
  const key = "webhook-1";

  assert.equal(store.isDuplicate(key), false);
  store.markProcessed(key);
  assert.equal(store.isDuplicate(key), true);

  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(store.isDuplicate(key), false);
});
