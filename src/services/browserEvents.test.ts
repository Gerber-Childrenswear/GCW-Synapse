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
  assert.equal(report.product_id_coverage_pct, 100);
});

test("browser parity fuzzy-pairs divergent event_ids with same product", () => {
  resetBrowserEventsForTests();
  const now = new Date().toISOString();

  ingestBrowserEvent({
    source: "synapse",
    shop: "gcw-dev.myshopify.com",
    event: "dl_add_to_cart",
    event_id: "syn-123",
    cart_total: "19.99",
    observed_at: now,
    ecommerce: { add: { products: [{ id: "SKU-9", product_id: "9" }] } }
  });
  ingestBrowserEvent({
    source: "elevar",
    shop: "gcw-dev.myshopify.com",
    event: "dl_add_to_cart",
    event_id: "elv-999",
    cart_total: "19.99",
    observed_at: now,
    ecommerce: { add: { products: [{ id: "SKU-9", product_id: "9" }] } }
  });

  const report = getBrowserParityReport(5);
  assert.equal(report.status, "ok");
  assert.equal(report.volume_match_pct, 100);
  assert.equal(report.fuzzy_paired, 1);
  assert.equal(report.cart_total_coverage_pct, 100);
});

test("browser parity reports cart_total coverage for Synapse funnel events", () => {
  resetBrowserEventsForTests();
  ingestBrowserEvent({
    source: "synapse",
    shop: "gcw-dev.myshopify.com",
    event: "dl_view_cart",
    event_id: "vc-1",
    cart_total: "12.00",
    ecommerce: { cart_contents: { products: [{ id: "A", product_id: "1" }] } }
  });
  ingestBrowserEvent({
    source: "synapse",
    shop: "gcw-dev.myshopify.com",
    event: "dl_add_to_cart",
    event_id: "atc-missing-total",
    ecommerce: { add: { products: [{ id: "B", product_id: "2" }] } }
  });
  const report = getBrowserParityReport(5);
  assert.equal(report.cart_total_coverage_pct, 50);
  assert.equal(report.product_id_coverage_pct, 100);
});

test("browser parity alerts when Synapse lags Elevar volume", () => {
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
  assert.equal(report.volume_match_pct, 10);
});

test("browser parity does not alert when Synapse exceeds Elevar", () => {
  resetBrowserEventsForTests();
  const now = new Date().toISOString();

  for (let i = 0; i < 3; i += 1) {
    ingestBrowserEvent({
      source: "elevar",
      shop: "gcw-dev.myshopify.com",
      event: "dl_view_item",
      event_id: `el-${i}`,
      observed_at: now,
      ecommerce: { detail: { products: [{ id: `S-${i}` }] } }
    });
  }
  for (let i = 0; i < 8; i += 1) {
    ingestBrowserEvent({
      source: "synapse",
      shop: "gcw-dev.myshopify.com",
      event: "dl_view_item",
      event_id: `syn-${i}`,
      observed_at: now,
      ecommerce: { detail: { products: [{ id: `S-${i}` }] } }
    });
  }

  const report = getBrowserParityReport(5);
  assert.equal(report.alert_triggered, false);
  assert.equal(report.status, "ok");
  assert.equal(report.volume_match_pct, 100);
});

test("launch parity excludes synthetic / demo_ / sim_ events", () => {
  resetBrowserEventsForTests();

  for (let i = 0; i < 5; i += 1) {
    ingestBrowserEvent({
      source: "synapse",
      shop: "gcw-dev.myshopify.com",
      event: "dl_view_item",
      event_id: `demo_syn_${i}`,
      synthetic: true
    });
    ingestBrowserEvent({
      source: "elevar",
      shop: "gcw-dev.myshopify.com",
      event: "dl_view_item",
      event_id: `demo_elv_${i}`,
      synthetic: true
    });
  }

  const all = getBrowserParityReport(5);
  assert.equal(all.synapse_events, 5);
  assert.equal(all.elevar_events, 5);

  const real = getBrowserParityReport(5, { excludeSynthetic: true });
  assert.equal(real.synapse_events, 0);
  assert.equal(real.elevar_events, 0);
  assert.equal(real.synthetic_excluded, 10);
});
