export type CustomerIdentityInput = {
  customerId?: string | number | undefined;
  customerEmail?: string | undefined;
  checkoutEmail?: string | undefined;
};

function normalizeString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function resolveCustomerId(input: CustomerIdentityInput, fallbackCustomerId = "guest"): string {
  if (typeof input.customerId === "number" && Number.isFinite(input.customerId)) {
    return input.customerId.toString();
  }

  if (typeof input.customerId === "string") {
    const normalizedCustomerId = normalizeString(input.customerId);
    if (normalizedCustomerId) {
      return normalizedCustomerId;
    }
  }

  return fallbackCustomerId;
}

export function resolveCustomerEmail(input: CustomerIdentityInput): string | undefined {
  const candidate = normalizeString(input.customerEmail) ?? normalizeString(input.checkoutEmail);
  return candidate?.toLowerCase();
}
