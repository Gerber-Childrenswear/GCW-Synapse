import test from "node:test";
import assert from "node:assert/strict";
import {
  getBrowserParityReport,
  ingestBrowserEvent,
  resetBrowserEventsForTests
} from "./browserEvents";

test("browser parity scores matching core funnel events", () => {
  resetBrowserEventsForTests();

  ingestBrowserEvent({
    source: "synapse",
    shop: "gcw-dev.myshopify.com",
    event: "dl_view_item",
    event_id: "abc",
    ecommerce: { detail: { products: [{ id: "SKU-1", product_id: "1" }] } }
  });
  ingestBrowserEvent({
    source: "elevar",
    shop: "gcw-dev.myshopify.com",
    event: "dl_view_item",
    event_id: "abc",
    ecommerce: { detail: { products: [{ id: "SKU-1", product_id: "1" }] } }
  });

  const report = getBrowserParityReport(5);
  assert.equal(report.status, "ok");
  assert.ok(report.paired_events >= 1);
});

test("browser parity alerts when volumes diverge", () => {
  resetBrowserEventsForTests();

  for (let i = 0; i < 10; i += 1) {
    ingestBrowserEvent({
      source: "elevar",
      shop: "gcw-dev.myshopify.com",
      event: "dl_add_to_cart",
      event_id: `el-${i}`,
      ecommerce: { add: { products: [{ id: `S-${i}` }] } }
    });
  }

  ingestBrowserEvent({
    source: "synapse",
    shop: "gcw-dev.myshopify.com",
    event: "dl_add_to_cart",
    event_id: "syn-only",
    ecommerce: { add: { products: [{ id: "S-0" }] } }
  });

  const report = getBrowserParityReport(5);
  assert.equal(report.alert_triggered, true);
  assert.equal(report.status, "alert");
});
