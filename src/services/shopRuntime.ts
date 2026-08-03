/**
 * Per-shop runtime isolation.
 *
 * A single Worker serves both gcw-dev and the production storefront, so a
 * global RUNTIME_MODE / GTM_SERVER_URL pair cannot express "dev shadows while
 * prod forwards" — an unrecognized shop inherits whatever the global mode is.
 *
 * Hardening rules (all must pass before a shop can forward):
 * 1. Hard denylist — known non-production shops never forward, even if
 *    SHOP_RUNTIME_MODES is misconfigured to `forward`.
 * 2. Valid `*.myshopify.com` shop domain — anything else is shadow.
 * 3. Explicit `forward` entry in SHOP_RUNTIME_MODES for that exact shop.
 * 4. Explicit per-shop destination in GTM_SERVER_URL_BY_SHOP — never inherit
 *    the legacy global GTM_SERVER_URL.
 * 5. Destination must be an https URL.
 *
 * Global RUNTIME_MODE=shadow(_compare) remains a one-var kill switch that
 * forces every shop to shadow; it can never promote a shop to forward.
 */

export type ShopRuntimeMode = "forward" | "shadow";

/** Modes that mean "capture only, never forward". */
const SHADOW_MODE_ALIASES = new Set(["shadow", "shadow_compare", "shadow-compare", "off", "disabled"]);
const FORWARD_MODE_ALIASES = new Set(["forward", "live", "forwarding"]);

/**
 * Shops that must never forward, regardless of SHOP_RUNTIME_MODES. A mis-typed
 * `gcw-dev.myshopify.com=forward` must not open a route to production sGTM.
 */
export const NEVER_FORWARD_SHOPS = new Set(["gcw-dev.myshopify.com"]);

const SHOP_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

export function normalizeShopDomain(shopDomain: string | undefined | null): string {
  return (shopDomain ?? "").trim().toLowerCase();
}

export function isValidShopDomain(shopDomain: string | undefined | null): boolean {
  const shop = normalizeShopDomain(shopDomain);
  return shop.length > 0 && SHOP_DOMAIN_PATTERN.test(shop);
}

export function isNeverForwardShop(shopDomain: string | undefined | null): boolean {
  return NEVER_FORWARD_SHOPS.has(normalizeShopDomain(shopDomain));
}

/**
 * Parse a `shop=value,shop=value` config string. Values may themselves contain
 * `=` (URL query strings), so only the first separator is used.
 */
export function parseShopScopedConfig(raw: string | undefined): Record<string, string> {
  if (!raw) {
    return {};
  }

  const parsed: Record<string, string> = {};
  for (const entry of raw.split(",")) {
    const pair = entry.trim();
    if (pair.length === 0) continue;

    const separator = pair.indexOf("=");
    if (separator <= 0) continue;

    const shopDomain = normalizeShopDomain(pair.slice(0, separator));
    const value = pair.slice(separator + 1).trim();
    if (!shopDomain || !value) continue;

    parsed[shopDomain] = value;
  }

  return parsed;
}

/** Reject anything that is not a real https collect URL. */
export function isAllowedGtmDestination(url: string | undefined | null): boolean {
  const value = (url ?? "").trim();
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

export type ShopRuntimeEnv = {
  /** `gcw-dev.myshopify.com=shadow,gerberchildrenswear.myshopify.com=forward` */
  SHOP_RUNTIME_MODES?: string;
  /** Global kill switch only — it can restrict a shop to shadow, never promote one to forward. */
  RUNTIME_MODE?: string;
  /** `gerberchildrenswear.myshopify.com=https://sgtm.example/g/collect` — required for forward. */
  GTM_SERVER_URL_BY_SHOP?: string;
  /**
   * Legacy single destination. Intentionally unused for forwarding: a forward
   * shop must have its own GTM_SERVER_URL_BY_SHOP entry so a mis-mapped dev
   * shop can never inherit the production collector.
   */
  GTM_SERVER_URL?: string;
};

/**
 * Resolve the runtime mode for one shop. `forward` requires ALL of:
 * - shop not on the hard denylist
 * - valid `*.myshopify.com` domain
 * - explicit `SHOP_RUNTIME_MODES` entry for that exact shop with a forward alias
 * - global RUNTIME_MODE is not a shadow kill switch
 *
 * Everything else is `shadow`.
 */
export function resolveShopRuntimeMode(
  shopDomain: string | undefined,
  env: ShopRuntimeEnv
): ShopRuntimeMode {
  const globalMode = normalizeShopDomain(env.RUNTIME_MODE);
  if (SHADOW_MODE_ALIASES.has(globalMode)) {
    return "shadow";
  }

  const shop = normalizeShopDomain(shopDomain);
  if (!shop || shop === "unknown-shop" || !isValidShopDomain(shop) || isNeverForwardShop(shop)) {
    return "shadow";
  }

  const configured = normalizeShopDomain(parseShopScopedConfig(env.SHOP_RUNTIME_MODES)[shop]);
  if (!configured || !FORWARD_MODE_ALIASES.has(configured)) {
    return "shadow";
  }

  return "forward";
}

/**
 * Resolve the sGTM destination for one shop. Returns undefined unless the shop
 * is in `forward` mode AND has an explicit https entry in GTM_SERVER_URL_BY_SHOP.
 * The legacy global GTM_SERVER_URL is never consulted.
 */
export function resolveShopGtmServerUrl(
  shopDomain: string | undefined,
  env: ShopRuntimeEnv
): string | undefined {
  if (resolveShopRuntimeMode(shopDomain, env) !== "forward") {
    return undefined;
  }

  const shop = normalizeShopDomain(shopDomain);
  const perShop = (parseShopScopedConfig(env.GTM_SERVER_URL_BY_SHOP)[shop] ?? "").trim();
  return isAllowedGtmDestination(perShop) ? perShop : undefined;
}

/** Operator-facing view of how one shop resolves, for /ops/connection and beacon replies. */
export function describeShopRuntime(
  shopDomain: string | undefined,
  env: ShopRuntimeEnv
): {
  shop: string;
  runtime_mode: ShopRuntimeMode;
  destination_configured: boolean;
  never_forward: boolean;
  valid_shop_domain: boolean;
} {
  const shop = normalizeShopDomain(shopDomain) || "unknown-shop";
  return {
    shop,
    runtime_mode: resolveShopRuntimeMode(shopDomain, env),
    destination_configured: Boolean(resolveShopGtmServerUrl(shopDomain, env)),
    never_forward: isNeverForwardShop(shopDomain),
    valid_shop_domain: isValidShopDomain(shopDomain)
  };
}
