export type OrderIdInput = {
  orderNumber?: number | string | undefined;
  orderName?: string | undefined;
  transactionId?: string | undefined;
};

function normalizeString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function resolveOrderId(input: OrderIdInput): string {
  if (typeof input.orderNumber === "number" && Number.isFinite(input.orderNumber)) {
    return input.orderNumber.toString();
  }

  if (typeof input.orderNumber === "string") {
    const normalizedOrderNumber = normalizeString(input.orderNumber);
    if (normalizedOrderNumber) {
      return normalizedOrderNumber;
    }
  }

  return normalizeString(input.transactionId) ?? normalizeString(input.orderName) ?? "unknown-order";
}
