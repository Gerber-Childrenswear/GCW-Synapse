import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  RUNTIME_MODE: z.enum(["forward", "shadow_compare"]).default("forward"),
  PORT: z.coerce.number().int().positive().default(4000),
  GTM_SERVER_URL: z.string().url(),
  SHOPIFY_WEBHOOK_SECRET: z.string().min(1),
  WEBHOOK_PATH_PREFIX: z.string().default("/webhooks/shopify/orders"),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  GTM_FORWARD_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  GTM_FORWARD_BACKOFF_MS: z.coerce.number().int().positive().default(300),
  IDEMPOTENCY_TTL_MS: z.coerce.number().int().positive().default(600000),
  INGRESS_SHARED_TOKEN: z.string().min(8).optional(),
  ALLOWED_WEBHOOK_TOPICS: z.string().default("orders/create,orders/paid"),
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
  LAUNCH_MAX_WEBHOOK_FAILURE_RATE_PCT: z.coerce.number().min(0).max(100).default(2)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  throw new Error("Environment validation failed");
}

export const env = parsed.data;
