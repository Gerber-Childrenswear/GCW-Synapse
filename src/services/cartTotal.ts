export type CartTotalInput = {
  ecommerceValue?: string | number | undefined;
  checkoutTotalPrice?: string | number | undefined;
  subtotalPrice?: string | number | undefined;
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

export function resolveCartTotal(input: CartTotalInput): number {
  return toNumber(input.ecommerceValue) ?? toNumber(input.checkoutTotalPrice) ?? toNumber(input.subtotalPrice) ?? 0;
}
