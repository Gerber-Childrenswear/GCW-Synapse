import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { resetBrowserEventsForTests } from "../services/browserEvents";

test("POST /browser/beacon accepts dl_view_item with CORS", async () => {
  resetBrowserEventsForTests();
  const { browserBeaconRouter } = await import("./browserBeacon");
  const app = express();
  app.use(express.json());
  app.use("/browser", browserBeaconRouter);

  const res = await request(app)
    .post("/browser/beacon")
    .set("Origin", "https://gcw-dev.myshopify.com")
    .send({
      shop: "gcw-dev.myshopify.com",
      event: "dl_view_item",
      event_id: "test-1",
      currency: "USD",
      ecommerce: {
        currencyCode: "USD",
        detail: { products: [{ id: "SKU", product_id: "1", variant_id: "2" }] }
      }
    });

  assert.equal(res.status, 202);
  assert.equal(res.body.ok, true);
  assert.equal(res.headers["access-control-allow-origin"], "*");
});

test("POST /browser/beacon rejects unknown events", async () => {
  const { browserBeaconRouter } = await import("./browserBeacon");
  const app = express();
  app.use(express.json());
  app.use("/browser", browserBeaconRouter);

  const res = await request(app).post("/browser/beacon").send({
    shop: "gcw-dev.myshopify.com",
    event: "not_a_real_event"
  });
  assert.equal(res.status, 400);
});
