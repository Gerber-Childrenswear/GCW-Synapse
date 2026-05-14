type Ga4OverrideMap = Record<string, string>;

function normalizeShopDomain(shopDomain: string): string {
  return shopDomain.trim().toLowerCase();
}

export function parseGa4Overrides(raw: string | undefined): Ga4OverrideMap {
  if (!raw) {
    return {};
  }

  const entries = raw
    .split(",")
    .map((pair) => pair.trim())
    .filter((pair) => pair.length > 0);

  const overrides: Ga4OverrideMap = {};
  for (const entry of entries) {
    const [shopDomain, measurementId] = entry.split("=").map((part) => part.trim());
    if (!shopDomain || !measurementId) {
      continue;
    }

    overrides[normalizeShopDomain(shopDomain)] = measurementId;
  }

  return overrides;
}

export function resolveGa4MeasurementId(
  shopDomain: string | undefined,
  fallbackMeasurementId: string | undefined,
  rawOverrides: string | undefined
): string | undefined {
  if (!shopDomain) {
    return fallbackMeasurementId;
  }

  const overrides = parseGa4Overrides(rawOverrides);
  return overrides[normalizeShopDomain(shopDomain)] ?? fallbackMeasurementId;
}
