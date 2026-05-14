import type { ShopifyLineItem } from "../types/shopify";
import { resolvePurchaseProducts, type PurchaseProduct } from "./purchaseProducts";

export function resolveCheckoutProducts(lineItems: ShopifyLineItem[]): PurchaseProduct[] {
  return resolvePurchaseProducts(lineItems);
}
