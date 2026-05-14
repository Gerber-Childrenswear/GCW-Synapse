import test from "node:test";
import assert from "node:assert/strict";
import { captureSynapseShadow, getShadowCompareSummary, ingestElevarShadow } from "./shadowCompare";

test("shadow compare pairs matching events", async () => {
  await captureSynapseShadow({
    client_id: "guest",
    event_name: "purchase",
    transaction_id: "1001",
    currency: "USD",
    value: 10,
    tax: 0,
    shipping: 0,
    items: [],
    user_data: { address: {} }
  });

  await ingestElevarShadow({
    event_name: "purchase",
    transaction_id: "1001",
    currency: "USD",
    value: 10,
    items: []
  });

  const summary = getShadowCompareSummary();
  assert.equal(summary.counts.paired_events >= 1, true);
  assert.equal(summary.counts.matched_pairs >= 1, true);
});
