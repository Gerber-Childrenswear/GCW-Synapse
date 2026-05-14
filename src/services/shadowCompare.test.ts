import test from "node:test";
import assert from "node:assert/strict";
import {
  captureSynapseShadow,
  getShadowCompareSummary,
  getShadowParityReport,
  ingestElevarShadow
} from "./shadowCompare";

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

test("shadow parity report alerts when mismatch rate exceeds threshold", async () => {
  await captureSynapseShadow({
    client_id: "guest",
    event_name: "purchase",
    transaction_id: "1002",
    currency: "USD",
    value: 10,
    tax: 0,
    shipping: 0,
    items: [],
    user_data: { address: {} }
  });

  await ingestElevarShadow({
    event_name: "purchase",
    transaction_id: "1002",
    currency: "USD",
    value: 11,
    items: []
  });

  const report = getShadowParityReport(5);
  assert.equal(report.alert_triggered, true);
  assert.equal(report.status, "alert");
});
