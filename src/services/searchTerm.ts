const DEFAULT_SEARCH_KEYS = ["q", "query", "search", "term"];

function normalizeValue(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function resolveSearchTerm(searchParams: URLSearchParams, keys = DEFAULT_SEARCH_KEYS): string | undefined {
  for (const key of keys) {
    const value = normalizeValue(searchParams.get(key));
    if (value) {
      return value;
    }
  }

  return undefined;
}
