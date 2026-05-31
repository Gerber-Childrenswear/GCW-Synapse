import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";

test("/create rejects mismatched orders/paid topic", async () => {
  process.env.GTM_SERVER_URL = "https://example.com/g/collect";
  process.env.SHOPIFY_WEBHOOK_SECRET = "test-secret";
  process.env.ALLOWED_WEBHOOK_TOPICS = "orders/create,orders/paid";
  process.env.WEBHOOK_PATH_PREFIX = "/webhooks/shopify/orders";

  const { webhooksRouter } = await import("./webhooks");

  const app = express();
  app.use(
    "/webhooks/shopify/orders",
    express.raw({ type: "application/json", limit: "1mb" }),
    webhooksRouter
  );

  const payload = JSON.stringify({
    order_number: 123,
    name: "#123",
    currency: "USD",
    total_price: "10.00",
    line_items: []
  });

  const response = await request(app)
    .post("/webhooks/shopify/orders/create")
    .set("Content-Type", "application/json")
    .set("X-Shopify-Topic", "orders/paid")
    .set("X-Shopify-Shop-Domain", "example.myshopify.com")
    .send(payload);

  assert.equal(response.status, 400);
  assert.equal(response.body.error, "Disallowed or mismatched webhook topic");
});
