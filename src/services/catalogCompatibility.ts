import type { ShopifyLineItem } from "../types/shopify";
import { resolvePurchaseProducts, type PurchaseProduct } from "./purchaseProducts";

export type AddToCartCompatibility = {
  add_array: PurchaseProduct[];
  quantity: number;
  price: number;
  category?: string | undefined;
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

  return {
    add_array: mapped,
    quantity: first?.quantity ?? 0,
    price: first?.price ?? 0,
    category: first?.item_category
  };
}

export function resolveProductViewDetailsArray(lineItems: ShopifyLineItem[]): PurchaseProduct[] {
  return resolvePurchaseProducts(lineItems);
}
