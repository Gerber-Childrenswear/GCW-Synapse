import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const boolFromEnv = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "off", ""].includes(normalized)) {
      return false;
    }
  }

  return value;
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  RUNTIME_MODE: z.enum(["forward", "shadow_compare"]).default("forward"),
  PORT: z.coerce.number().int().positive().default(4000),
  SHOPIFY_API_KEY: z.string().min(1).optional(),
  SHOPIFY_API_SECRET: z.string().min(1).optional(),
  SHOPIFY_APP_URL: z.string().url().optional(),
  SHOPIFY_APP_SCOPES: z
    .string()
    .default(
      "read_products,read_orders,read_checkouts,read_customers,read_customer_events,write_pixels,read_themes"
    ),
  SHOPIFY_AUTH_CALLBACK_PATH: z.string().default("/auth/shopify/callback"),
  SHOPIFY_TOKEN_STORE_PATH: z.string().optional(),
  GTM_SERVER_URL: z.string().url().optional(),
  SHOPIFY_WEBHOOK_SECRET: z.string().min(1).optional(),
  WEBHOOK_PATH_PREFIX: z.string().default("/webhooks/shopify/orders"),
  REFUNDS_WEBHOOK_PATH_PREFIX: z.string().default("/webhooks/shopify/refunds"),
  JSON_BODY_LIMIT: z.string().default("256kb"),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  GTM_FORWARD_SHARED_SECRET: z.string().min(16).optional(),
  GTM_DEAD_LETTER_PATH: z.string().optional(),
  GTM_FORWARD_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  GTM_FORWARD_BACKOFF_MS: z.coerce.number().int().positive().default(300),
  IDEMPOTENCY_TTL_MS: z.coerce.number().int().positive().default(600000),
  INGRESS_SHARED_TOKEN: z.string().min(8).optional(),
  ALLOWED_WEBHOOK_TOPICS: z.string().default("orders/create,orders/paid,refunds/create"),
  CUSTOMER_ID_FALLBACK: z.string().min(1).default("guest"),
  SHOP_DEFAULT_CURRENCY: z.string().regex(/^[A-Z]{3}$/i).default("USD"),
  FACEBOOK_PIXEL_ID: z.string().min(1).optional(),
  PINTEREST_ID: z.string().min(1).optional(),
  GA4_MEASUREMENT_ID: z.string().regex(/^G-[A-Z0-9]+$/i).optional(),
  GA4_MEASUREMENT_ID_BY_SHOP: z.string().optional(),
  SHADOW_COMPARE_MAX_RECORDS: z.coerce.number().int().positive().default(5000),
  SHADOW_COMPARE_MISMATCH_ALERT_PCT: z.coerce.number().min(0).max(100).default(5),
  SHADOW_COMPARE_STORE_PATH: z.string().optional(),
  CHANNEL_HEALTH_STALE_MINUTES: z.coerce.number().int().positive().default(90),
  CHANNEL_HEALTH_WARN_FAILURE_PCT: z.coerce.number().min(0).max(100).default(5),
  LAUNCH_MIN_PAIRED_EVENTS: z.coerce.number().int().positive().default(100),
  LAUNCH_MAX_WARNING_CHANNELS: z.coerce.number().int().min(0).default(0),
  LAUNCH_MAX_WEBHOOK_FAILURE_RATE_PCT: z.coerce.number().min(0).max(100).default(2),
  LAUNCH_MIN_BROWSER_PAIRED_EVENTS: z.coerce.number().int().min(0).default(50),
  BROWSER_PARITY_MISMATCH_ALERT_PCT: z.coerce.number().min(0).max(100).default(5),
  SLACK_WEBHOOK_URL: z.string().url().optional(),
  ALERT_EMAIL_TO: z.string().email().optional(),
  ALERT_EMAIL_FROM: z.string().email().optional(),
  ALERT_EMAIL_WEBHOOK_URL: z.string().url().optional(),
  STRICT_LAUNCH_GUARD: boolFromEnv.default(false),
  LAUNCH_MAX_DEAD_LETTER_RECORDS: z.coerce.number().int().min(0).default(0),
  LAUNCH_THEME_AUDIT_PATH: z.string().default("docs/gtm/THEME_TRACKING_AUDIT.md"),
  LAUNCH_BLOCK_ON_THEME_CONFLICTS: boolFromEnv.default(true),
  PUBLIC_EVENT_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),
  PUBLIC_EVENT_ALLOWED_ORIGINS: z.string().optional(),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  LOCAL_ADVISOR_ENABLED: boolFromEnv.default(false),
  LOCAL_ADVISOR_BASE_URL: z.string().url().default("http://127.0.0.1:11434"),
  LOCAL_ADVISOR_MODEL: z.string().min(1).default("qwen2.5:14b-instruct"),
  LOCAL_ADVISOR_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  CONTROL_PANEL_MAPPING_STORE_PATH: z.string().optional()
});

type ParsedEnv = z.infer<typeof envSchema>;
type RuntimeEnv = ParsedEnv & {
  GTM_SERVER_URL: string;
  SHOPIFY_WEBHOOK_SECRET: string;
};

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  throw new Error("Environment validation failed");
}

const normalized = {
  ...parsed.data,
  GTM_SERVER_URL:
    parsed.data.GTM_SERVER_URL ??
    (parsed.data.NODE_ENV === "production" ? undefined : "http://127.0.0.1:3000/g/collect"),
  SHOPIFY_WEBHOOK_SECRET:
    parsed.data.SHOPIFY_WEBHOOK_SECRET ??
    (parsed.data.NODE_ENV === "production" ? undefined : "dev_webhook_secret_do_not_use_in_prod")
};

if (!normalized.GTM_SERVER_URL || !normalized.SHOPIFY_WEBHOOK_SECRET) {
  console.error("Missing required runtime configuration for production mode");
  throw new Error("Environment validation failed");
}

export const env: RuntimeEnv = {
  ...normalized,
  GTM_SERVER_URL: normalized.GTM_SERVER_URL,
  SHOPIFY_WEBHOOK_SECRET: normalized.SHOPIFY_WEBHOOK_SECRET
};
