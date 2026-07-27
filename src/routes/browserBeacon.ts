import { Router } from "express";
import type { Request, Response } from "express";
import { ingestBrowserEvent } from "../services/browserEvents";
import { incrementCounter } from "../services/metrics";
import { logWarn } from "../lib/logger";

const router = Router();

const ALLOWED_EVENTS = new Set([
  "dl_user_data",
  "dl_view_item",
  "dl_view_item_list",
  "dl_view_search_results",
  "dl_select_item",
  "dl_add_to_cart",
  "dl_remove_from_cart",
  "dl_view_cart",
  "dl_begin_checkout",
  "dl_add_shipping_info",
  "dl_add_payment_info",
  "dl_purchase",
  "dl_sign_up",
  "dl_login",
  "dl_subscribe"
]);

type BeaconBody = {
  source?: string;
  shop?: string;
  event?: string;
  event_id?: string;
  currency?: string;
  cart_total?: string;
  ecommerce?: unknown;
  user_properties?: unknown;
  marketing?: {
    session_id?: string;
    landing_site?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
  };
  observed_at?: string;
  // Elevar dual-run mirror
  elevar?: boolean;
};

const recentHits = new Map<string, number[]>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 120;

function rateLimit(key: string): boolean {
  const now = Date.now();
  const hits = (recentHits.get(key) || []).filter((ts) => now - ts < RATE_WINDOW_MS);
  hits.push(now);
  recentHits.set(key, hits);
  return hits.length <= RATE_MAX;
}

function cors(res: Response): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

router.options("/beacon", (_req, res) => {
  cors(res);
  res.status(204).end();
});

router.post("/beacon", (req: Request, res: Response) => {
  cors(res);

  const body = (req.body || {}) as BeaconBody;
  const shop = typeof body.shop === "string" ? body.shop : "unknown-shop";
  const event = typeof body.event === "string" ? body.event : "";

  if (!rateLimit(`${shop}:${req.ip || "ip"}`)) {
    incrementCounter("browser_beacon_rate_limited");
    res.status(429).json({ ok: false, error: "rate_limited" });
    return;
  }

  if (!event || !ALLOWED_EVENTS.has(event)) {
    incrementCounter("browser_beacon_rejected");
    logWarn("Browser beacon rejected", { shop, event });
    res.status(400).json({ ok: false, error: "invalid_event" });
    return;
  }

  const sourceRaw = typeof body.source === "string" ? body.source.toLowerCase() : "";
  const source =
    body.elevar || sourceRaw === "elevar" || sourceRaw.includes("elevar") ? "elevar" : "synapse";
  const record = ingestBrowserEvent({
    source,
    shop,
    event,
    event_id: body.event_id,
    currency: body.currency,
    cart_total: body.cart_total,
    ecommerce: body.ecommerce,
    marketing: body.marketing,
    observed_at: body.observed_at
  });

  incrementCounter("browser_beacon_accepted");
  res.status(202).json({
    ok: true,
    accepted: true,
    key: record.key,
    event: record.event
  });
});

export { router as browserBeaconRouter };
