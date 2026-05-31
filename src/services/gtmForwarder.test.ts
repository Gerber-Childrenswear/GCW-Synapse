import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

async function importForwarder() {
  process.env.GTM_SERVER_URL = "https://example.com/g/collect";
  process.env.SHOPIFY_WEBHOOK_SECRET = "test-secret";
  return import("./gtmForwarder");
}

test("createForwardHeaders returns base headers without shared secret", async () => {
  const { createForwardHeaders } = await importForwarder();
  const payload = {
    event_name: "purchase",
    event_id: "evt_123",
    transaction_id: "1001"
  };

  const payloadJson = JSON.stringify(payload);
  const headers = createForwardHeaders(payloadJson, payload);

  assert.equal(headers["Content-Type"], "application/json");
  assert.equal(headers["X-Synapse-Event-Name"], "purchase");
  assert.equal(headers["X-Synapse-Event-Id"], "evt_123");
  assert.equal(headers["X-Synapse-Transaction-Id"], "1001");
  assert.equal(headers["X-Synapse-Timestamp"], undefined);
  assert.equal(headers["X-Synapse-Signature"], undefined);
});

test("createForwardHeaders adds deterministic HMAC signature when shared secret is set", async () => {
  const { createForwardHeaders } = await importForwarder();
  const payload = {
    event_name: "refund",
    event_id: "evt_999",
    transaction_id: "1002",
    value: 12.34
  };
  const payloadJson = JSON.stringify(payload);
  const sharedSecret = "test_shared_secret_123456789";
  const timestamp = 1735689600;

  const headers = createForwardHeaders(payloadJson, payload, sharedSecret, timestamp);

  const expectedDigest = crypto
    .createHmac("sha256", sharedSecret)
    .update(`${timestamp}.${payloadJson}`)
    .digest("hex");

  assert.equal(headers["X-Synapse-Timestamp"], String(timestamp));
  assert.equal(headers["X-Synapse-Signature"], `v1=${expectedDigest}`);
});
