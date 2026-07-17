import type { SynapseProduct } from "./types";

function normalizeString(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function normalizeId(value: string | number | undefined | null): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }
  if (typeof value === "string") {
    return normalizeString(value);
  }
  return undefined;
}

/** Match server resolveProductIdentifier: sku > variant_id > product_id */
export function resolveProductIdentifier(input: {
  sku?: string | undefined;
  variantId?: string | number | undefined;
  productId?: string | number | undefined;
}): string {
  return (
    normalizeString(input.sku) ??
    normalizeId(input.variantId) ??
    normalizeId(input.productId) ??
    "unknown"
  );
}

export function toSynapseProduct(input: {
  sku?: string | undefined;
  name: string;
  brand?: string | undefined;
  category?: string | undefined;
  variant?: string | undefined;
  price: string | number;
  quantity?: string | number | undefined;
  position?: number | undefined;
  list?: string | undefined;
  productId?: string | number | undefined;
  variantId?: string | number | undefined;
  compareAtPrice?: string | number | undefined;
  image?: string | undefined;
  url?: string | undefined;
}): SynapseProduct {
  const productId = normalizeId(input.productId) ?? "";
  const variantId = normalizeId(input.variantId) ?? "";
  const price =
    typeof input.price === "number" ? input.price.toFixed(2) : String(input.price ?? "0.0");
  const compare =
    input.compareAtPrice == null
      ? "0.0"
      : typeof input.compareAtPrice === "number"
        ? input.compareAtPrice.toFixed(2)
        : String(input.compareAtPrice);

  const product: SynapseProduct = {
    id: resolveProductIdentifier({
      sku: input.sku,
      variantId,
      productId
    }),
    name: input.name,
    price,
    product_id: productId,
    variant_id: variantId,
    compare_at_price: compare
  };

  if (input.brand) product.brand = input.brand;
  if (input.category) product.category = input.category;
  if (input.variant) product.variant = input.variant;
  if (input.quantity != null) product.quantity = String(input.quantity);
  if (input.position != null) product.position = input.position;
  if (input.list) product.list = input.list;
  if (input.image) product.image = input.image;
  if (input.url) product.url = input.url;

  return product;
}
