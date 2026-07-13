import {
  getControlPanelChecklist,
  getControlPanelSchemas,
  getControlPanelVendors
} from "../src/services/controlPanelData";
import {
  mapOrderToPurchase,
  mapRefundToRefundEvent
} from "../src/services/payloadMapper";
import type {
  ShopifyOrder,
  ShopifyRefund,
  SynapseEventPayload
} from "../src/types/shopify";
import {
  deterministicEventId,
  observationFromPayload,
  observationFromSynapse,
  redactPayloadJson,
  verifyShopifyHmac
} from "./domain";
import type { SynapseEnv } from "./env";
import {
  createStore,
  type ComparisonRecord,
  type WebhookReceiptInput,
  type WebhookStatus
} from "./store";

const PROXY_PREFIXES = ["/auth/", "/compatibility/"];
const INTERNAL_PREFIXES = [
  "/ops/",
  "/api/",
  "/compare/",
  "/runtime/",
  "/launch/",
  "/auth/",
  "/compatibility/"
];
const WEBHOOK_TOPICS: Record<string, string> = {
  "/webhooks/shopify/orders/create": "orders/create",
  "/webhooks/shopify/orders/paid": "orders/paid",
  "/webhooks/shopify/refunds/create": "refunds/create"
};
const rateState = new Map<string, { startedAt: number; count: number }>();
const workerStartedAt = Date.now();

type JsonRecord = Record<string, unknown>;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampLimit(value: string | null, fallback = 100): number {
  return Math.max(
    1,
    Math.min(500, parsePositiveInt(value ?? undefined, fallback))
  );
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function securityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-XSS-Protection", "0");
  headers.set(
    "Content-Security-Policy",
    "frame-ancestors 'self' https://admin.shopify.com https://*.myshopify.com"
  );
  if ((headers.get("content-type") ?? "").includes("text/html")) {
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function allowedOrigins(env: SynapseEnv): string[] {
  return (
    env.PUBLIC_EVENT_ALLOWED_ORIGINS ??
    "https://gcw-dev.myshopify.com"
  )
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function withCors(
  response: Response,
  request: Request,
  originOverride?: string
): Response {
  const headers = new Headers(response.headers);
  const origin = originOverride ?? request.headers.get("origin");
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Synapse-Token, X-Synapse-Shared-Secret"
  );
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("Vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function secretsEqual(
  actual: string | null,
  expected: string | undefined
): Promise<boolean> {
  if (!actual || !expected) {
    return false;
  }
  const [actualHash, expectedHash] = await Promise.all(
    [actual, expected].map((value) =>
      crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
    )
  );
  const left = new Uint8Array(actualHash);
  const right = new Uint8Array(expectedHash);
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return mismatch === 0;
}

function isInternal(pathname: string): boolean {
  return INTERNAL_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

async function authorizeInternal(
  request: Request,
  env: SynapseEnv,
  pathname: string
): Promise<Response | null> {
  if (!isInternal(pathname)) {
    return null;
  }

  const suppliedIngress = request.headers.get("X-Synapse-Token");
  const authorization = request.headers.get("Authorization");
  const suppliedWrite =
    request.headers.get("X-Synapse-Shared-Secret") ??
    (authorization?.startsWith("Bearer ") ? authorization.slice(7) : null);

  if (pathname === "/compare/elevar" && request.method === "POST") {
    if (!env.SYNAPSE_WRITE_SHARED_SECRET) {
      return json(
        { ok: false, error: "Write secret is not configured" },
        503
      );
    }
    return (await secretsEqual(suppliedWrite, env.SYNAPSE_WRITE_SHARED_SECRET))
      ? null
      : json({ ok: false, error: "Unauthorized" }, 401);
  }

  if (!env.SYNAPSE_INGRESS_TOKEN) {
    return json(
      { ok: false, error: "Internal API token is not configured" },
      503
    );
  }
  return (await secretsEqual(suppliedIngress, env.SYNAPSE_INGRESS_TOKEN))
    ? null
    : json({ ok: false, error: "Unauthorized" }, 401);
}

function rateLimit(request: Request, env: SynapseEnv): Response | null {
  const now = Date.now();
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const limit = parsePositiveInt(
    env.PUBLIC_EVENT_RATE_LIMIT_PER_MINUTE,
    120
  );
  const previous = rateState.get(ip);
  if (!previous || now - previous.startedAt >= 60_000) {
    rateState.set(ip, { startedAt: now, count: 1 });
    return null;
  }
  if (previous.count >= limit) {
    return json({ ok: false, error: "Rate limit exceeded" }, 429);
  }
  previous.count += 1;
  if (rateState.size > 2048) {
    for (const [key, entry] of rateState) {
      if (now - entry.startedAt > 120_000) {
        rateState.delete(key);
      }
    }
  }
  return null;
}

async function parseJsonBody(
  request: Request,
  maxBytes: number
): Promise<{ rawBody: string; payload: unknown } | Response> {
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
    return json({ ok: false, error: "Content-Type must be application/json" }, 415);
  }
  const contentLength = Number.parseInt(
    request.headers.get("content-length") ?? "0",
    10
  );
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return json({ ok: false, error: "Payload too large" }, 413);
  }
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > maxBytes) {
    return json({ ok: false, error: "Payload too large" }, 413);
  }
  try {
    return { rawBody, payload: JSON.parse(rawBody) as unknown };
  } catch {
    return json({ ok: false, error: "Invalid JSON payload" }, 400);
  }
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function stringValue(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }
  const result = String(value).trim();
  return result.length > 0 ? result : null;
}

function runtimeMode(env: SynapseEnv): "shadow_compare" | "forward" {
  return env.RUNTIME_MODE === "forward" ? "forward" : "shadow_compare";
}

async function handlePublicEvent(
  request: Request,
  env: SynapseEnv
): Promise<Response> {
  const origin = request.headers.get("origin")?.toLowerCase() ?? null;
  if (!origin || !allowedOrigins(env).includes(origin)) {
    return withCors(
      json({ ok: false, error: "Origin not allowed" }, 403),
      request,
      origin ?? undefined
    );
  }
  if (request.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }), request, origin);
  }
  const limited = rateLimit(request, env);
  if (limited) {
    return withCors(limited, request, origin);
  }
  const parsed = await parseJsonBody(
    request,
    parsePositiveInt(env.PUBLIC_EVENT_MAX_BODY_BYTES, 16_384)
  );
  if (parsed instanceof Response) {
    return withCors(parsed, request, origin);
  }

  const body = asRecord(parsed.payload);
  const eventName =
    stringValue(body.event_name ?? body.event ?? body.name) ?? "unknown";
  const eventId = stringValue(body.event_id ?? body.eventId);
  const source = stringValue(body.source) ?? "storefront";
  const store = createStore(env);
  const dedupeKey = eventId ? `${eventName}:${eventId}` : null;
  if (
    dedupeKey &&
    !(await store.claimKey(dedupeKey, "runtime", 5 * 60_000))
  ) {
    await store.recordRuntime({
      eventName,
      eventId,
      source,
      status: "duplicate",
      reason: "duplicate_event_id",
      payloadJson: null
    });
    return withCors(
      json({ ok: true, accepted: false, status: "duplicate" }),
      request,
      origin
    );
  }

  const observation = observationFromPayload("synapse", parsed.payload);
  if (
    observation.transactionId !== "unknown-order" &&
    (observation.eventName === "purchase" ||
      observation.eventName === "refund")
  ) {
    await store.upsertObservation(observation);
  }
  await store.recordRuntime({
    eventName,
    eventId,
    source,
    status: "accepted",
    reason: runtimeMode(env),
    payloadJson: redactPayloadJson(parsed.payload)
  });
  return withCors(
    json({
      ok: true,
      accepted: true,
      eventId: eventId ?? crypto.randomUUID(),
      runtime_mode: runtimeMode(env),
      receivedAt: new Date().toISOString()
    }),
    request,
    origin
  );
}

async function forwardToGtm(
  payload: SynapseEventPayload,
  env: SynapseEnv
): Promise<{ ok: true } | { ok: false; status: number | null; error: string }> {
  if (!env.GTM_SERVER_URL) {
    return { ok: false, status: null, error: "GTM_SERVER_URL is not configured" };
  }
  let lastStatus: number | null = null;
  let lastError = "Unknown GTM forwarding error";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const headers = new Headers({ "Content-Type": "application/json" });
      if (env.GTM_SHARED_SECRET) {
        headers.set("X-Synapse-Token", env.GTM_SHARED_SECRET);
      }
      const response = await fetch(env.GTM_SERVER_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000)
      });
      lastStatus = response.status;
      if (response.ok) {
        return { ok: true };
      }
      lastError = `GTM returned HTTP ${response.status}`;
      if (response.status < 500 && response.status !== 429) {
        break;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 300));
    }
  }
  return { ok: false, status: lastStatus, error: lastError };
}

function baseReceipt(
  request: Request,
  path: string,
  rawBody: string,
  status: WebhookStatus
): WebhookReceiptInput {
  const id = crypto.randomUUID();
  const topic = request.headers.get("X-Shopify-Topic")?.toLowerCase() ?? "unknown";
  const shop =
    request.headers.get("X-Shopify-Shop-Domain")?.toLowerCase() ?? "unknown";
  const webhookId = request.headers.get("X-Shopify-Webhook-Id");
  return {
    id,
    idempotencyKey: webhookId ?? `${topic}:${id}`,
    shop,
    topic,
    webhookId,
    path,
    status,
    orderRef: null,
    eventId: null,
    transactionId: null,
    payloadJson: rawBody ? redactPayloadJson(JSON.parse(rawBody) as unknown) : "{}",
    normalizedPayloadJson: null,
    errorMessage: null,
    receivedAt: new Date().toISOString(),
    processedAt: null
  };
}

async function handleShopifyWebhook(
  request: Request,
  env: SynapseEnv,
  pathname: string
): Promise<Response> {
  const store = createStore(env);
  const parsed = await parseJsonBody(request, 1_048_576);
  if (parsed instanceof Response) {
    return parsed;
  }
  let receipt: WebhookReceiptInput;
  try {
    receipt = baseReceipt(request, pathname, parsed.rawBody, "received");
  } catch {
    return json({ ok: false, error: "Invalid JSON payload" }, 400);
  }

  if (!env.SHOPIFY_WEBHOOK_SECRET) {
    receipt.status = "invalid_signature";
    receipt.errorMessage = "Webhook secret is not configured";
    await store.recordWebhook(receipt);
    return json({ ok: false, error: "Webhook verification unavailable" }, 503);
  }
  if (
    !(await verifyShopifyHmac(
      parsed.rawBody,
      request.headers.get("X-Shopify-Hmac-Sha256"),
      env.SHOPIFY_WEBHOOK_SECRET
    ))
  ) {
    receipt.status = "invalid_signature";
    receipt.errorMessage = "Invalid Shopify webhook signature";
    await store.recordWebhook(receipt);
    return json({ ok: false, error: "Invalid Shopify webhook signature" }, 401);
  }

  const expectedShop = (
    env.SHOPIFY_SHOP_DOMAIN ?? "gcw-dev.myshopify.com"
  ).toLowerCase();
  if (receipt.shop !== expectedShop) {
    receipt.status = "rejected_shop";
    receipt.errorMessage = "Unexpected Shopify shop";
    await store.recordWebhook(receipt);
    return json({ ok: false, error: "Unexpected Shopify shop" }, 403);
  }
  const expectedTopic = WEBHOOK_TOPICS[pathname];
  if (!expectedTopic || receipt.topic !== expectedTopic) {
    receipt.status = "rejected_topic";
    receipt.errorMessage = `Expected topic ${expectedTopic ?? "none"}`;
    await store.recordWebhook(receipt);
    return json({ ok: false, error: "Shopify topic mismatch" }, 415);
  }

  const body = asRecord(parsed.payload);
  const orderRef =
    stringValue(body.order_number ?? body.order_id ?? body.name) ?? "unknown";
  receipt.orderRef = orderRef;
  receipt.idempotencyKey =
    receipt.webhookId ?? `${receipt.topic}:${orderRef}`;
  await store.recordWebhook(receipt);

  if (
    !(await store.claimKey(
      receipt.idempotencyKey,
      "webhook",
      parsePositiveInt(env.WEBHOOK_REPLAY_TTL_MS, 600_000)
    ))
  ) {
    await store.updateWebhook(receipt.id, "duplicate_ignored");
    return json({ ok: true, status: "duplicate_ignored" });
  }

  const eventId =
    receipt.webhookId ??
    (await deterministicEventId([
      receipt.shop,
      receipt.topic,
      body.order_number ?? body.order_id,
      body.name ?? body.order_name
    ]));
  let payload: SynapseEventPayload;
  try {
    payload =
      receipt.topic === "refunds/create"
        ? mapRefundToRefundEvent(body as ShopifyRefund, "USD", eventId)
        : mapOrderToPurchase(body as ShopifyOrder, "USD", eventId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await store.updateWebhook(receipt.id, "invalid_json", {
      eventId,
      errorMessage: message
    });
    return json({ ok: false, error: "Unsupported Shopify payload" }, 400);
  }

  const safePayload = redactPayloadJson(payload);
  if (runtimeMode(env) === "shadow_compare") {
    await store.upsertObservation(observationFromSynapse(payload));
    await store.updateWebhook(receipt.id, "shadow_captured", {
      eventId,
      transactionId: payload.transaction_id,
      normalizedPayloadJson: safePayload
    });
    console.log(
      JSON.stringify({
        event: "shopify_webhook_processed",
        shop: receipt.shop,
        topic: receipt.topic,
        status: "shadow_captured",
        transaction_id: payload.transaction_id,
        event_id: eventId
      })
    );
    return json({ ok: true, status: "shadow_captured_no_forward" });
  }

  const forwarded = await forwardToGtm(payload, env);
  if (!forwarded.ok) {
    await store.addDeadLetter({
      attempt: 3,
      httpStatus: forwarded.status,
      errorMessage: forwarded.error,
      eventName: payload.event_name,
      eventId,
      transactionId: payload.transaction_id,
      payloadJson: safePayload
    });
    await store.updateWebhook(receipt.id, "forward_failed", {
      eventId,
      transactionId: payload.transaction_id,
      normalizedPayloadJson: safePayload,
      errorMessage: forwarded.error
    });
    return json({ ok: false, error: "Failed to forward event" }, 502);
  }
  await store.updateWebhook(receipt.id, "forwarded", {
    eventId,
    transactionId: payload.transaction_id,
    normalizedPayloadJson: safePayload
  });
  return json({ ok: true, status: "forwarded" });
}

function parityModel(
  counts: {
    paired_events: number;
    matched_pairs: number;
    mismatched_pairs: number;
  },
  threshold: number
) {
  const mismatchRate =
    counts.paired_events > 0
      ? (counts.mismatched_pairs / counts.paired_events) * 100
      : 0;
  const matchedRate =
    counts.paired_events > 0
      ? (counts.matched_pairs / counts.paired_events) * 100
      : 0;
  return {
    status: mismatchRate > threshold ? "alert" : "ok",
    threshold_pct: threshold,
    mismatch_rate_pct: Number(mismatchRate.toFixed(2)),
    matched_rate_pct: Number(matchedRate.toFixed(2)),
    paired_events: counts.paired_events,
    total_pairs: counts.paired_events,
    alert_triggered: mismatchRate > threshold
  };
}

async function buildReadiness(env: SynapseEnv) {
  const store = createStore(env);
  const dbHealthy = await store.ping();
  const summary = await store.paritySummary();
  const threshold = parseNumber(env.SHADOW_COMPARE_MISMATCH_ALERT_PCT, 5);
  const parity = parityModel(summary.counts, threshold);
  const metrics = await store.webhookMetrics();
  const channelSummary = await store.channelSummary(
    parsePositiveInt(env.CHANNEL_HEALTH_STALE_MINUTES, 90),
    parseNumber(env.CHANNEL_HEALTH_WARN_FAILURE_PCT, 5)
  );
  const topicHealth = await store.requiredTopicHealth(
    env.SHOPIFY_SHOP_DOMAIN ?? "gcw-dev.myshopify.com",
    parsePositiveInt(env.CHANNEL_HEALTH_STALE_MINUTES, 90)
  );
  const minPairs = parsePositiveInt(env.LAUNCH_MIN_PAIRED_EVENTS, 10);
  const maxWarnings = parsePositiveInt(
    env.LAUNCH_MAX_WARNING_CHANNELS,
    0
  );
  const maxWebhookFailure = parseNumber(
    env.LAUNCH_MAX_WEBHOOK_FAILURE_RATE_PCT,
    2
  );
  const failures =
    metrics.webhooks_invalid_signature +
    metrics.webhooks_invalid_json +
    metrics.webhooks_rejected_topic +
    metrics.webhooks_forward_failed;
  const failureRate =
    metrics.webhooks_received > 0
      ? (failures / metrics.webhooks_received) * 100
      : 0;
  const checks = [
    {
      id: "runtime_mode",
      title: "Runtime mode",
      status: runtimeMode(env) === "shadow_compare" ? "pass" : "fail",
      value: runtimeMode(env),
      target: "shadow_compare",
      recommendation: "Keep gcw-dev in shadow_compare during validation."
    },
    {
      id: "database",
      title: "D1 persistence",
      status: dbHealthy ? "pass" : "fail",
      value: dbHealthy ? "connected" : "unavailable",
      target: "connected",
      recommendation: "Apply D1 migrations and verify the DB binding."
    },
    {
      id: "paired_events",
      title: "Real paired events",
      status: summary.counts.paired_events >= minPairs ? "pass" : "fail",
      value: String(summary.counts.paired_events),
      target: `>= ${minPairs}`,
      recommendation: "Capture matching Synapse and Elevar purchases."
    },
    {
      id: "parity",
      title: "Payload mismatch rate",
      status:
        summary.counts.paired_events > 0 && !parity.alert_triggered
          ? "pass"
          : "fail",
      value: `${parity.mismatch_rate_pct.toFixed(2)}%`,
      target: `<= ${threshold}% with nonzero pairs`,
      recommendation: "Resolve field-level mismatches before cutover."
    },
    {
      id: "required_topics",
      title: "Required Shopify topics",
      status: topicHealth.every((item) => item.fresh) ? "pass" : "fail",
      value: `${topicHealth.filter((item) => item.fresh).length}/${topicHealth.length} fresh`,
      target: `${topicHealth.length}/${topicHealth.length} fresh`,
      recommendation: "Send recent signed gcw-dev order and refund webhooks."
    },
    {
      id: "channel_coverage",
      title: "Channel telemetry",
      status:
        channelSummary.totals.tracked_integrations > 0 &&
        channelSummary.totals.critical === 0 &&
        channelSummary.totals.warning <= maxWarnings
          ? "pass"
          : "fail",
      value: `${channelSummary.totals.tracked_integrations} tracked, ${channelSummary.totals.warning} warning`,
      target: `>= 1 tracked, <= ${maxWarnings} warning, 0 critical`,
      recommendation: "Feed destination health telemetry and clear warnings."
    },
    {
      id: "webhook_failure_rate",
      title: "Webhook failure rate",
      status:
        metrics.webhooks_received > 0 && failureRate <= maxWebhookFailure
          ? "pass"
          : "fail",
      value: `${failureRate.toFixed(2)}%`,
      target: `<= ${maxWebhookFailure}% with received traffic`,
      recommendation: "Resolve signature, topic, and forwarding failures."
    }
  ];
  const failed = checks.filter((check) => check.status === "fail").length;
  return {
    status: failed === 0 ? "go" : "hold",
    phase: "validation",
    summary: { checks_passed: checks.length - failed, checks_failed: failed },
    checks,
    parity,
    counts: summary.counts,
    topic_health: topicHealth,
    channels: channelSummary,
    metrics,
    generated_at: new Date().toISOString(),
    actions: checks
      .filter((check) => check.status === "fail")
      .map((check) => check.recommendation)
  };
}

async function handleCompare(
  request: Request,
  env: SynapseEnv,
  pathname: string
): Promise<Response | null> {
  const store = createStore(env);
  if (pathname === "/compare/elevar" && request.method === "POST") {
    const parsed = await parseJsonBody(request, 262_144);
    if (parsed instanceof Response) {
      return parsed;
    }
    const observation = observationFromPayload("elevar", parsed.payload);
    if (observation.transactionId === "unknown-order") {
      return json(
        { ok: false, error: "transaction_id is required for parity" },
        400
      );
    }
    await store.upsertObservation(observation);
    const comparison = (await store.comparisons(500)).find(
      (item) => item.key === observation.compareKey
    );
    return json(
      {
        ok: true,
        status: "baseline_received",
        runtime_mode: runtimeMode(env),
        key: observation.compareKey,
        comparison_type: comparison?.type ?? "elevar_only",
        diffs: comparison?.diffs ?? []
      },
      202
    );
  }
  if (pathname === "/compare/summary" && request.method === "GET") {
    return json({
      ok: true,
      source_of_truth: "d1",
      runtime_mode: runtimeMode(env),
      summary: await store.paritySummary()
    });
  }
  if (pathname === "/compare/parity" && request.method === "GET") {
    const summary = await store.paritySummary();
    return json({
      ok: true,
      source_of_truth: "d1",
      runtime_mode: runtimeMode(env),
      parity: parityModel(
        summary.counts,
        parseNumber(env.SHADOW_COMPARE_MISMATCH_ALERT_PCT, 5)
      ),
      counts: summary.counts,
      mismatches_preview: summary.mismatches_preview
    });
  }
  if (
    pathname === "/compare/channel-event" &&
    request.method === "POST"
  ) {
    const parsed = await parseJsonBody(request, 65_536);
    if (parsed instanceof Response) {
      return parsed;
    }
    const body = asRecord(parsed.payload);
    const channel = stringValue(body.channel);
    const surface = stringValue(body.surface);
    const destination = stringValue(body.destination);
    const eventName = stringValue(body.event_name);
    const status = stringValue(body.status);
    if (
      !channel ||
      !surface ||
      !destination ||
      !eventName ||
      (status !== "ok" && status !== "error")
    ) {
      return json({ ok: false, error: "Invalid channel event" }, 400);
    }
    await store.recordChannel({
      channel,
      surface,
      destination,
      pixelId: stringValue(body.pixel_id),
      eventName,
      transactionId: stringValue(body.transaction_id),
      status,
      errorMessage: stringValue(body.error_message),
      observedAt:
        stringValue(body.observed_at) ?? new Date().toISOString()
    });
    return json({ ok: true, status: "channel_event_recorded" }, 202);
  }
  if (pathname === "/compare/channels" && request.method === "GET") {
    return json({
      ok: true,
      runtime_mode: runtimeMode(env),
      summary: await store.channelSummary(
        parsePositiveInt(env.CHANNEL_HEALTH_STALE_MINUTES, 90),
        parseNumber(env.CHANNEL_HEALTH_WARN_FAILURE_PCT, 5)
      )
    });
  }
  if (pathname === "/compare/recent" && request.method === "GET") {
    const events = await store.comparisons(
      clampLimit(new URL(request.url).searchParams.get("limit"))
    );
    return json({
      ok: true,
      runtime_mode: runtimeMode(env),
      count: events.length,
      events
    });
  }
  if (pathname === "/compare/ui-model" && request.method === "GET") {
    const readiness = await buildReadiness(env);
    const comparisons = await store.comparisons(100);
    return json({
      ok: true,
      source_of_truth: "d1",
      runtime_mode: runtimeMode(env),
      parity: readiness.parity,
      parity_counts: readiness.counts,
      parity_mismatches_preview: comparisons.filter(
        (item) => item.type === "mismatched"
      ),
      channels: readiness.channels,
      launch_readiness: readiness,
      recent: { shadow_events: comparisons }
    });
  }
  return null;
}

async function handleNative(
  request: Request,
  env: SynapseEnv
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const store = createStore(env);

  if (path === "/health" && request.method === "GET") {
    const dbConnected = await store.ping();
    return json({
      ok: dbConnected,
      service: "gcw-synapse-super-edge",
      runtime_mode: runtimeMode(env),
      database: dbConnected ? "connected" : "unavailable"
    }, dbConnected ? 200 : 503);
  }

  const compareResponse = await handleCompare(request, env, path);
  if (compareResponse) {
    return compareResponse;
  }

  if (path === "/launch/readiness" && request.method === "GET") {
    return json({
      ok: true,
      source_of_truth: "d1",
      runtime_mode: runtimeMode(env),
      report: await buildReadiness(env)
    });
  }
  if (path === "/api/status" && request.method === "GET") {
    const [dbConnected, metrics, runtime] = await Promise.all([
      store.ping(),
      store.webhookMetrics(),
      store.runtimeSummary()
    ]);
    return json({
      status: dbConnected ? "ok" : "error",
      webhooksReceived: metrics.webhooks_received,
      eventsGenerated:
        metrics.webhooks_shadow_captured +
        metrics.webhooks_forwarded +
        runtime.accepted,
      dbConnected,
      uptime: Math.max(1, Math.floor((Date.now() - workerStartedAt) / 1000)),
      runtimeMode: runtimeMode(env),
      vendorAdapters: getControlPanelVendors()
    });
  }
  if (path === "/runtime/summary" && request.method === "GET") {
    return json({ ok: true, telemetry: await store.runtimeSummary() });
  }
  if (path === "/runtime/recent" && request.method === "GET") {
    return json({
      ok: true,
      events: await store.listRuntime(clampLimit(url.searchParams.get("limit")))
    });
  }
  if (path === "/api/webhooks/log" && request.method === "GET") {
    return json(
      await store.listWebhooks(clampLimit(url.searchParams.get("limit"), 50))
    );
  }
  if (path === "/api/shadow/comparisons" && request.method === "GET") {
    return json(
      await store.comparisons(clampLimit(url.searchParams.get("limit"), 50))
    );
  }
  if (path === "/api/shadow/stats" && request.method === "GET") {
    const comparisons = await store.comparisons(5000);
    const counts = await store.paritySummary();
    const paired = comparisons.filter(
      (item) => item.type === "matched" || item.type === "mismatched"
    );
    const average =
      paired.length > 0
        ? paired.reduce((sum, item) => sum + item.score, 0) / paired.length
        : 0;
    return json({
      totalComparisons: paired.length,
      avgMatchScore: Number(average.toFixed(2)),
      eventBreakdown: [
        { event: "paired", count: counts.counts.paired_events },
        { event: "matched", count: counts.counts.matched_pairs },
        { event: "mismatched", count: counts.counts.mismatched_pairs },
        { event: "synapse_only", count: counts.counts.synapse_only },
        { event: "elevar_only", count: counts.counts.elevar_only }
      ]
    });
  }
  if (path === "/api/events/schemas" && request.method === "GET") {
    return json(getControlPanelSchemas());
  }
  if (path === "/api/vendors/matrix" && request.method === "GET") {
    return json(getControlPanelVendors());
  }
  if (path === "/api/qa/checklist" && request.method === "GET") {
    const readiness = await buildReadiness(env);
    const statuses = new Map(
      readiness.checks.map((check) => [check.id, check.status])
    );
    return json(
      getControlPanelChecklist().map((item) => ({
        ...item,
        status:
          statuses.get(item.id) ??
          (readiness.status === "go" ? "pass" : item.status)
      }))
    );
  }
  if (path === "/api/qa/smoke" && request.method === "POST") {
    const started = Date.now();
    const readiness = await buildReadiness(env);
    const results = [
      {
        name: "D1 persistence connected",
        passed: readiness.checks.find((item) => item.id === "database")?.status === "pass",
        durationMs: Date.now() - started,
        error: null,
        detail: {}
      },
      {
        name: "Launch gate is truthful",
        passed:
          readiness.counts.paired_events > 0
            ? true
            : readiness.status === "hold",
        durationMs: Date.now() - started,
        error: null,
        detail: { paired_events: readiness.counts.paired_events }
      }
    ];
    return json({
      status: results.every((item) => item.passed) ? "ok" : "warning",
      runAt: new Date().toISOString(),
      passed: results.filter((item) => item.passed).length,
      failed: results.filter((item) => !item.passed).length,
      total: results.length,
      results
    });
  }
  if (path === "/ops/dead-letter" && request.method === "GET") {
    return json({
      ok: true,
      summary: await store.deadLetterSummary(),
      replay: { status: "not_enabled_in_shadow_compare" }
    });
  }
  if (path === "/ops/shopify-install-status" && request.method === "GET") {
    return json({
      status: {
        installed_shops: await store.installedShops(),
        store_path: "cloudflare-d1-webhook-evidence"
      }
    });
  }
  if (path === "/ops/shopify-app" && request.method === "GET") {
    return json({
      ok: true,
      app: {
        configured: Boolean(env.SHOPIFY_WEBHOOK_SECRET),
        shop_domain: env.SHOPIFY_SHOP_DOMAIN ?? "gcw-dev.myshopify.com",
        webhook_verification: env.SHOPIFY_WEBHOOK_SECRET
          ? "required"
          : "unavailable"
      }
    });
  }
  if (path === "/ops/alerts" && request.method === "GET") {
    const readiness = await buildReadiness(env);
    return json({
      ok: true,
      status: readiness.status === "go" ? "ok" : "warning",
      generated_at: new Date().toISOString(),
      alerts: readiness.checks
        .filter((item) => item.status === "fail")
        .map((item) => ({
          severity: "warning",
          title: item.title,
          message: `${item.value}; target ${item.target}`,
          action: item.recommendation
        }))
    });
  }
  if (path === "/api/advisor/alerts" && request.method === "GET") {
    const readiness = await buildReadiness(env);
    return json({
      alerts: readiness.checks
        .filter((item) => item.status === "fail")
        .map((item) => ({
          severity: "warning",
          title: item.title,
          message: `${item.value}; target ${item.target}`,
          action: item.recommendation
        }))
    });
  }
  if (path === "/api/advisor/chat" && request.method === "POST") {
    const readiness = await buildReadiness(env);
    return json({
      answer:
        readiness.status === "go"
          ? "Validation gates are green. Review the cutover checklist before changing forward mode."
          : `Synapse is correctly holding launch. ${readiness.actions.join(" ")}`,
      model: "deterministic-readiness-advisor",
      fallback_used: false,
      local_ai_enabled: false,
      used_tools: ["d1-readiness", "parity", "webhook-health"],
      alerts: readiness.checks
        .filter((item) => item.status === "fail")
        .map((item) => ({
          severity: "warning",
          title: item.title,
          message: `${item.value}; target ${item.target}`,
          action: item.recommendation
        }))
    });
  }
  if (path === "/ops/dashboard" && request.method === "GET") {
    const readiness = await buildReadiness(env);
    return json({
      ok: true,
      status: readiness.status,
      generated_at: new Date().toISOString(),
      readiness,
      dead_letter: await store.deadLetterSummary()
    });
  }
  if (
    (path.startsWith("/auth/") || path.startsWith("/compatibility/")) &&
    !env.SYNAPSE_ORIGIN_URL
  ) {
    return json(
      {
        ok: false,
        error: "This route requires the optional Synapse origin",
        mode: "edge-only"
      },
      501
    );
  }
  return null;
}

async function proxy(request: Request, env: SynapseEnv): Promise<Response> {
  if (!env.SYNAPSE_ORIGIN_URL) {
    return json({ ok: false, error: "Synapse origin is not configured" }, 501);
  }
  const incoming = new URL(request.url);
  const target = new URL(
    `${incoming.pathname}${incoming.search}`,
    env.SYNAPSE_ORIGIN_URL
  );
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("cf-connecting-ip");
  if (env.SYNAPSE_INGRESS_TOKEN) {
    headers.set("X-Synapse-Token", env.SYNAPSE_INGRESS_TOKEN);
  }
  return fetch(target, {
    method: request.method,
    headers,
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : request.body,
    redirect: "manual"
  });
}

async function asset(request: Request, env: SynapseEnv): Promise<Response> {
  const response = await env.ASSETS.fetch(request);
  if (response.status !== 404) {
    return response;
  }
  const url = new URL(request.url);
  if (!(request.headers.get("accept") ?? "").includes("text/html") || url.pathname.includes(".")) {
    return response;
  }
  return env.ASSETS.fetch(
    new Request(new URL("/index.html", url.origin).toString(), request)
  );
}

export default {
  async fetch(request: Request, env: SynapseEnv): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      if (path === "/event" && (request.method === "POST" || request.method === "OPTIONS")) {
        return securityHeaders(await handlePublicEvent(request, env));
      }
      if (request.method === "POST" && WEBHOOK_TOPICS[path]) {
        return securityHeaders(await handleShopifyWebhook(request, env, path));
      }

      const unauthorized = await authorizeInternal(request, env, path);
      if (unauthorized) {
        return securityHeaders(unauthorized);
      }

      const native = await handleNative(request, env);
      if (native) {
        return securityHeaders(native);
      }
      if (PROXY_PREFIXES.some((prefix) => path.startsWith(prefix))) {
        return securityHeaders(await proxy(request, env));
      }
      return securityHeaders(await asset(request, env));
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "worker_request_failed",
          error: error instanceof Error ? error.message : String(error)
        })
      );
      return securityHeaders(
        json({ ok: false, error: "Internal server error" }, 500)
      );
    }
  },

  async scheduled(
    _controller: ScheduledController,
    env: SynapseEnv,
    _ctx: ExecutionContext
  ): Promise<void> {
    const now = Date.now();
    await createStore(env).pruneExpired(now);
    await env.DB.batch([
      env.DB
        .prepare("DELETE FROM runtime_telemetry WHERE recorded_at < ?1")
        .bind(new Date(now - 14 * 86_400_000).toISOString()),
      env.DB
        .prepare("DELETE FROM channel_events WHERE observed_at < ?1")
        .bind(new Date(now - 30 * 86_400_000).toISOString()),
      env.DB
        .prepare("DELETE FROM observations WHERE observed_at < ?1")
        .bind(new Date(now - 45 * 86_400_000).toISOString()),
      env.DB
        .prepare("DELETE FROM webhook_receipts WHERE received_at < ?1")
        .bind(new Date(now - 90 * 86_400_000).toISOString())
    ]);
  }
};

export { buildReadiness };
export type { ComparisonRecord };
