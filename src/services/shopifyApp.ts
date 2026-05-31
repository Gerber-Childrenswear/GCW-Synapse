import { env } from "../config/env";

export type ShopifyAppConfig = {
  configured: boolean;
  api_key_present: boolean;
  app_url: string | undefined;
  scopes: string[];
};

export function getShopifyAppConfig(): ShopifyAppConfig {
  const configured = Boolean(env.SHOPIFY_API_KEY && env.SHOPIFY_API_SECRET && env.SHOPIFY_APP_URL);

  return {
    configured,
    api_key_present: Boolean(env.SHOPIFY_API_KEY),
    app_url: env.SHOPIFY_APP_URL,
    scopes: env.SHOPIFY_APP_SCOPES
      .split(",")
      .map((scope) => scope.trim())
      .filter((scope) => scope.length > 0)
  };
}