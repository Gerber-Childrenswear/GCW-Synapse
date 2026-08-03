/**
 * Per-shop runtime isolation.
 *
 * A single Worker serves both gcw-dev and the production storefront, so a
 * global RUNTIME_MODE / GTM_SERVER_URL pair cannot express "dev shadows while
 * prod forwards" — an unrecognized shop inherits whatever the global mode is.
 * Both resolvers here are default-deny: a shop that is missing, malformed,
 * unknown or unmapped resolves to `shadow` with no sGTM destination, so it has
 * no route to a production collector even if the mode logic above it is wrong.
 */

export type ShopRuntimeMode = "forward" | "shadow";

/** Modes that mean "capture only, never forward". */
const SHADOW_MODE_ALIASES = new Set(["shadow", "shadow_compare", "shadow-compare", "off", "disabled"]);
const FORWARD_MODE_ALIASES = new Set(["forward", "live", "forwarding"]);

export function normalizeShopDomain(shopDomain: string | undefined | null): string {
  return (shopDomain ?? "").trim().toLowerCase();
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

export type ShopRuntimeEnv = {
  /** `gcw-dev.myshopify.com=shadow,gerberchildrenswear.myshopify.com=forward` */
  SHOP_RUNTIME_MODES?: string;
  /** Global kill switch only — it can restrict a shop to shadow, never promote one to forward. */
  RUNTIME_MODE?: string;
  /** `gerberchildrenswear.myshopify.com=https://sgtm.example/g/collect` */
  GTM_SERVER_URL_BY_SHOP?: string;
  /** Legacy single destination. Usable only by shops explicitly mapped to `forward`. */
  GTM_SERVER_URL?: string;
};

/**
 * Resolve the runtime mode for one shop. `forward` requires an explicit
 * `SHOP_RUNTIME_MODES` entry for that exact shop domain; everything else is
 * `shadow`. A global RUNTIME_MODE of shadow/shadow_compare still forces every
 * shop to shadow so ops keep a one-var kill switch.
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
  if (!shop || shop === "unknown-shop") {
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
 * is explicitly mapped to `forward`, so a shadow/unknown shop can never inherit
 * the production collector from the legacy global GTM_SERVER_URL.
 */
export function resolveShopGtmServerUrl(
  shopDomain: string | undefined,
  env: ShopRuntimeEnv
): string | undefined {
  if (resolveShopRuntimeMode(shopDomain, env) !== "forward") {
    return undefined;
  }

  const shop = normalizeShopDomain(shopDomain);
  const perShop = parseShopScopedConfig(env.GTM_SERVER_URL_BY_SHOP)[shop];
  const resolved = (perShop ?? env.GTM_SERVER_URL ?? "").trim();
  return resolved.length > 0 ? resolved : undefined;
}

/** Operator-facing view of how one shop resolves, for /ops/connection and beacon replies. */
export function describeShopRuntime(
  shopDomain: string | undefined,
  env: ShopRuntimeEnv
): { shop: string; runtime_mode: ShopRuntimeMode; destination_configured: boolean } {
  return {
    shop: normalizeShopDomain(shopDomain) || "unknown-shop",
    runtime_mode: resolveShopRuntimeMode(shopDomain, env),
    destination_configured: Boolean(resolveShopGtmServerUrl(shopDomain, env))
  };
}
