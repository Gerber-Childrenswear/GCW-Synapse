import type { ShopifyLineItem } from "../types/shopify";

export type ProductGroupResolution = {
  productGroup: string;
  source: "product_type" | "title" | "fallback";
};

function normalize(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function resolveProductGroup(lineItems: ShopifyLineItem[]): ProductGroupResolution {
  for (const item of lineItems) {
    const group = normalize(item.product_type);
    if (group) {
      return { productGroup: group, source: "product_type" };
    }
  }

  for (const item of lineItems) {
    const title = normalize(item.title);
    if (title) {
      return { productGroup: title, source: "title" };
    }
  }

  return {
    productGroup: "unknown-group",
    source: "fallback"
  };
}
