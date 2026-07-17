export type ProductViewPriceInput = {
  price?: string | number | undefined;
  ecommercePrice?: string | number | undefined;
};

export type ProductViewNameInput = {
  name?: string | undefined;
  title?: string | undefined;
  productTitle?: string | undefined;
};

function toNumber(value: string | number | undefined): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function normalizeString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

/** Compatibility for Elevar "dlv - Product View - Price". */
export function resolveProductViewPrice(input: ProductViewPriceInput): number {
  return toNumber(input.price) ?? toNumber(input.ecommercePrice) ?? 0;
}

/** Compatibility for Elevar "dlv - Product View - Name". */
export function resolveProductViewName(input: ProductViewNameInput): string {
  return (
    normalizeString(input.name) ??
    normalizeString(input.title) ??
    normalizeString(input.productTitle) ??
    ""
  );
}
