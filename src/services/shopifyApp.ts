import { env } from "../config/env";

export type ShopifyAppConfig = {
  configured: boolean;
  client_id: string | undefined;
  api_key_present: boolean;
  api_secret_present: boolean;
  app_url: string | undefined;
  scopes: string[];
};

export function getShopifyAppConfig(): ShopifyAppConfig {
  const configured = Boolean(env.SHOPIFY_API_KEY && env.SHOPIFY_API_SECRET && env.SHOPIFY_APP_URL);

  return {
    configured,
    client_id: env.SHOPIFY_API_KEY,
    api_key_present: Boolean(env.SHOPIFY_API_KEY),
    api_secret_present: Boolean(env.SHOPIFY_API_SECRET),
    app_url: env.SHOPIFY_APP_URL,
    scopes: env.SHOPIFY_APP_SCOPES.split(",")
      .map((scope) => scope.trim())
      .filter((scope) => scope.length > 0)
  };
}
