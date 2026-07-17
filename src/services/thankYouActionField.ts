import { resolveOrderId } from "./orderId";
import { resolveOrderRevenue } from "./orderRevenue";

export type ThankYouActionFieldInput = {
  orderNumber?: number | string | undefined;
  orderName?: string | undefined;
  transactionId?: string | undefined;
  ecommerceValue?: string | number | undefined;
  totalPrice?: string | number | undefined;
  currency?: string | undefined;
  tax?: string | number | undefined;
  shipping?: string | number | undefined;
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

function normalizeCurrency(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.toUpperCase();
}

export type ThankYouActionField = {
  id: string;
  revenue: number;
  currency?: string | undefined;
  tax?: number | undefined;
  shipping?: number | undefined;
};

/**
 * Compatibility for Elevar "dlv - Thank You Page - Action Field".
 * Shape mirrors classic ecommerce.actionField (id + revenue + currency).
 */
export function resolveThankYouActionField(input: ThankYouActionFieldInput): ThankYouActionField {
  const id = resolveOrderId({
    orderNumber: input.orderNumber,
    orderName: input.orderName,
    transactionId: input.transactionId
  });

  const revenue = resolveOrderRevenue({
    ecommerceValue: input.ecommerceValue,
    totalPrice: input.totalPrice
  });

  return {
    id,
    revenue,
    currency: normalizeCurrency(input.currency),
    tax: toNumber(input.tax),
    shipping: toNumber(input.shipping)
  };
}
