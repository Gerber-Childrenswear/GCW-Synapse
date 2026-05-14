type CurrencyResolutionInput = {
  ecommerceCurrency?: string | undefined;
  checkoutCurrencyCode?: string | undefined;
  shopCurrency?: string | undefined;
};

function normalizeCurrency(candidate: string | undefined): string | undefined {
  if (!candidate) {
    return undefined;
  }

  const trimmed = candidate.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(trimmed)) {
    return undefined;
  }

  return trimmed;
}

export function resolveCurrencyCode(input: CurrencyResolutionInput, fallbackCurrency = "USD"): string {
  return (
    normalizeCurrency(input.ecommerceCurrency) ??
    normalizeCurrency(input.checkoutCurrencyCode) ??
    normalizeCurrency(input.shopCurrency) ??
    normalizeCurrency(fallbackCurrency) ??
    "USD"
  );
}
