export type PageTitleInput = {
  title?: string | undefined;
  documentTitle?: string | undefined;
  fallback?: string | undefined;
};

function normalizeString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Compatibility for Elevar "DOM - Page Title".
 * Prefers explicit title, then document.title-style fallback.
 */
export function resolvePageTitle(input: PageTitleInput): string {
  return (
    normalizeString(input.title) ??
    normalizeString(input.documentTitle) ??
    normalizeString(input.fallback) ??
    ""
  );
}
