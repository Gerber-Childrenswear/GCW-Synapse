import test from "node:test";
import assert from "node:assert/strict";

process.env.GTM_SERVER_URL ??= "https://gtm.example.com";
process.env.SHOPIFY_WEBHOOK_SECRET ??= "test_webhook_secret";

type EnvModule = typeof import("../config/env");
type ShopifyAuthModule = typeof import("./shopifyAuth");

type OAuthEnvSnapshot = {
  SHOPIFY_API_KEY: string | undefined;
  SHOPIFY_API_SECRET: string | undefined;
  SHOPIFY_APP_URL: string | undefined;
};

let moduleCache:
  | Promise<{
      env: EnvModule["env"];
      startShopifyInstall: ShopifyAuthModule["startShopifyInstall"];
      completeShopifyInstall: ShopifyAuthModule["completeShopifyInstall"];
    }>
  | undefined;

async function loadModules() {
  moduleCache ??= (async () => {
    const [{ env }, { completeShopifyInstall, startShopifyInstall }] = await Promise.all([
      import("../config/env"),
      import("./shopifyAuth")
    ]);

    return { env, startShopifyInstall, completeShopifyInstall };
  })();

  return moduleCache;
}

async function withOAuthEnv(overrides: Partial<OAuthEnvSnapshot>, run: () => Promise<void>): Promise<void> {
  const { env } = await loadModules();
  const snapshot: OAuthEnvSnapshot = {
    SHOPIFY_API_KEY: env.SHOPIFY_API_KEY,
    SHOPIFY_API_SECRET: env.SHOPIFY_API_SECRET,
    SHOPIFY_APP_URL: env.SHOPIFY_APP_URL
  };

  Object.assign(env as OAuthEnvSnapshot, overrides);

  try {
    await run();
  } finally {
    Object.assign(env as OAuthEnvSnapshot, snapshot);
  }
}

test("startShopifyInstall rejects invalid shop domain", async () => {
  await withOAuthEnv(
    {
      SHOPIFY_API_KEY: "test_key",
      SHOPIFY_API_SECRET: "test_secret",
      SHOPIFY_APP_URL: "https://synapse.example.com"
    },
    async () => {
      const { startShopifyInstall } = await loadModules();
      assert.throws(
        () => startShopifyInstall("bad-domain.example.com"),
        /Invalid shop domain/
      );
    }
  );
});

test("startShopifyInstall rejects when OAuth config is missing", async () => {
  await withOAuthEnv(
    {
      SHOPIFY_API_KEY: undefined,
      SHOPIFY_API_SECRET: "test_secret",
      SHOPIFY_APP_URL: "https://synapse.example.com"
    },
    async () => {
      const { startShopifyInstall } = await loadModules();
      assert.throws(
        () => startShopifyInstall("example-shop.myshopify.com"),
        /Shopify OAuth is not configured/
      );
    }
  );
});

test("startShopifyInstall builds a normalized Shopify authorize URL", async () => {
  await withOAuthEnv(
    {
      SHOPIFY_API_KEY: "test_key",
      SHOPIFY_API_SECRET: "test_secret",
      SHOPIFY_APP_URL: "https://synapse.example.com"
    },
    async () => {
      const { env, startShopifyInstall } = await loadModules();
      const result = startShopifyInstall("Example-Shop.MyShopify.com");
      const installUrl = new URL(result.url);

      assert.equal(installUrl.origin, "https://example-shop.myshopify.com");
      assert.equal(installUrl.pathname, "/admin/oauth/authorize");
      assert.equal(installUrl.searchParams.get("client_id"), "test_key");
      assert.equal(installUrl.searchParams.get("scope"), env.SHOPIFY_APP_SCOPES);
      assert.equal(installUrl.searchParams.get("state"), result.state);
      assert.equal(
        installUrl.searchParams.get("redirect_uri"),
        new URL(env.SHOPIFY_AUTH_CALLBACK_PATH, "https://synapse.example.com").toString()
      );
    }
  );
});

test("completeShopifyInstall rejects callback with invalid shop domain", async () => {
  await withOAuthEnv(
    {
      SHOPIFY_API_KEY: "test_key",
      SHOPIFY_API_SECRET: "test_secret",
      SHOPIFY_APP_URL: "https://synapse.example.com"
    },
    async () => {
      const { completeShopifyInstall } = await loadModules();
      const params = new URLSearchParams({
        shop: "evil.example.com",
        state: "state_123",
        hmac: "hmac_123",
        code: "code_123"
      });

      await assert.rejects(
        () => completeShopifyInstall(params),
        /Invalid shop domain/
      );
    }
  );
});
