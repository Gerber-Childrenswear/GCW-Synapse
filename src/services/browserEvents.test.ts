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
  assert.equal(report.volume_match_pct, 100);
  assert.ok(report.fuzzy_paired >= 1);
});

test("browser parity fuzzy-pairs divergent event_ids with same product", () => {
  resetBrowserEventsForTests();
  const now = new Date().toISOString();

  ingestBrowserEvent({
    source: "synapse",
    shop: "gcw-dev.myshopify.com",
    event: "dl_add_to_cart",
    event_id: "syn-123",
    observed_at: now,
    ecommerce: { add: { products: [{ id: "SKU-9", product_id: "9" }] } }
  });
  ingestBrowserEvent({
    source: "elevar",
    shop: "gcw-dev.myshopify.com",
    event: "dl_add_to_cart",
    event_id: "elv-999",
    observed_at: now,
    ecommerce: { add: { products: [{ id: "SKU-9", product_id: "9" }] } }
  });

  const report = getBrowserParityReport(5);
  assert.equal(report.status, "ok");
  assert.equal(report.volume_match_pct, 100);
  assert.equal(report.fuzzy_paired, 1);
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
