import crypto from "crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import axios from "axios";
import { env } from "../config/env";
import { logInfo } from "../lib/logger";

type ShopifyTokenRecord = {
  shop: string;
  access_token: string;
  scope: string;
  installed_at: string;
};

const DEFAULT_TOKEN_STORE_PATH = "data/shopify-tokens.json";
const STATE_TTL_MS = 10 * 60 * 1000;

const pendingStates = new Map<string, { shop: string; expiresAt: number }>();

const SHOP_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

function assertOAuthConfigured(): { apiKey: string; apiSecret: string; appUrl: string } {
  if (!env.SHOPIFY_API_KEY || !env.SHOPIFY_API_SECRET || !env.SHOPIFY_APP_URL) {
    throw new Error("Shopify OAuth is not configured. Set SHOPIFY_API_KEY, SHOPIFY_API_SECRET, and SHOPIFY_APP_URL.");
  }

  return {
    apiKey: env.SHOPIFY_API_KEY,
    apiSecret: env.SHOPIFY_API_SECRET,
    appUrl: env.SHOPIFY_APP_URL
  };
}

function normalizeShopDomain(shop: string): string {
  const normalized = shop.trim().toLowerCase();
  if (!SHOP_DOMAIN_PATTERN.test(normalized)) {
    throw new Error("Invalid shop domain. Expected format: <shop>.myshopify.com");
  }

  return normalized;
}

function resolveTokenStorePath(): string {
  return env.SHOPIFY_TOKEN_STORE_PATH ?? DEFAULT_TOKEN_STORE_PATH;
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function createState(): string {
  return base64UrlEncode(crypto.randomBytes(24));
}

function pruneStates(now = Date.now()): void {
  for (const [state, value] of pendingStates.entries()) {
    if (value.expiresAt <= now) {
      pendingStates.delete(state);
    }
  }
}

export function startShopifyInstall(shop: string): { state: string; url: string } {
  const config = assertOAuthConfigured();
  const normalizedShop = normalizeShopDomain(shop);

  const state = createState();
  pendingStates.set(state, { shop: normalizedShop, expiresAt: Date.now() + STATE_TTL_MS });
  pruneStates();

  const redirectUri = new URL(env.SHOPIFY_AUTH_CALLBACK_PATH, config.appUrl).toString();
  const installUrl = new URL(`https://${normalizedShop}/admin/oauth/authorize`);
  installUrl.searchParams.set("client_id", config.apiKey);
  installUrl.searchParams.set("scope", env.SHOPIFY_APP_SCOPES);
  installUrl.searchParams.set("redirect_uri", redirectUri);
  installUrl.searchParams.set("state", state);

  return { state, url: installUrl.toString() };
}

function verifyInstallCallback(params: URLSearchParams): { ok: boolean; error?: string; shop?: string } {
  const rawShop = params.get("shop") ?? undefined;
  let shop: string | undefined;
  try {
    shop = rawShop ? normalizeShopDomain(rawShop) : undefined;
  } catch {
    return { ok: false, error: "Invalid shop domain" };
  }
  const state = params.get("state") ?? undefined;
  const hmac = params.get("hmac") ?? undefined;

  if (!shop || !state || !hmac) {
    return { ok: false, error: "Missing shop, state, or hmac" };
  }

  const pending = pendingStates.get(state);
  if (!pending || pending.expiresAt <= Date.now()) {
    pendingStates.delete(state);
    return { ok: false, error: "Invalid or expired state" };
  }

  if (pending.shop !== shop) {
    return { ok: false, error: "State/shop mismatch" };
  }

  const entries = Array.from(params.entries())
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const digest = crypto
    .createHmac("sha256", assertOAuthConfigured().apiSecret)
    .update(entries)
    .digest("hex");

  try {
    if (!crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac))) {
      return { ok: false, error: "Invalid hmac" };
    }
  } catch {
    return { ok: false, error: "Invalid hmac" };
  }

  pendingStates.delete(state);
  return { ok: true, shop };
}

async function readTokenStore(): Promise<Record<string, ShopifyTokenRecord>> {
  const tokenStorePath = path.resolve(resolveTokenStorePath());

  try {
    const raw = await readFile(tokenStorePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return parsed as Record<string, ShopifyTokenRecord>;
  } catch {
    return {};
  }
}

async function writeTokenStore(records: Record<string, ShopifyTokenRecord>): Promise<void> {
  const tokenStorePath = path.resolve(resolveTokenStorePath());
  await mkdir(path.dirname(tokenStorePath), { recursive: true });
  await writeFile(tokenStorePath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
}

export async function completeShopifyInstall(callbackQuery: URLSearchParams): Promise<{ shop: string; scope: string }> {
  const config = assertOAuthConfigured();
  const validation = verifyInstallCallback(callbackQuery);
  if (!validation.ok || !validation.shop) {
    throw new Error(validation.error ?? "Invalid Shopify install callback");
  }

  const code = callbackQuery.get("code") ?? undefined;
  if (!code) {
    throw new Error("Missing authorization code");
  }

  const tokenUrl = `https://${validation.shop}/admin/oauth/access_token`;
  const response = await axios.post(tokenUrl, {
    client_id: config.apiKey,
    client_secret: config.apiSecret,
    code
  });

  const accessToken = typeof response.data?.access_token === "string" ? response.data.access_token : undefined;
  const scope = typeof response.data?.scope === "string" ? response.data.scope : "";

  if (!accessToken) {
    throw new Error("Shopify token exchange did not return an access token");
  }

  const tokenStore = await readTokenStore();
  tokenStore[validation.shop] = {
    shop: validation.shop,
    access_token: accessToken,
    scope,
    installed_at: new Date().toISOString()
  };
  await writeTokenStore(tokenStore);

  logInfo("Shopify internal app installed", {
    shop: validation.shop,
    scope
  });

  return {
    shop: validation.shop,
    scope
  };
}

export async function getShopifyInstallStatus(): Promise<{ installed_shops: string[]; store_path: string }> {
  const tokenStore = await readTokenStore();
  return {
    installed_shops: Object.keys(tokenStore),
    store_path: resolveTokenStorePath()
  };
}