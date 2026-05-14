export function normalizeCustomerPhone(input: string | undefined): string | undefined {
  if (!input) {
    return undefined;
  }

  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.length === 0) {
    return undefined;
  }

  if (digits.startsWith("+")) {
    return digits;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  return `+${digits}`;
}
