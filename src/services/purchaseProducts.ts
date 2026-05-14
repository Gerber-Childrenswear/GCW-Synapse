import type { ShopifyLineItem } from "../types/shopify";

export type PurchaseProduct = {
  item_id?: string | undefined;
  item_name: string;
  item_variant?: string | undefined;
  item_category?: string | undefined;
  quantity: number;
  price: number;
  product_id?: string | undefined;
  sku?: string | undefined;
};

function toNumber(value: string | undefined): number {
  const parsed = Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function resolvePurchaseProducts(lineItems: ShopifyLineItem[]): PurchaseProduct[] {
  return lineItems.map((item) => ({
    item_id: normalizeString(item.sku) ?? item.variant_id?.toString() ?? item.product_id?.toString(),
    item_name: normalizeString(item.title) ?? "unknown-item",
    item_variant: normalizeString(item.variant_title),
    item_category: normalizeString(item.product_type),
    quantity: Number.isFinite(item.quantity) ? item.quantity : 0,
    price: toNumber(item.price),
    product_id: item.product_id?.toString(),
    sku: normalizeString(item.sku)
  }));
}
