import test from "node:test";
import assert from "node:assert/strict";
import {
  describeShopRuntime,
  isAllowedGtmDestination,
  isNeverForwardShop,
  parseShopScopedConfig,
  resolveShopGtmServerUrl,
  resolveShopRuntimeMode
} from "./shopRuntime";

const SHOP_MODES = "gerberchildrenswear.myshopify.com=forward,gcw-dev.myshopify.com=shadow";
const PROD_COLLECT = "https://sgtm.example.com/g/collect";
const DEST_BY_SHOP = `gerberchildrenswear.myshopify.com=${PROD_COLLECT}`;

test("parseShopScopedConfig keeps '=' inside values so collect URLs survive", () => {
  const parsed = parseShopScopedConfig(
    "a.myshopify.com=https://sgtm.example.com/g/collect?id=G-123, b.myshopify.com=shadow"
  );

  assert.equal(parsed["a.myshopify.com"], "https://sgtm.example.com/g/collect?id=G-123");
  assert.equal(parsed["b.myshopify.com"], "shadow");
});

test("parseShopScopedConfig ignores blank and malformed entries", () => {
  const parsed = parseShopScopedConfig(", =forward, a.myshopify.com=, b.myshopify.com=forward");

  assert.deepEqual(Object.keys(parsed), ["b.myshopify.com"]);
});

test("known production shop resolves to forward with its own destination", () => {
  const env = {
    SHOP_RUNTIME_MODES: SHOP_MODES,
    GTM_SERVER_URL_BY_SHOP: DEST_BY_SHOP,
    RUNTIME_MODE: "forward"
  };

  assert.equal(resolveShopRuntimeMode("gerberchildrenswear.myshopify.com", env), "forward");
  assert.equal(resolveShopGtmServerUrl("gerberchildrenswear.myshopify.com", env), PROD_COLLECT);
});

test("known dev shop resolves to shadow and gets no destination", () => {
  const env = {
    SHOP_RUNTIME_MODES: SHOP_MODES,
    GTM_SERVER_URL_BY_SHOP: DEST_BY_SHOP,
    GTM_SERVER_URL: PROD_COLLECT,
    RUNTIME_MODE: "forward"
  };

  assert.equal(resolveShopRuntimeMode("gcw-dev.myshopify.com", env), "shadow");
  assert.equal(resolveShopGtmServerUrl("gcw-dev.myshopify.com", env), undefined);
});

test("missing or unknown shop resolves to shadow and cannot inherit the global collect URL", () => {
  const env = {
    SHOP_RUNTIME_MODES: SHOP_MODES,
    GTM_SERVER_URL: PROD_COLLECT,
    RUNTIME_MODE: "forward"
  };

  for (const shop of [undefined, "", "   ", "unknown-shop", "attacker.myshopify.com"]) {
    assert.equal(resolveShopRuntimeMode(shop, env), "shadow", String(shop));
    assert.equal(resolveShopGtmServerUrl(shop, env), undefined, String(shop));
  }
});

test("unmapped shop resolves to shadow even with no SHOP_RUNTIME_MODES configured at all", () => {
  const env = { GTM_SERVER_URL: PROD_COLLECT, RUNTIME_MODE: "forward" };

  assert.equal(resolveShopRuntimeMode("gerberchildrenswear.myshopify.com", env), "shadow");
  assert.equal(resolveShopGtmServerUrl("gerberchildrenswear.myshopify.com", env), undefined);
});

test("shop domain matching is case and whitespace insensitive", () => {
  const env = { SHOP_RUNTIME_MODES: SHOP_MODES, GTM_SERVER_URL_BY_SHOP: DEST_BY_SHOP };

  assert.equal(resolveShopRuntimeMode("  GerberChildrenswear.MyShopify.com ", env), "forward");
});

test("global RUNTIME_MODE=shadow_compare forces every mapped shop to shadow", () => {
  const env = {
    SHOP_RUNTIME_MODES: SHOP_MODES,
    GTM_SERVER_URL_BY_SHOP: DEST_BY_SHOP,
    RUNTIME_MODE: "shadow_compare"
  };

  assert.equal(resolveShopRuntimeMode("gerberchildrenswear.myshopify.com", env), "shadow");
  assert.equal(resolveShopGtmServerUrl("gerberchildrenswear.myshopify.com", env), undefined);
});

test("describeShopRuntime reports the resolved mode and whether a destination exists", () => {
  const env = { SHOP_RUNTIME_MODES: SHOP_MODES, GTM_SERVER_URL_BY_SHOP: DEST_BY_SHOP };

  assert.deepEqual(describeShopRuntime("gcw-dev.myshopify.com", env), {
    shop: "gcw-dev.myshopify.com",
    runtime_mode: "shadow",
    destination_configured: false,
    never_forward: true,
    valid_shop_domain: true
  });
  assert.deepEqual(describeShopRuntime(undefined, env), {
    shop: "unknown-shop",
    runtime_mode: "shadow",
    destination_configured: false,
    never_forward: false,
    valid_shop_domain: false
  });
});

test("hard denylist: gcw-dev never forwards even if SHOP_RUNTIME_MODES says forward", () => {
  const env = {
    SHOP_RUNTIME_MODES: "gcw-dev.myshopify.com=forward,gerberchildrenswear.myshopify.com=forward",
    GTM_SERVER_URL_BY_SHOP: `gcw-dev.myshopify.com=${PROD_COLLECT},${DEST_BY_SHOP}`,
    GTM_SERVER_URL: PROD_COLLECT,
    RUNTIME_MODE: "forward"
  };

  assert.equal(isNeverForwardShop("gcw-dev.myshopify.com"), true);
  assert.equal(resolveShopRuntimeMode("gcw-dev.myshopify.com", env), "shadow");
  assert.equal(resolveShopGtmServerUrl("gcw-dev.myshopify.com", env), undefined);
});

test("forward shops cannot inherit the legacy global GTM_SERVER_URL", () => {
  const env = {
    SHOP_RUNTIME_MODES: SHOP_MODES,
    GTM_SERVER_URL: PROD_COLLECT,
    RUNTIME_MODE: "forward"
  };

  assert.equal(resolveShopRuntimeMode("gerberchildrenswear.myshopify.com", env), "forward");
  assert.equal(resolveShopGtmServerUrl("gerberchildrenswear.myshopify.com", env), undefined);
});

test("invalid shop domains and non-https destinations never forward", () => {
  const env = {
    SHOP_RUNTIME_MODES: "not-a-shop=forward,evil.com=forward,gerberchildrenswear.myshopify.com=forward",
    GTM_SERVER_URL_BY_SHOP:
      "gerberchildrenswear.myshopify.com=http://insecure.example/g/collect,not-a-shop=https://x",
    RUNTIME_MODE: "forward"
  };

  assert.equal(resolveShopRuntimeMode("not-a-shop", env), "shadow");
  assert.equal(resolveShopRuntimeMode("evil.com", env), "shadow");
  assert.equal(resolveShopGtmServerUrl("gerberchildrenswear.myshopify.com", env), undefined);
  assert.equal(isAllowedGtmDestination("https://sgtm.example.com/g/collect"), true);
  assert.equal(isAllowedGtmDestination("http://sgtm.example.com/g/collect"), false);
  assert.equal(isAllowedGtmDestination("javascript:alert(1)"), false);
});
