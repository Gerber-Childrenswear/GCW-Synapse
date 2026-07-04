export type PageTitleResolution = {
  pageTitle: string;
  source: "page_title" | "page_url" | "fallback";
};

function normalize(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function toPathTitle(pathname: string): string | undefined {
  const trimmed = pathname.trim();
  if (!trimmed || trimmed === "/") {
    return undefined;
  }

  const normalized = trimmed.replace(/^\/+|\/+$/g, "");
  if (!normalized) {
    return undefined;
  }

  const raw = normalized
    .split("/")
    .filter((segment) => segment.length > 0)
    .join(" ")
    .replace(/[-_]+/g, " ");

  const title = titleCase(raw);
  return title.length > 0 ? title : undefined;
}

export function resolvePageTitle(input: { pageTitle?: string | undefined; pageUrl?: string | undefined }): PageTitleResolution {
  const direct = normalize(input.pageTitle);
  if (direct) {
    return {
      pageTitle: direct,
      source: "page_title"
    };
  }

  const pageUrl = normalize(input.pageUrl);
  if (pageUrl) {
    try {
      const parsed = new URL(pageUrl);
      const fromPath = toPathTitle(parsed.pathname);
      if (fromPath) {
        return {
          pageTitle: fromPath,
          source: "page_url"
        };
      }
    } catch {
      const fromPath = toPathTitle(pageUrl);
      if (fromPath) {
        return {
          pageTitle: fromPath,
          source: "page_url"
        };
      }
    }
  }

  return {
    pageTitle: "Untitled Page",
    source: "fallback"
  };
}
