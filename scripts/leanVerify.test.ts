import test from "node:test";
import assert from "node:assert/strict";
import { buildSampleEvent, loadLeanConfig } from "./leanVerify";

test("loadLeanConfig includes critical runtime events", () => {
  const config = loadLeanConfig();
  assert.ok(config.productionBaseUrl.includes("workers.dev"));
  assert.equal(config.criticalRuntimeEvents.includes("purchase"), true);
});

test("buildSampleEvent includes product context for add_to_cart", () => {
  const payload = buildSampleEvent("add_to_cart", "https://www.gerberchildrenswear.com") as {
    product: { product_id?: string };
    cart: { total?: number };
  };

  assert.equal(payload.product.product_id, "9001");
  assert.equal(payload.cart.total, 29.99);
});
