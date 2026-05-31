export type VisitorTypeInput = {
  customerId?: string | undefined;
  customerEmail?: string | undefined;
};

function hasValue(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

export function resolveVisitorType(input: VisitorTypeInput): "Logged In" | "Guest" {
  if (hasValue(input.customerId) || hasValue(input.customerEmail)) {
    return "Logged In";
  }

  return "Guest";
}
