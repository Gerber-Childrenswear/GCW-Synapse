import type { ShopifyLineItem } from "../types/shopify";
import { resolvePurchaseProducts, type PurchaseProduct } from "./purchaseProducts";

export type AddToCartCompatibility = {
  add_array: PurchaseProduct[];
  quantity: number;
  price: number;
  value: number;
  category?: string | undefined;
  product_id?: string | undefined;
  product_name?: string | undefined;
  sku?: string | undefined;
  variant_id?: string | undefined;
  facebook_contents: Array<{ id: string; quantity: number; item_price: number }>;
  ga4_items: PurchaseProduct[];
  tiktok_contents: Array<{ content_id: string; quantity: number; price: number }>;
  google_ads_shopify_ids: string[];
};

function firstItem(items: PurchaseProduct[]): PurchaseProduct | undefined {
  return items[0];
}

export function resolveEcommerceImpressions(lineItems: ShopifyLineItem[]): PurchaseProduct[] {
  return resolvePurchaseProducts(lineItems);
}

export function resolveAddToCartCompatibility(lineItems: ShopifyLineItem[]): AddToCartCompatibility {
  const mapped = resolvePurchaseProducts(lineItems);
  const first = firstItem(mapped);
  const value = mapped.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const facebookContents = mapped.map((item) => ({
    id: item.item_id ?? item.product_id ?? item.sku ?? "unknown-item",
    quantity: item.quantity,
    item_price: item.price
  }));

  const tiktokContents = mapped.map((item) => ({
    content_id: item.item_id ?? item.product_id ?? item.sku ?? "unknown-item",
    quantity: item.quantity,
    price: item.price
  }));

  const googleAdsShopifyIds = mapped
    .map((item) => item.product_id ?? item.item_id ?? item.sku)
    .filter((value): value is string => !!value);

  return {
    add_array: mapped,
    quantity: first?.quantity ?? 0,
    price: first?.price ?? 0,
    value,
    category: first?.item_category,
    product_id: first?.product_id,
    product_name: first?.item_name,
    sku: first?.sku,
    variant_id: first?.item_variant,
    facebook_contents: facebookContents,
    ga4_items: mapped,
    tiktok_contents: tiktokContents,
    google_ads_shopify_ids: googleAdsShopifyIds
  };
}

export function resolveProductViewDetailsArray(lineItems: ShopifyLineItem[]): PurchaseProduct[] {
  return resolvePurchaseProducts(lineItems);
}
