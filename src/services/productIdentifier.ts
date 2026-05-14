export type ProductIdentifierInput = {
  sku?: string | undefined;
  variantId?: string | number | undefined;
  productId?: string | number | undefined;
};

function normalizeString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function normalizeId(value: string | number | undefined): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }

  if (typeof value === "string") {
    return normalizeString(value);
  }

  return undefined;
}

export function resolveProductIdentifier(input: ProductIdentifierInput): string | undefined {
  return normalizeString(input.sku) ?? normalizeId(input.variantId) ?? normalizeId(input.productId);
}
