export type OrderRevenueInput = {
  ecommerceValue?: string | number | undefined;
  totalPrice?: string | number | undefined;
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

export function resolveOrderRevenue(input: OrderRevenueInput): number {
  return toNumber(input.ecommerceValue) ?? toNumber(input.totalPrice) ?? 0;
}
