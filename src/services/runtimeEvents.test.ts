import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isRuntimeDuplicate, parseRuntimeEvent } from "./runtimeEvents";

const payload = {
  event_name: "page_view",
  event_id: "evt_123456",
  source: "theme",
  customer: {
    id: "1",
    email: "test@example.com"
  },
  product: {},
  collection: {},
  cart: {},
  checkout: {},
  marketing: {},
  session: {
    id: "session_1",
    page_url: "https://www.gerberchildrenswear.com/products/sku-1"
  },
  consent: {
    analytics_storage: "granted",
    ad_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "granted"
  }
};

describe("runtimeEvents", () => {
  it("parses valid runtime payload", () => {
    const event = parseRuntimeEvent(payload);
    assert.equal(event.event_name, "page_view");
    assert.equal(event.source, "theme");
  });

  it("detects duplicate event_id within dedupe window", () => {
    const first = parseRuntimeEvent(payload);
    const second = parseRuntimeEvent(payload);

    assert.equal(isRuntimeDuplicate(first), false);
    assert.equal(isRuntimeDuplicate(second), true);
  });
});
