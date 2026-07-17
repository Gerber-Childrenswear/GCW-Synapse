import test from "node:test";
import assert from "node:assert/strict";
import { attachSessionMarketing, extractSessionMarketing } from "./sessionEnrichment";
import type { ShopifyOrder, SynapseEventPayload } from "../types/shopify";

test("extractSessionMarketing reads cart note attributes", () => {
  const order = {
    currency: "USD",
    total_price: "10.00",
    line_items: [],
    note_attributes: [
      { name: "synapse_session_id", value: "sid123" },
      { name: "synapse_landing_site", value: "https://example.com/?utm_source=meta" },
      { name: "synapse_utm_source", value: "meta" }
    ]
  } as ShopifyOrder;

  const marketing = extractSessionMarketing(order);
  assert.equal(marketing.session_id, "sid123");
  assert.equal(marketing.utm_source, "meta");
  assert.match(marketing.landing_site || "", /utm_source=meta/);
});

test("attachSessionMarketing adds marketing block to purchase payload", () => {
  const payload = {
    client_id: "guest",
    event_name: "purchase",
    currency: "USD",
    value: 10,
    tax: 0,
    shipping: 0,
    transaction_id: "1001",
    items: [],
    user_data: { address: {} }
  } as SynapseEventPayload;

  const enriched = attachSessionMarketing(payload, {
    session_id: "sid",
    landing_site: "https://example.com/",
    utm_source: "google"
  });

  assert.equal(enriched.marketing?.session_id, "sid");
  assert.equal(enriched.marketing?.utm_source, "google");
});
