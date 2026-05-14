import test from "node:test";
import assert from "node:assert/strict";
import { resolveEventId } from "./eventId";

test("resolveEventId prefers provided incoming event_id", () => {
  const eventId = resolveEventId({
    incomingEventId: "event-123",
    webhookId: "webhook-456",
    shop: "store.myshopify.com",
    topic: "orders/create",
    orderNumber: 1001,
    orderName: "#1001"
  });

  assert.equal(eventId, "event-123");
});

test("resolveEventId falls back to webhook id when event_id is missing", () => {
  const eventId = resolveEventId({
    webhookId: "webhook-456"
  });

  assert.equal(eventId, "webhook-456");
});

test("resolveEventId builds deterministic hash fallback", () => {
  const one = resolveEventId({
    shop: "store.myshopify.com",
    topic: "orders/paid",
    orderNumber: 1002,
    orderName: "#1002"
  });

  const two = resolveEventId({
    shop: "store.myshopify.com",
    topic: "orders/paid",
    orderNumber: 1002,
    orderName: "#1002"
  });

  assert.equal(one.length, 32);
  assert.equal(one, two);
});
