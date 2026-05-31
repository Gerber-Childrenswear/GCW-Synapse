import { z } from "zod";
import type { SynapseRuntimeEvent } from "../types/synapse";
import { REQUIRED_EVENTS } from "../types/synapse";

const consentSchema = z
  .object({
    analytics_storage: z.enum(["granted", "denied", "unknown"]).optional(),
    ad_storage: z.enum(["granted", "denied", "unknown"]).optional(),
    ad_user_data: z.enum(["granted", "denied", "unknown"]).optional(),
    ad_personalization: z.enum(["granted", "denied", "unknown"]).optional()
  })
  .strict();

const productSchema = z
  .object({
    product_id: z.string().optional(),
    variant_id: z.string().optional(),
    sku: z.string().optional(),
    name: z.string().optional(),
    category: z.string().optional(),
    price: z.number().optional(),
    quantity: z.number().optional()
  })
  .strict();

const runtimeSchema = z
  .object({
    event_name: z.enum(REQUIRED_EVENTS),
    event_id: z.string().min(6).max(200).optional(),
    source: z.enum(["theme", "customer_events", "server"]),
    customer: z
      .object({
        id: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        visitor_type: z.string().optional(),
        customer_tier: z.string().optional()
      })
      .strict(),
    product: productSchema,
    collection: z
      .object({
        id: z.string().optional(),
        name: z.string().optional(),
        filters: z.array(z.string()).optional()
      })
      .strict(),
    cart: z
      .object({
        cart_id: z.string().optional(),
        total: z.number().optional(),
        currency: z.string().optional(),
        item_count: z.number().optional(),
        items: z.array(productSchema).optional()
      })
      .strict(),
    checkout: z
      .object({
        checkout_id: z.string().optional(),
        order_id: z.string().optional(),
        revenue: z.number().optional(),
        shipping: z.number().optional(),
        tax: z.number().optional(),
        coupon: z.string().optional()
      })
      .strict(),
    marketing: z
      .object({
        event_id: z.string().optional(),
        user_id: z.string().optional(),
        source: z.string().optional(),
        medium: z.string().optional(),
        campaign: z.string().optional()
      })
      .strict(),
    session: z
      .object({
        id: z.string().optional(),
        page_url: z.string().url().optional(),
        referrer: z.string().optional(),
        timestamp: z.string().optional(),
        sequence: z.number().int().nonnegative().optional()
      })
      .strict(),
    consent: consentSchema
  })
  .strict();

const DEDUPE_TTL_MS = 5 * 60 * 1000;
const seenEvents = new Map<string, number>();

type RuntimeTelemetryEvent = {
  at: string;
  event_name: string;
  event_id?: string | undefined;
  source: string;
  status: "forwarded" | "suppressed" | "duplicate";
  reason?: string | undefined;
  visitor_type?: string | undefined;
};

const runtimeTelemetry: RuntimeTelemetryEvent[] = [];
const MAX_TELEMETRY_EVENTS = 1500;

function cleanupSeenEvents(now: number): void {
  for (const [key, value] of seenEvents.entries()) {
    if (now - value > DEDUPE_TTL_MS) {
      seenEvents.delete(key);
    }
  }
}

export function parseRuntimeEvent(input: unknown): SynapseRuntimeEvent {
  return runtimeSchema.parse(input) as SynapseRuntimeEvent;
}

export function isRuntimeDuplicate(event: SynapseRuntimeEvent): boolean {
  const dedupeKey = `${event.event_name}:${event.event_id ?? event.session.id ?? "missing"}`;
  const now = Date.now();

  cleanupSeenEvents(now);

  const previous = seenEvents.get(dedupeKey);
  if (previous && now - previous < DEDUPE_TTL_MS) {
    return true;
  }

  seenEvents.set(dedupeKey, now);
  return false;
}

export function recordRuntimeTelemetry(event: RuntimeTelemetryEvent): void {
  runtimeTelemetry.unshift(event);
  if (runtimeTelemetry.length > MAX_TELEMETRY_EVENTS) {
    runtimeTelemetry.length = MAX_TELEMETRY_EVENTS;
  }
}

export function getRuntimeTelemetry(limit = 100): RuntimeTelemetryEvent[] {
  return runtimeTelemetry.slice(0, Math.max(1, Math.min(limit, 1000)));
}

export function getRuntimeTelemetrySummary(): {
  total: number;
  forwarded: number;
  suppressed: number;
  duplicate: number;
  last_event_at?: string | undefined;
} {
  let forwarded = 0;
  let suppressed = 0;
  let duplicate = 0;

  for (const item of runtimeTelemetry) {
    if (item.status === "forwarded") {
      forwarded += 1;
    } else if (item.status === "suppressed") {
      suppressed += 1;
    } else if (item.status === "duplicate") {
      duplicate += 1;
    }
  }

  return {
    total: runtimeTelemetry.length,
    forwarded,
    suppressed,
    duplicate,
    last_event_at: runtimeTelemetry[0]?.at
  };
}
