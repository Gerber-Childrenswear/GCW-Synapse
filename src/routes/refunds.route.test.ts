import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";

test("/create rejects mismatched refunds topic", async () => {
  process.env.GTM_SERVER_URL = "https://example.com/g/collect";
  process.env.SHOPIFY_WEBHOOK_SECRET = "test-secret";
  process.env.ALLOWED_WEBHOOK_TOPICS = "orders/create,orders/paid,refunds/create";
  process.env.REFUNDS_WEBHOOK_PATH_PREFIX = "/webhooks/shopify/refunds";

  const { refundsRouter } = await import("./refunds");

  const app = express();
  app.use(
    "/webhooks/shopify/refunds",
    express.raw({ type: "application/json", limit: "1mb" }),
    refundsRouter
  );

  const payload = JSON.stringify({
    id: 1,
    order_id: 123,
    currency: "USD",
    refund_line_items: []
  });

  const response = await request(app)
    .post("/webhooks/shopify/refunds/create")
    .set("Content-Type", "application/json")
    .set("X-Shopify-Topic", "orders/create")
    .set("X-Shopify-Shop-Domain", "example.myshopify.com")
    .send(payload);

  assert.equal(response.status, 400);
  assert.equal(response.body.error, "Disallowed or mismatched webhook topic");
});
