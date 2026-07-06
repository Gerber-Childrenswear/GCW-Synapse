import test from "node:test";
import assert from "node:assert/strict";
import { buildSampleEvent, loadLeanConfig, resolveLeanTarget } from "./leanVerify";

test("loadLeanConfig defaults to dev environment", () => {
  const config = loadLeanConfig();
  assert.equal(config.defaultEnvironment, "dev");
  assert.ok(config.environments.dev);
  assert.equal(config.environments.dev.shopifyShop, "gcw-dev.myshopify.com");
});

test("resolveLeanTarget uses gcw-dev origin for dev profile", () => {
  const config = loadLeanConfig();
  const target = resolveLeanTarget(config, { environment: "dev" });

  assert.equal(target.environment, "dev");
  assert.equal(target.origin, "https://gcw-dev.myshopify.com");
  assert.equal(target.shopifyShop, "gcw-dev.myshopify.com");
});

test("buildSampleEvent includes shop context for add_to_cart", () => {
  const payload = buildSampleEvent(
    "add_to_cart",
    "https://gcw-dev.myshopify.com",
    "gcw-dev.myshopify.com"
  ) as {
    shop?: string;
    product: { product_id?: string };
    cart: { total?: number };
  };

  assert.equal(payload.shop, "gcw-dev.myshopify.com");
  assert.equal(payload.product.product_id, "9001");
  assert.equal(payload.cart.total, 29.99);
});
