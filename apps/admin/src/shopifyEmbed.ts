/** Detect Shopify embedded app context from the URL Shopify injects. */
export type ShopifyEmbedContext = {
  embedded: boolean;
  shop: string | null;
  host: string | null;
  shopHandle: string | null;
  adminAppUrl: string | null;
  installUrl: string;
};

const CLIENT_ID = "ad45451a4c49376bdeae4dae0f3ac26a";

export function getShopifyEmbedContext(): ShopifyEmbedContext {
  const params = new URLSearchParams(window.location.search);
  const shopRaw = (params.get("shop") || "").trim().toLowerCase();
  const host = (params.get("host") || "").trim() || null;
  const embeddedFlag = params.get("embedded") === "1" || Boolean(host);
  const shop = shopRaw.includes(".myshopify.com")
    ? shopRaw
    : shopRaw
      ? `${shopRaw.replace(/\.myshopify\.com$/i, "")}.myshopify.com`
      : null;
  const shopHandle = shop ? shop.replace(/\.myshopify\.com$/i, "") : null;
  const adminAppUrl = shopHandle
    ? `https://admin.shopify.com/store/${shopHandle}/apps/${CLIENT_ID}`
    : null;

  return {
    embedded: embeddedFlag || Boolean(shop && host),
    shop,
    host,
    shopHandle,
    adminAppUrl,
    installUrl: shop
      ? `/install?shop=${encodeURIComponent(shop)}`
      : "/install?shop=gcw-dev.myshopify.com"
  };
}
