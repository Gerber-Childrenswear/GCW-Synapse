import express from "express";
import { env } from "./config/env";
import { createIngressTokenMiddleware } from "./lib/ingressAuth";
import { createPublicEventGuard, parseAllowedOrigins } from "./lib/publicEventGuard";
import { securityHeaders } from "./lib/securityHeaders";
import { logError, logInfo } from "./lib/logger";
import { refundsRouter } from "./routes/refunds";
import { webhooksRouter } from "./routes/webhooks";
import { resolveCartTotal } from "./services/cartTotal";
import {
  type ChannelEventInput,
  getChannelHealthSummary,
  getChannelHelpLinks,
  getChannelTroubleshooting,
  getRecentChannelEvents,
  ingestChannelEvent
} from "./services/channelHealth";
import {
  resolveAddToCartCompatibility,
  resolveEcommerceImpressions,
  resolveProductViewDetailsArray
} from "./services/catalogCompatibility";
import { resolveCheckoutProducts } from "./services/checkoutProducts";
import { resolveCustomerEmail, resolveCustomerId } from "./services/customerIdentity";
import { resolveCurrencyCode } from "./services/currencyCode";
import { getDeadLetterSummary } from "./services/deadLetter";
import { resolveEventId } from "./services/eventId";
import { forwardToGtmServer } from "./services/gtmForwarder";
import { completeShopifyInstall, getShopifyInstallStatus, startShopifyInstall } from "./services/shopifyAuth";
import { getShopifyAppConfig } from "./services/shopifyApp";
import { resolveGa4MeasurementId } from "./services/ga4Measurement";
import { getMetricsSnapshot, incrementCounter } from "./services/metrics";
import { buildOpsAlerts } from "./services/opsAlerts";
import { evaluateLaunchGuard } from "./services/launchGuard";
import { buildLaunchReadinessReport } from "./services/launchReadiness";
import { resolveOrderId } from "./services/orderId";
import { resolveOrderRevenue } from "./services/orderRevenue";
import { resolveProductIdentifier } from "./services/productIdentifier";
import { resolvePurchaseProducts } from "./services/purchaseProducts";
import { resolveSearchTerm } from "./services/searchTerm";
import {
  configureShadowCompare,
  getRecentShadowEvents,
  getShadowParityReport,
  getShadowCompareSummary,
  ingestElevarShadow
} from "./services/shadowCompare";
import {
  getCanonicalEventCatalog,
  getControlPanelChecklist,
  getControlPanelSchemas,
  getControlPanelVendors,
  getThemeAdapterCoverage,
  getThemeAdapterProfiles
} from "./services/controlPanelData";
import { summarizeThemeAdapterReadiness } from "./services/controlPanelData";
import { runQaSmokeTests } from "./services/qaSmoke";
import { resolveVisitorType } from "./services/visitorType";
import { normalizeCustomerPhone } from "./services/customerPhone";
import {
  getRuntimeTelemetry,
  getRuntimeTelemetrySummary,
  isRuntimeDuplicate,
  parseRuntimeEvent,
  recordRuntimeTelemetry
} from "./services/runtimeEvents";
import { evaluateRuntimeEventPolicy } from "./services/runtimeEventPolicy";
import { buildAdvisorAlerts, getAdvisorAnswer } from "./services/localAdvisor";
import { configureMappingRegistry, getMappingRegistry, replaceMappingRegistry } from "./services/mappingRegistry";
import { validateRuntimeEventAgainstCatalog } from "./services/runtimeCatalogValidation";
import { buildPlaceholderMatrixReport } from "./services/gtmPlaceholderMatrix";
import { buildWeekendMonitorSummary } from "./services/weekendMonitor";
import { getGtmCompatibilityMatrix, getTopPriorityCompatibilityGaps } from "./services/gtmCompatibilityMatrix";
import {
  getCompatibilityUsageByEndpoint,
  getCompatibilityUsageSummary,
  getCompatibilityUsageTrend,
  recordCompatibilityUsage
} from "./services/compatibilityUsage";
import { buildCompatibilityFailureDiagnostics } from "./services/compatibilityDiagnostics";
import { resolveProductGroup } from "./services/productGroup";
import { resolvePageTitle } from "./services/pageTitle";
import { buildGtmGoLiveGateReport, normalizeGtmGoLiveThresholds } from "./services/gtmGoLiveGate";

const app = express();
app.disable("x-powered-by");
app.use(securityHeaders);
const requireIngressToken = createIngressTokenMiddleware(env.INGRESS_SHARED_TOKEN);
const publicEventGuard = createPublicEventGuard({
  rateLimitPerMinute: env.PUBLIC_EVENT_RATE_LIMIT_PER_MINUTE,
  allowedOrigins: parseAllowedOrigins(env.PUBLIC_EVENT_ALLOWED_ORIGINS)
});

configureShadowCompare({
  runtimeMode: env.RUNTIME_MODE,
  maxRecords: env.SHADOW_COMPARE_MAX_RECORDS,
  storePath: env.SHADOW_COMPARE_STORE_PATH
});

configureMappingRegistry({
  storePath: env.CONTROL_PANEL_MAPPING_STORE_PATH
});

type CompatibilityLineItem = {
  sku?: string;
  product_id?: number;
  variant_id?: number;
  variant_title?: string;
  product_type?: string;
  title: string;
  price: string;
  quantity: number;
};

function parseLineItemsJson(lineItemsRaw: string): CompatibilityLineItem[] {
  const parsed = JSON.parse(lineItemsRaw) as unknown;
  return Array.isArray(parsed) ? (parsed as CompatibilityLineItem[]) : [];
}

function buildAdvisorContext() {
  const metrics = getMetricsSnapshot();
  const runtimeTelemetry = getRuntimeTelemetrySummary();
  const deadLetter = getDeadLetterSummary(env.GTM_DEAD_LETTER_PATH);

  const ops = buildOpsAlerts({
    counters: {
      webhooks_received: metrics.counters.webhooks_received,
      webhooks_forwarded: metrics.counters.webhooks_forwarded,
      webhooks_forward_failed: metrics.counters.webhooks_forward_failed,
      webhooks_invalid_signature: metrics.counters.webhooks_invalid_signature,
      refunds_received: metrics.counters.refunds_received,
      refunds_forwarded: metrics.counters.refunds_forwarded,
      refunds_forward_failed: metrics.counters.refunds_forward_failed,
      refunds_invalid_signature: metrics.counters.refunds_invalid_signature,
      ingress_token_rejected: metrics.counters.ingress_token_rejected,
      runtime_events_received: metrics.counters.runtime_events_received,
      runtime_events_rejected_invalid_payload: metrics.counters.runtime_events_rejected_invalid_payload,
      runtime_events_forwarded: metrics.counters.runtime_events_forwarded,
      runtime_events_suppressed: metrics.counters.runtime_events_suppressed,
      gtm_dead_letter_written: metrics.counters.gtm_dead_letter_written
    },
    runtimeTelemetry,
    deadLetter
  });

  const paritySummary = getShadowCompareSummary();
  const parity = getShadowParityReport(env.SHADOW_COMPARE_MISMATCH_ALERT_PCT);
  const channelSummary = getChannelHealthSummary(env.CHANNEL_HEALTH_STALE_MINUTES, env.CHANNEL_HEALTH_WARN_FAILURE_PCT);

  const launchReadiness = buildLaunchReadinessReport({
    phase: "validation",
    runtimeMode: env.RUNTIME_MODE,
    parity,
    paritySummary,
    channelSummary,
    metrics: {
      webhooks_received: metrics.counters.webhooks_received,
      webhooks_invalid_signature: metrics.counters.webhooks_invalid_signature,
      webhooks_invalid_json: metrics.counters.webhooks_invalid_json,
      webhooks_rejected_topic: metrics.counters.webhooks_rejected_topic,
      webhooks_forward_failed: metrics.counters.webhooks_forward_failed
    },
    thresholds: {
      minPairedEvents: env.LAUNCH_MIN_PAIRED_EVENTS,
      maxWarningChannels: env.LAUNCH_MAX_WARNING_CHANNELS,
      maxWebhookFailureRatePct: env.LAUNCH_MAX_WEBHOOK_FAILURE_RATE_PCT
    }
  });

  return {
    ops,
    runtime: runtimeTelemetry,
    channels: {
      totals: channelSummary.totals,
      channels: channelSummary.channels.map((item) => {
        const base = {
          key: item.key,
          channel: item.channel,
          surface: item.surface,
          destination: item.destination,
          status: item.status,
          failure_rate_pct: item.failure_rate_pct,
          minutes_since_last_event: item.minutes_since_last_event,
          total_events: item.total_events,
          error_events: item.error_events
        };

        return item.last_error_message
          ? {
              ...base,
              last_error_message: item.last_error_message
            }
          : base;
      })
    },
    parity: {
      status: parity.status,
      mismatch_rate_pct: parity.mismatch_rate_pct,
      threshold_pct: parity.threshold_pct,
      paired_events: parity.paired_events
    },
    launch: {
      status: launchReadiness.status,
      phase: launchReadiness.phase,
      blockers: launchReadiness.checks.filter((check) => check.status === "fail").map((check) => check.title),
      recommendations: launchReadiness.checks
        .filter((check) => check.status === "fail")
        .map((check) => check.recommendation)
    },
    recentRuntimeEvents: getRuntimeTelemetry(25).map((item) => {
      const base = {
        at: item.at,
        event_name: item.event_name,
        status: item.status
      };

      return {
        ...base,
        ...(item.reason ? { reason: item.reason } : {}),
        ...(item.source ? { source: item.source } : {})
      };
    })
  };
}

type ChannelEventRequestBody = {
  channel?: string;
  surface?: "pixel" | "server" | "runtime" | "webhook";
  destination?: string;
  pixel_id?: string;
  event_name?: string;
  event_id?: string;
  transaction_id?: string;
  source_theme?: string;
  source_surface?: string;
  status?: "ok" | "error";
  error_message?: string;
  observed_at?: string;
};

function parseChannelEventBody(body: ChannelEventRequestBody): { event?: ChannelEventInput; error?: string } {
  if (
    !body.channel ||
    (body.surface !== "pixel" && body.surface !== "server" && body.surface !== "runtime" && body.surface !== "webhook") ||
    !body.destination ||
    !body.event_name ||
    (body.status !== "ok" && body.status !== "error")
  ) {
    return {
      error: "channel, surface, destination, event_name, and status are required"
    };
  }

  return {
    event: {
      channel: body.channel,
      surface: body.surface,
      destination: body.destination,
      pixel_id: body.pixel_id,
      event_name: body.event_name,
      event_id: body.event_id,
      transaction_id: body.transaction_id,
      source_theme: body.source_theme,
      source_surface: body.source_surface,
      status: body.status,
      error_message: body.error_message,
      observed_at: body.observed_at
    }
  };
}

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "gcw-synapse" });
});

app.get("/diagnostics", requireIngressToken, (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "gcw-synapse",
    metrics: getMetricsSnapshot()
  });
});

app.get("/runtime/summary", requireIngressToken, (_req, res) => {
  const metrics = getMetricsSnapshot();
  const telemetry = getRuntimeTelemetrySummary();

  res.status(200).json({
    ok: true,
    telemetry,
    commerce_shield: {
      human_sessions: telemetry.forwarded,
      bot_sessions: telemetry.suppressed,
      suppressed_events: metrics.counters.runtime_events_suppressed
    }
  });
});

app.get("/runtime/recent", requireIngressToken, (req, res) => {
  const limitRaw = typeof req.query.limit === "string" ? req.query.limit : "100";
  const parsedLimit = Number.parseInt(limitRaw, 10);
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : 100;

  res.status(200).json({
    ok: true,
    events: getRuntimeTelemetry(limit)
  });
});

app.get("/api/status", requireIngressToken, (_req, res) => {
  const metrics = getMetricsSnapshot();

  res.status(200).json({
    status: "ok",
    webhooksReceived: metrics.counters.webhooks_received,
    eventsGenerated: metrics.counters.runtime_events_forwarded,
    dbConnected: true,
    uptime: Number.parseFloat(process.uptime().toFixed(3)),
    vendorAdapters: getControlPanelVendors()
  });
});

app.get("/api/events/schemas", requireIngressToken, (_req, res) => {
  res.status(200).json(getControlPanelSchemas());
});

app.get("/api/events/catalog", requireIngressToken, (_req, res) => {
  res.status(200).json(getCanonicalEventCatalog());
});

app.get("/api/theme-adapters", requireIngressToken, (_req, res) => {
  res.status(200).json(getThemeAdapterProfiles());
});

app.get("/api/theme-adapters/:key/coverage", requireIngressToken, async (req, res) => {
  const adapterKey = req.params.key;
  if (adapterKey !== "hyper" && adapterKey !== "headless" && adapterKey !== "expanse") {
    res.status(404).json({ ok: false, error: "Unknown adapter" });
    return;
  }

  const registry = await getMappingRegistry();
  const coverage = getThemeAdapterCoverage(adapterKey, registry.mappings);

  if (!coverage) {
    res.status(404).json({ ok: false, error: "Unknown adapter" });
    return;
  }

  res.status(200).json({
    ok: true,
    revision: registry.revision,
    persistence: {
      configured: registry.persistenceConfigured,
      store_path: registry.storePath
    },
    coverage
  });
});

app.get("/api/theme-adapters/:key/summary", requireIngressToken, async (req, res) => {
  const adapterKey = req.params.key;
  if (adapterKey !== "hyper" && adapterKey !== "headless" && adapterKey !== "expanse") {
    res.status(404).json({ ok: false, error: "Unknown adapter" });
    return;
  }

  const registry = await getMappingRegistry();
  const coverage = getThemeAdapterCoverage(adapterKey, registry.mappings);

  if (!coverage) {
    res.status(404).json({ ok: false, error: "Unknown adapter" });
    return;
  }

  const metrics = getMetricsSnapshot();
  const readiness = summarizeThemeAdapterReadiness(coverage, {
    warnings: metrics.counters.runtime_events_validation_warnings,
    errors: metrics.counters.runtime_events_validation_errors
  });

  res.status(200).json({
    ok: true,
    revision: registry.revision,
    coverage: coverage.summary,
    readiness
  });
});

app.get("/api/gtm/placeholders", requireIngressToken, (_req, res) => {
  try {
    const report = buildPlaceholderMatrixReport();
    res.status(200).json({ ok: true, report });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Failed to build placeholder matrix"
    });
  }
});

app.get("/api/gtm/compatibility-matrix", requireIngressToken, (_req, res) => {
  res.status(200).json({ ok: true, entries: getGtmCompatibilityMatrix() });
});

app.get("/api/gtm/compatibility-gaps", requireIngressToken, (req, res) => {
  const limitRaw = typeof req.query.limit === "string" ? req.query.limit : "10";
  const parsedLimit = Number.parseInt(limitRaw, 10);
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : 10;

  res.status(200).json({ ok: true, entries: getTopPriorityCompatibilityGaps(limit) });
});

app.get("/api/gtm/compatibility-usage", requireIngressToken, (_req, res) => {
  res.status(200).json({
    ok: true,
    entries: getCompatibilityUsageSummary(),
    by_endpoint: getCompatibilityUsageByEndpoint()
  });
});

app.get("/api/gtm/compatibility-drilldown", requireIngressToken, (req, res) => {
  const eventFamily = typeof req.query.event_family === "string" ? req.query.event_family : undefined;
  const endpointPath = typeof req.query.endpoint_path === "string" ? req.query.endpoint_path : undefined;
  const limitRaw = typeof req.query.limit === "string" ? req.query.limit : "20";
  const parsedLimit = Number.parseInt(limitRaw, 10);
  const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 100)) : 20;

  const hoursRaw = typeof req.query.window_hours === "string" ? req.query.window_hours : "72";
  const parsedHours = Number.parseInt(hoursRaw, 10);
  const windowHours = Number.isFinite(parsedHours) ? Math.max(1, Math.min(parsedHours, 24 * 14)) : 72;

  const matrix = getGtmCompatibilityMatrix();
  const usageByEndpoint = getCompatibilityUsageByEndpoint();
  const usageMap = new Map(usageByEndpoint.map((row) => [row.endpointPath, row]));

  const filteredHelpers = matrix
    .filter((entry) => !!entry.endpointPath)
    .filter((entry) => (!eventFamily ? true : entry.eventFamilies.includes(eventFamily)))
    .filter((entry) => (!endpointPath ? true : entry.endpointPath === endpointPath))
    .map((entry) => {
      const usage = usageMap.get(entry.endpointPath as string);
      return {
        priority: entry.priority,
        legacyVariable: entry.legacyVariable,
        endpointPath: entry.endpointPath,
        status: entry.status,
        externalRefs: entry.externalRefs,
        eventFamilies: entry.eventFamilies,
        notes: entry.notes,
        usage: usage ?? {
          endpointPath: entry.endpointPath,
          legacyVariable: entry.legacyVariable,
          eventFamilies: entry.eventFamilies,
          okHits: 0,
          errorHits: 0,
          totalHits: 0,
          failureRatePct: 0
        }
      };
    })
    .sort((left, right) => {
      const statusRank = { missing: 0, partial: 1, available: 2 } as const;
      const statusOrder = statusRank[left.status] - statusRank[right.status];
      if (statusOrder !== 0) {
        return statusOrder;
      }

      const priorityRank = { P0: 0, P1: 1, P2: 2, P3: 3 } as const;
      const byPriority = priorityRank[left.priority] - priorityRank[right.priority];
      if (byPriority !== 0) {
        return byPriority;
      }

      if (right.usage.errorHits !== left.usage.errorHits) {
        return right.usage.errorHits - left.usage.errorHits;
      }

      return right.externalRefs - left.externalRefs;
    })
    .slice(0, limit);

  const helperEndpointSet = new Set(filteredHelpers.map((item) => item.endpointPath));
  const trend = getCompatibilityUsageTrend(windowHours).filter((item) => helperEndpointSet.has(item.endpointPath));

  res.status(200).json({
    ok: true,
    filters: {
      event_family: eventFamily,
      endpoint_path: endpointPath,
      limit,
      window_hours: windowHours
    },
    helpers: filteredHelpers,
    trend
  });
});

app.get("/api/gtm/go-live-gate", requireIngressToken, (req, res) => {
  const parseNumber = (value: unknown): number | undefined => {
    if (typeof value !== "string") {
      return undefined;
    }

    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const thresholdOverrides: Partial<ReturnType<typeof normalizeGtmGoLiveThresholds>> = {};

  const minCoveragePct = parseNumber(req.query.min_coverage_pct);
  if (minCoveragePct !== undefined) {
    thresholdOverrides.minCoveragePct = minCoveragePct;
  }

  const maxNonAvailableHelpers = parseNumber(req.query.max_non_available_helpers);
  if (maxNonAvailableHelpers !== undefined) {
    thresholdOverrides.maxNonAvailableHelpers = maxNonAvailableHelpers;
  }

  const minPairedEvents = parseNumber(req.query.min_paired_events);
  if (minPairedEvents !== undefined) {
    thresholdOverrides.minPairedEvents = minPairedEvents;
  }

  const maxMismatchRatePct = parseNumber(req.query.max_mismatch_rate_pct);
  if (maxMismatchRatePct !== undefined) {
    thresholdOverrides.maxMismatchRatePct = maxMismatchRatePct;
  }

  const maxCriticalChannels = parseNumber(req.query.max_critical_channels);
  if (maxCriticalChannels !== undefined) {
    thresholdOverrides.maxCriticalChannels = maxCriticalChannels;
  }

  const maxWarningChannels = parseNumber(req.query.max_warning_channels);
  if (maxWarningChannels !== undefined) {
    thresholdOverrides.maxWarningChannels = maxWarningChannels;
  }

  const maxCompatibilityFailureRatePct = parseNumber(req.query.max_compat_failure_rate_pct);
  if (maxCompatibilityFailureRatePct !== undefined) {
    thresholdOverrides.maxCompatibilityFailureRatePct = maxCompatibilityFailureRatePct;
  }

  const maxCompatibilityErrorHits = parseNumber(req.query.max_compat_error_hits);
  if (maxCompatibilityErrorHits !== undefined) {
    thresholdOverrides.maxCompatibilityErrorHits = maxCompatibilityErrorHits;
  }

  const thresholds = normalizeGtmGoLiveThresholds(thresholdOverrides);

  const matrix = getGtmCompatibilityMatrix();
  const paritySummary = getShadowCompareSummary();
  const parity = getShadowParityReport(env.SHADOW_COMPARE_MISMATCH_ALERT_PCT);
  const channels = getChannelHealthSummary(env.CHANNEL_HEALTH_STALE_MINUTES, env.CHANNEL_HEALTH_WARN_FAILURE_PCT);
  const compatibilityFailures = buildCompatibilityFailureDiagnostics({
    matrix,
    usage: getCompatibilityUsageSummary(),
    limit: 25
  });

  const report = buildGtmGoLiveGateReport({
    thresholds,
    matrix,
    compatibilityFailures,
    parity,
    paritySummary,
    channels
  });

  res.status(200).json({
    ok: true,
    generated_at: new Date().toISOString(),
    thresholds,
    report
  });
});

app.get("/api/monitor/weekend", requireIngressToken, async (_req, res) => {
  try {
    const metrics = getMetricsSnapshot();
    const runtimeTelemetry = getRuntimeTelemetrySummary();
    const deadLetter = getDeadLetterSummary(env.GTM_DEAD_LETTER_PATH);
    const ops = buildOpsAlerts({
      counters: {
        webhooks_received: metrics.counters.webhooks_received,
        webhooks_forwarded: metrics.counters.webhooks_forwarded,
        webhooks_forward_failed: metrics.counters.webhooks_forward_failed,
        webhooks_invalid_signature: metrics.counters.webhooks_invalid_signature,
        refunds_received: metrics.counters.refunds_received,
        refunds_forwarded: metrics.counters.refunds_forwarded,
        refunds_forward_failed: metrics.counters.refunds_forward_failed,
        refunds_invalid_signature: metrics.counters.refunds_invalid_signature,
        ingress_token_rejected: metrics.counters.ingress_token_rejected,
        runtime_events_received: metrics.counters.runtime_events_received,
        runtime_events_rejected_invalid_payload: metrics.counters.runtime_events_rejected_invalid_payload,
        runtime_events_forwarded: metrics.counters.runtime_events_forwarded,
        runtime_events_suppressed: metrics.counters.runtime_events_suppressed,
        gtm_dead_letter_written: metrics.counters.gtm_dead_letter_written
      },
      runtimeTelemetry,
      deadLetter
    });

    const paritySummary = getShadowCompareSummary();
    const parity = getShadowParityReport(env.SHADOW_COMPARE_MISMATCH_ALERT_PCT);
    const registry = await getMappingRegistry();
    const hyperCoverage = getThemeAdapterCoverage("hyper", registry.mappings);
    if (!hyperCoverage) {
      res.status(500).json({ ok: false, error: "Hyper coverage unavailable" });
      return;
    }

    const hyperReadiness = summarizeThemeAdapterReadiness(hyperCoverage, {
      warnings: metrics.counters.runtime_events_validation_warnings,
      errors: metrics.counters.runtime_events_validation_errors
    });

    const channelSummary = getChannelHealthSummary(env.CHANNEL_HEALTH_STALE_MINUTES, env.CHANNEL_HEALTH_WARN_FAILURE_PCT);
    const topChannelIssues = getChannelTroubleshooting(channelSummary);
    const placeholderMatrix = buildPlaceholderMatrixReport();
    const compatibilityFailures = buildCompatibilityFailureDiagnostics({
      matrix: getGtmCompatibilityMatrix(),
      usage: getCompatibilityUsageSummary(),
      limit: 5
    });
    const summary = buildWeekendMonitorSummary({
      parity,
      paritySummary,
      hyper: hyperReadiness,
      placeholderMatrix,
      compatibilityFailures,
      channels: channelSummary,
      topChannelIssues,
      ops
    });

    res.status(200).json({ ok: true, generated_at: new Date().toISOString(), summary });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Failed to build weekend monitor"
    });
  }
});

app.post("/api/events/validate-runtime", requireIngressToken, (req, res) => {
  try {
    const event = parseRuntimeEvent(req.body);
    const validation = validateRuntimeEventAgainstCatalog(event);

    res.status(validation.valid ? 200 : 422).json({
      ok: validation.valid,
      validation
    });
  } catch {
    res.status(400).json({
      ok: false,
      error: "Invalid runtime event payload"
    });
  }
});

app.get("/api/webhooks/log", requireIngressToken, (req, res) => {
  const limitRaw = typeof req.query.limit === "string" ? req.query.limit : "50";
  const parsedLimit = Number.parseInt(limitRaw, 10);
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : 50;

  res.status(200).json(getRuntimeTelemetry(limit));
});

app.get("/api/shadow/stats", requireIngressToken, (_req, res) => {
  const parity = getShadowParityReport(env.SHADOW_COMPARE_MISMATCH_ALERT_PCT);
  const counts = getShadowCompareSummary().counts;

  res.status(200).json({
    totalComparisons: counts.paired_events,
    avgMatchScore: parity.matched_rate_pct,
    eventBreakdown: [
      { event: "paired", count: counts.paired_events },
      { event: "matched", count: counts.matched_pairs },
      { event: "mismatched", count: counts.mismatched_pairs },
      { event: "synapse_only", count: counts.synapse_only },
      { event: "elevar_only", count: counts.elevar_only }
    ]
  });
});

app.get("/api/shadow/comparisons", requireIngressToken, (req, res) => {
  const limitRaw = typeof req.query.limit === "string" ? req.query.limit : "50";
  const parsedLimit = Number.parseInt(limitRaw, 10);
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : 50;

  res.status(200).json(getRecentShadowEvents(limit));
});

app.get("/api/qa/checklist", requireIngressToken, (_req, res) => {
  res.status(200).json(getControlPanelChecklist());
});

app.get("/api/vendors/matrix", requireIngressToken, (_req, res) => {
  res.status(200).json(getControlPanelVendors());
});

async function handleQaSmoke(_req: express.Request, res: express.Response): Promise<void> {
  const result = await runQaSmokeTests();
  res.status(200).json({
    ...result,
    status: result.failed > 0 ? "warning" : "ok",
    runAt: new Date().toISOString()
  });
}

app.get("/api/qa/smoke", requireIngressToken, async (req, res) => {
  await handleQaSmoke(req, res);
});

app.post("/api/qa/smoke", requireIngressToken, async (req, res) => {
  await handleQaSmoke(req, res);
});

app.get("/ops/dead-letter", requireIngressToken, (_req, res) => {
  const summary = getDeadLetterSummary(env.GTM_DEAD_LETTER_PATH);

  res.status(200).json({
    ok: true,
    summary,
    replay: {
      dry_run: "npm run replay:dead-letter:dry",
      execute: "npm run replay:dead-letter",
      recommended_batch: "npm run replay:dead-letter -- --limit 50"
    }
  });
});

app.get("/ops/alerts", requireIngressToken, (_req, res) => {
  const metrics = getMetricsSnapshot();
  const runtimeTelemetry = getRuntimeTelemetrySummary();
  const deadLetter = getDeadLetterSummary(env.GTM_DEAD_LETTER_PATH);

  const ops = buildOpsAlerts({
    counters: {
      webhooks_received: metrics.counters.webhooks_received,
      webhooks_forwarded: metrics.counters.webhooks_forwarded,
      webhooks_forward_failed: metrics.counters.webhooks_forward_failed,
      webhooks_invalid_signature: metrics.counters.webhooks_invalid_signature,
      refunds_received: metrics.counters.refunds_received,
      refunds_forwarded: metrics.counters.refunds_forwarded,
      refunds_forward_failed: metrics.counters.refunds_forward_failed,
      refunds_invalid_signature: metrics.counters.refunds_invalid_signature,
      ingress_token_rejected: metrics.counters.ingress_token_rejected,
      runtime_events_received: metrics.counters.runtime_events_received,
      runtime_events_rejected_invalid_payload: metrics.counters.runtime_events_rejected_invalid_payload,
      runtime_events_forwarded: metrics.counters.runtime_events_forwarded,
      runtime_events_suppressed: metrics.counters.runtime_events_suppressed,
      gtm_dead_letter_written: metrics.counters.gtm_dead_letter_written
    },
    runtimeTelemetry,
    deadLetter
  });

  res.status(200).json({
    ok: true,
    status: ops.status,
    generated_at: new Date().toISOString(),
    alerts: ops.alerts,
    quick_actions: [
      "GET /runtime/summary",
      "GET /compare/parity",
      "GET /ops/dead-letter"
    ]
  });
});

app.get("/ops/dashboard", requireIngressToken, (_req, res) => {
  const metrics = getMetricsSnapshot();
  const runtimeTelemetry = getRuntimeTelemetrySummary();
  const deadLetter = getDeadLetterSummary(env.GTM_DEAD_LETTER_PATH);
  const parity = getShadowParityReport(env.SHADOW_COMPARE_MISMATCH_ALERT_PCT);
  const channelSummary = getChannelHealthSummary(env.CHANNEL_HEALTH_STALE_MINUTES, env.CHANNEL_HEALTH_WARN_FAILURE_PCT);

  const ops = buildOpsAlerts({
    counters: {
      webhooks_received: metrics.counters.webhooks_received,
      webhooks_forwarded: metrics.counters.webhooks_forwarded,
      webhooks_forward_failed: metrics.counters.webhooks_forward_failed,
      webhooks_invalid_signature: metrics.counters.webhooks_invalid_signature,
      refunds_received: metrics.counters.refunds_received,
      refunds_forwarded: metrics.counters.refunds_forwarded,
      refunds_forward_failed: metrics.counters.refunds_forward_failed,
      refunds_invalid_signature: metrics.counters.refunds_invalid_signature,
      ingress_token_rejected: metrics.counters.ingress_token_rejected,
      runtime_events_received: metrics.counters.runtime_events_received,
      runtime_events_rejected_invalid_payload: metrics.counters.runtime_events_rejected_invalid_payload,
      runtime_events_forwarded: metrics.counters.runtime_events_forwarded,
      runtime_events_suppressed: metrics.counters.runtime_events_suppressed,
      gtm_dead_letter_written: metrics.counters.gtm_dead_letter_written
    },
    runtimeTelemetry,
    deadLetter
  });

  res.status(200).json({
    ok: true,
    generated_at: new Date().toISOString(),
    status: ops.status,
    alerts: ops.alerts,
    runtime: runtimeTelemetry,
    parity,
    channels: channelSummary,
    dead_letter: deadLetter,
    metrics: metrics.counters,
    next_actions: [
      "If status is critical, resolve /ops/alerts first.",
      "If dead_letter.total_records > 0, run replay:dead-letter in batches.",
      "If parity.status is alert, stay in shadow_compare until mismatch rate drops."
    ]
  });
});

app.get("/ops/shopify-app", requireIngressToken, (_req, res) => {
  const shopifyApp = getShopifyAppConfig();

  res.status(200).json({
    ok: true,
    app: {
      configured: shopifyApp.configured,
      api_key_present: shopifyApp.api_key_present,
      app_url: shopifyApp.app_url,
      scopes: shopifyApp.scopes
    }
  });
});

app.get("/ops/shopify-install-status", requireIngressToken, async (_req, res) => {
  const status = await getShopifyInstallStatus();

  res.status(200).json({
    ok: true,
    status
  });
});

app.get("/auth/shopify/install", (req, res) => {
  const shop = typeof req.query.shop === "string" ? req.query.shop.trim() : "";

  if (!shop) {
    res.status(400).json({ ok: false, error: "shop query parameter is required" });
    return;
  }

  let install;
  try {
    install = startShopifyInstall(shop);
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Failed to start Shopify install"
    });
    return;
  }

  res.status(200).json({
    ok: true,
    shop,
    install_url: install.url
  });
});

app.get("/auth/shopify/callback", async (req, res) => {
  try {
    const result = await completeShopifyInstall(new URLSearchParams(req.query as Record<string, string>));
    res.status(200).json({ ok: true, shop: result.shop, scope: result.scope });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Shopify install callback failed"
    });
  }
});

app.use("/compatibility", (req, res, next) => {
  res.on("finish", () => {
    const endpointPath = `${req.baseUrl}${req.path}`;
    const status = res.statusCode >= 400 ? "error" : "ok";
    recordCompatibilityUsage(endpointPath, status);
  });

  next();
});

app.get("/compatibility/ga4-id", requireIngressToken, (req, res) => {
  const shop = typeof req.query.shop === "string" ? req.query.shop : undefined;
  const measurementId = resolveGa4MeasurementId(shop, env.GA4_MEASUREMENT_ID, env.GA4_MEASUREMENT_ID_BY_SHOP);

  if (!measurementId) {
    res.status(404).json({
      ok: false,
      error: "GA4 measurement ID is not configured",
      shop
    });
    return;
  }

  res.status(200).json({
    ok: true,
    variable: "GA4 ID",
    shop,
    measurement_id: measurementId
  });
});

app.get("/compatibility/currency-code", requireIngressToken, (req, res) => {
  const ecommerceCurrency = typeof req.query.ecommerce_currency === "string" ? req.query.ecommerce_currency : undefined;
  const checkoutCurrencyCode = typeof req.query.checkout_currency === "string" ? req.query.checkout_currency : undefined;
  const shopCurrency = typeof req.query.shop_currency === "string" ? req.query.shop_currency : undefined;

  const currency = resolveCurrencyCode(
    {
      ecommerceCurrency,
      checkoutCurrencyCode,
      shopCurrency
    },
    env.SHOP_DEFAULT_CURRENCY
  );

  res.status(200).json({
    ok: true,
    variable: "dlv - Global - Currency Code",
    resolved_currency: currency,
    sources: {
      ecommerce_currency: ecommerceCurrency,
      checkout_currency: checkoutCurrencyCode,
      shop_currency: shopCurrency,
      fallback_currency: env.SHOP_DEFAULT_CURRENCY
    }
  });
});

app.get("/compatibility/event-id", requireIngressToken, (req, res) => {
  const webhookId = typeof req.query.webhook_id === "string" ? req.query.webhook_id : undefined;
  const shop = typeof req.query.shop === "string" ? req.query.shop : undefined;
  const topic = typeof req.query.topic === "string" ? req.query.topic : undefined;
  const orderName = typeof req.query.order_name === "string" ? req.query.order_name : undefined;
  const orderNumberRaw = typeof req.query.order_number === "string" ? req.query.order_number : undefined;
  const parsedOrderNumber = orderNumberRaw ? Number.parseInt(orderNumberRaw, 10) : undefined;
  const orderNumber = Number.isFinite(parsedOrderNumber) ? parsedOrderNumber : undefined;

  const eventId = resolveEventId({
    webhookId,
    shop,
    topic,
    orderNumber,
    orderName
  });

  res.status(200).json({
    ok: true,
    variable: "dlv - event_id",
    resolved_event_id: eventId,
    sources: {
      webhook_id: webhookId,
      shop,
      topic,
      order_number: orderNumber,
      order_name: orderName
    }
  });
});

app.get("/compatibility/customer-id", requireIngressToken, (req, res) => {
  const customerId = typeof req.query.customer_id === "string" ? req.query.customer_id : undefined;

  const resolvedCustomerId = resolveCustomerId(
    {
      customerId
    },
    env.CUSTOMER_ID_FALLBACK
  );

  res.status(200).json({
    ok: true,
    variable: "dlv - Customer ID",
    resolved_customer_id: resolvedCustomerId,
    sources: {
      customer_id: customerId,
      fallback_customer_id: env.CUSTOMER_ID_FALLBACK
    }
  });
});

app.get("/compatibility/customer-email", requireIngressToken, (req, res) => {
  const customerEmail = typeof req.query.customer_email === "string" ? req.query.customer_email : undefined;
  const checkoutEmail = typeof req.query.checkout_email === "string" ? req.query.checkout_email : undefined;

  const resolvedCustomerEmail = resolveCustomerEmail({
    customerEmail,
    checkoutEmail
  });

  res.status(200).json({
    ok: true,
    variable: "dlv - Customer Email",
    resolved_customer_email: resolvedCustomerEmail,
    sources: {
      customer_email: customerEmail,
      checkout_email: checkoutEmail
    }
  });
});

app.get("/compatibility/purchase-products", requireIngressToken, (req, res) => {
  const lineItemsRaw = typeof req.query.line_items_json === "string" ? req.query.line_items_json : "[]";

  let lineItems: CompatibilityLineItem[] = [];

  try {
    lineItems = parseLineItemsJson(lineItemsRaw);
  } catch {
    res.status(400).json({
      ok: false,
      error: "Invalid line_items_json query value"
    });
    return;
  }

  const products = resolvePurchaseProducts(lineItems);

  res.status(200).json({
    ok: true,
    variable: "dlv - Thank You Page - ecommerce.purchase.products",
    resolved_purchase_products: products,
    count: products.length
  });
});

app.get("/compatibility/facebook-pixel-id", requireIngressToken, (_req, res) => {
  if (!env.FACEBOOK_PIXEL_ID) {
    res.status(404).json({
      ok: false,
      error: "Facebook Pixel ID is not configured"
    });
    return;
  }

  res.status(200).json({
    ok: true,
    variable: "Facebook - Pixel ID",
    pixel_id: env.FACEBOOK_PIXEL_ID
  });
});

app.get("/compatibility/product-identifier", requireIngressToken, (req, res) => {
  const sku = typeof req.query.sku === "string" ? req.query.sku : undefined;
  const variantId = typeof req.query.variant_id === "string" ? req.query.variant_id : undefined;
  const productId = typeof req.query.product_id === "string" ? req.query.product_id : undefined;

  const identifier = resolveProductIdentifier({
    sku,
    variantId,
    productId
  });

  res.status(200).json({
    ok: true,
    variable: "Facebook - product identifier / GA4 - product identifier",
    resolved_product_identifier: identifier,
    sources: {
      sku,
      variant_id: variantId,
      product_id: productId
    }
  });
});

app.get("/compatibility/order-id", requireIngressToken, (req, res) => {
  const orderNumber = typeof req.query.order_number === "string" ? req.query.order_number : undefined;
  const orderName = typeof req.query.order_name === "string" ? req.query.order_name : undefined;
  const transactionId = typeof req.query.transaction_id === "string" ? req.query.transaction_id : undefined;

  const resolvedOrderId = resolveOrderId({
    orderNumber,
    orderName,
    transactionId
  });

  res.status(200).json({
    ok: true,
    variable: "dlv - Thank You Page - Order ID",
    resolved_order_id: resolvedOrderId,
    sources: {
      order_number: orderNumber,
      order_name: orderName,
      transaction_id: transactionId
    }
  });
});

app.get("/compatibility/pinterest-id", requireIngressToken, (_req, res) => {
  if (!env.PINTEREST_ID) {
    res.status(404).json({
      ok: false,
      error: "Pinterest ID is not configured"
    });
    return;
  }

  res.status(200).json({
    ok: true,
    variable: "Pinterest ID",
    pinterest_id: env.PINTEREST_ID
  });
});

app.get("/compatibility/cart-total", requireIngressToken, (req, res) => {
  const ecommerceValue = typeof req.query.ecommerce_value === "string" ? req.query.ecommerce_value : undefined;
  const checkoutTotalPrice = typeof req.query.checkout_total_price === "string" ? req.query.checkout_total_price : undefined;
  const subtotalPrice = typeof req.query.subtotal_price === "string" ? req.query.subtotal_price : undefined;

  const resolvedCartTotal = resolveCartTotal({
    ecommerceValue,
    checkoutTotalPrice,
    subtotalPrice
  });

  res.status(200).json({
    ok: true,
    variable: "dlv - Cart Total",
    resolved_cart_total: resolvedCartTotal,
    sources: {
      ecommerce_value: ecommerceValue,
      checkout_total_price: checkoutTotalPrice,
      subtotal_price: subtotalPrice
    }
  });
});

app.get("/compatibility/checkout-products", requireIngressToken, (req, res) => {
  const lineItemsRaw = typeof req.query.line_items_json === "string" ? req.query.line_items_json : "[]";

  let lineItems: CompatibilityLineItem[] = [];

  try {
    lineItems = parseLineItemsJson(lineItemsRaw);
  } catch {
    res.status(400).json({
      ok: false,
      error: "Invalid line_items_json query value"
    });
    return;
  }

  const products = resolveCheckoutProducts(lineItems);

  res.status(200).json({
    ok: true,
    variable: "dlv - ecommerce.checkout.products",
    resolved_checkout_products: products,
    count: products.length
  });
});

app.get("/compatibility/impressions", requireIngressToken, (req, res) => {
  const lineItemsRaw = typeof req.query.line_items_json === "string" ? req.query.line_items_json : "[]";

  try {
    const lineItems = parseLineItemsJson(lineItemsRaw);
    const impressions = resolveEcommerceImpressions(lineItems);

    res.status(200).json({
      ok: true,
      variable: "dlv - ecommerce.impressions",
      resolved_impressions: impressions,
      count: impressions.length
    });
  } catch {
    res.status(400).json({
      ok: false,
      error: "Invalid line_items_json query value"
    });
  }
});

app.get("/compatibility/product-group", requireIngressToken, (req, res) => {
  const lineItemsRaw = typeof req.query.line_items_json === "string" ? req.query.line_items_json : "[]";

  try {
    const lineItems = parseLineItemsJson(lineItemsRaw);
    const result = resolveProductGroup(lineItems);

    res.status(200).json({
      ok: true,
      variable: "Facebook - product group",
      resolved_product_group: result.productGroup,
      source: result.source
    });
  } catch {
    res.status(400).json({
      ok: false,
      error: "Invalid line_items_json query value"
    });
  }
});

app.get("/compatibility/page-title", requireIngressToken, (req, res) => {
  const pageTitle = typeof req.query.page_title === "string" ? req.query.page_title : undefined;
  const pageUrl = typeof req.query.page_url === "string" ? req.query.page_url : undefined;

  const result = resolvePageTitle({
    pageTitle,
    pageUrl
  });

  res.status(200).json({
    ok: true,
    variable: "DOM - Page Title",
    resolved_page_title: result.pageTitle,
    source: result.source,
    sources: {
      page_title: pageTitle,
      page_url: pageUrl
    }
  });
});

app.get("/compatibility/add-to-cart", requireIngressToken, (req, res) => {
  const lineItemsRaw = typeof req.query.line_items_json === "string" ? req.query.line_items_json : "[]";

  try {
    const lineItems = parseLineItemsJson(lineItemsRaw);
    const addToCart = resolveAddToCartCompatibility(lineItems);

    res.status(200).json({
      ok: true,
      variables: {
        add_array: "dlv - Add to Cart - Add Array",
        quantity: "dlv - Add to Cart - Quantity",
        price: "dlv - Add to Cart - Price",
        category: "dlv - Add to Cart - Category"
      },
      resolved: addToCart
    });
  } catch {
    res.status(400).json({
      ok: false,
      error: "Invalid line_items_json query value"
    });
  }
});

app.get("/compatibility/product-view-details", requireIngressToken, (req, res) => {
  const lineItemsRaw = typeof req.query.line_items_json === "string" ? req.query.line_items_json : "[]";

  try {
    const lineItems = parseLineItemsJson(lineItemsRaw);
    const details = resolveProductViewDetailsArray(lineItems);

    res.status(200).json({
      ok: true,
      variable: "dlv - Product View - Details Array",
      resolved_product_view_details: details,
      count: details.length
    });
  } catch {
    res.status(400).json({
      ok: false,
      error: "Invalid line_items_json query value"
    });
  }
});

app.get("/compatibility/search-term", requireIngressToken, (req, res) => {
  const url = typeof req.query.url === "string" ? req.query.url : undefined;

  if (!url) {
    res.status(400).json({
      ok: false,
      error: "Query parameter 'url' is required"
    });
    return;
  }

  try {
    const parsed = new URL(url);
    const term = resolveSearchTerm(parsed.searchParams);

    res.status(200).json({
      ok: true,
      variable: "url - Search - Search Term",
      resolved_search_term: term,
      source_url: url
    });
  } catch {
    res.status(400).json({
      ok: false,
      error: "Invalid url query value"
    });
  }
});

app.get("/compatibility/visitor-type", requireIngressToken, (req, res) => {
  const customerId = typeof req.query.customer_id === "string" ? req.query.customer_id : undefined;
  const customerEmail = typeof req.query.customer_email === "string" ? req.query.customer_email : undefined;

  const visitorType = resolveVisitorType({
    customerId,
    customerEmail
  });

  res.status(200).json({
    ok: true,
    variable: "dlv - Global - Visitor Type",
    resolved_visitor_type: visitorType,
    sources: {
      customer_id: customerId,
      customer_email: customerEmail
    }
  });
});

app.get("/compatibility/order-revenue", requireIngressToken, (req, res) => {
  const ecommerceValue = typeof req.query.ecommerce_value === "string" ? req.query.ecommerce_value : undefined;
  const totalPrice = typeof req.query.total_price === "string" ? req.query.total_price : undefined;

  const orderRevenue = resolveOrderRevenue({
    ecommerceValue,
    totalPrice
  });

  res.status(200).json({
    ok: true,
    variable: "dlv - Thank You Page - Order Revenue",
    resolved_order_revenue: orderRevenue,
    sources: {
      ecommerce_value: ecommerceValue,
      total_price: totalPrice
    }
  });
});

app.get("/compatibility/customer-phone", requireIngressToken, (req, res) => {
  const customerPhone = typeof req.query.customer_phone === "string" ? req.query.customer_phone : undefined;
  const normalizedPhone = normalizeCustomerPhone(customerPhone);

  res.status(200).json({
    ok: true,
    variable: "dlv - Thank You Page - Customer Phone Number",
    resolved_customer_phone: normalizedPhone,
    sources: {
      customer_phone: customerPhone
    }
  });
});

app.use(express.json({ limit: env.JSON_BODY_LIMIT, strict: true }));

app.post("/compare/elevar", requireIngressToken, async (req, res) => {
  try {
    const event = await ingestElevarShadow(req.body);
    incrementCounter("compare_elevar_received");

    res.status(202).json({
      ok: true,
      status: "baseline_received",
      runtime_mode: env.RUNTIME_MODE,
      key: event.key,
      event_name: event.event_name,
      transaction_id: event.transaction_id
    });
  } catch {
    res.status(400).json({
      ok: false,
      error: "Invalid Elevar baseline payload"
    });
  }
});

app.get("/compare/summary", requireIngressToken, (_req, res) => {
  const summary = getShadowCompareSummary();

  res.status(200).json({
    ok: true,
    source_of_truth: "elevar",
    runtime_mode: env.RUNTIME_MODE,
    summary
  });
});

app.get("/compare/parity", requireIngressToken, (_req, res) => {
  const summary = getShadowCompareSummary();
  const parity = getShadowParityReport(env.SHADOW_COMPARE_MISMATCH_ALERT_PCT);

  res.status(200).json({
    ok: true,
    source_of_truth: "elevar",
    runtime_mode: env.RUNTIME_MODE,
    parity,
    counts: summary.counts,
    mismatches_preview: summary.mismatches_preview
  });
});

app.post("/compare/channel-event", requireIngressToken, (req, res) => {
  const parsed = parseChannelEventBody(req.body as ChannelEventRequestBody);

  if (!parsed.event) {
    res.status(400).json({
      ok: false,
      error: parsed.error
    });
    return;
  }

  const item = ingestChannelEvent(parsed.event);

  incrementCounter("compare_channel_events_received");

  res.status(202).json({
    ok: true,
    status: "channel_event_recorded",
    item
  });
});

app.post("/compare/channel-event/batch", requireIngressToken, (req, res) => {
  const body = req.body as { events?: ChannelEventRequestBody[] };
  const events = Array.isArray(body.events) ? body.events : [];

  if (events.length === 0) {
    res.status(400).json({
      ok: false,
      error: "events array is required"
    });
    return;
  }

  const accepted: ReturnType<typeof ingestChannelEvent>[] = [];
  const rejected: Array<{ index: number; error: string }> = [];

  for (let i = 0; i < events.length; i += 1) {
    const parsed = parseChannelEventBody(events[i] ?? {});
    if (!parsed.event) {
      rejected.push({ index: i, error: parsed.error ?? "Invalid channel event" });
      continue;
    }

    const item = ingestChannelEvent(parsed.event);
    accepted.push(item);
    incrementCounter("compare_channel_events_received");
  }

  const statusCode = rejected.length > 0 ? 207 : 202;
  res.status(statusCode).json({
    ok: rejected.length === 0,
    status: rejected.length === 0 ? "channel_events_recorded" : "channel_events_partially_recorded",
    counts: {
      received: events.length,
      accepted: accepted.length,
      rejected: rejected.length
    },
    accepted,
    rejected
  });
});

app.get("/api/advisor/alerts", requireIngressToken, (_req, res) => {
  const context = buildAdvisorContext();

  res.status(200).json({
    ok: true,
    generated_at: new Date().toISOString(),
    local_ai_enabled: env.LOCAL_ADVISOR_ENABLED,
    alerts: buildAdvisorAlerts(context)
  });
});

app.post("/api/advisor/chat", requireIngressToken, async (req, res) => {
  const body = req.body as {
    message?: string;
    history?: Array<{ role?: "user" | "assistant"; content?: string }>;
  };

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    res.status(400).json({ ok: false, error: "message is required" });
    return;
  }

  const history = Array.isArray(body.history)
    ? body.history
        .filter((item) => (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
        .map((item) => ({ role: item.role as "user" | "assistant", content: (item.content as string).trim() }))
        .filter((item) => item.content.length > 0)
        .slice(-10)
    : [];

  const context = buildAdvisorContext();
  const result = await getAdvisorAnswer({
    message,
    history,
    context,
    config: {
      enabled: env.LOCAL_ADVISOR_ENABLED,
      baseUrl: env.LOCAL_ADVISOR_BASE_URL,
      model: env.LOCAL_ADVISOR_MODEL,
      timeoutMs: env.LOCAL_ADVISOR_TIMEOUT_MS
    }
  });

  res.status(200).json({
    ok: true,
    answer: result.answer,
    model: result.model,
    fallback_used: result.fallbackUsed,
    local_ai_enabled: env.LOCAL_ADVISOR_ENABLED,
    used_tools: result.usedTools,
    alerts: buildAdvisorAlerts(context).slice(0, 5)
  });
});

app.get("/api/mappings", requireIngressToken, async (_req, res) => {
  const registry = await getMappingRegistry();

  res.status(200).json({
    ok: true,
    mappings: registry.mappings,
    revision: registry.revision,
    persistence: {
      configured: registry.persistenceConfigured,
      store_path: registry.storePath
    }
  });
});

app.put("/api/mappings", requireIngressToken, async (req, res) => {
  const body = req.body as { mappings?: unknown; expected_revision?: unknown };

  if (!body || typeof body !== "object") {
    res.status(400).json({ ok: false, error: "request body is required" });
    return;
  }

  const expectedRevision =
    typeof body.expected_revision === "number" && Number.isFinite(body.expected_revision)
      ? body.expected_revision
      : undefined;

  try {
    const updated =
      expectedRevision === undefined
        ? await replaceMappingRegistry(body.mappings ?? {})
        : await replaceMappingRegistry(body.mappings ?? {}, { expectedRevision });

    res.status(200).json({
      ok: true,
      mappings: updated.mappings,
      revision: updated.revision,
      saved_at: new Date().toISOString()
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("mapping_revision_conflict:")) {
      const registry = await getMappingRegistry();
      res.status(409).json({
        ok: false,
        error: "mapping revision conflict",
        current_revision: registry.revision,
        current_mappings: registry.mappings
      });
      return;
    }

    throw error;
  }
});

app.get("/compare/channels", requireIngressToken, (_req, res) => {
  const summary = getChannelHealthSummary(env.CHANNEL_HEALTH_STALE_MINUTES, env.CHANNEL_HEALTH_WARN_FAILURE_PCT);

  res.status(200).json({
    ok: true,
    runtime_mode: env.RUNTIME_MODE,
    summary
  });
});

app.get("/compare/troubleshoot", requireIngressToken, (_req, res) => {
  const summary = getChannelHealthSummary(env.CHANNEL_HEALTH_STALE_MINUTES, env.CHANNEL_HEALTH_WARN_FAILURE_PCT);
  const issues = getChannelTroubleshooting(summary);

  res.status(200).json({
    ok: true,
    issues,
    links: getChannelHelpLinks()
  });
});

app.get("/compare/ui-model", requireIngressToken, (req, res) => {
  const limitRaw = typeof req.query.limit === "string" ? req.query.limit : "100";
  const parsedLimit = Number.parseInt(limitRaw, 10);
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : 100;

  const paritySummary = getShadowCompareSummary();
  const parity = getShadowParityReport(env.SHADOW_COMPARE_MISMATCH_ALERT_PCT);
  const metrics = getMetricsSnapshot();
  const channelSummary = getChannelHealthSummary(env.CHANNEL_HEALTH_STALE_MINUTES, env.CHANNEL_HEALTH_WARN_FAILURE_PCT);
  const issues = getChannelTroubleshooting(channelSummary);
  const launchReadiness = buildLaunchReadinessReport({
    phase: "validation",
    runtimeMode: env.RUNTIME_MODE,
    parity,
    paritySummary,
    channelSummary,
    metrics: {
      webhooks_received: metrics.counters.webhooks_received,
      webhooks_invalid_signature: metrics.counters.webhooks_invalid_signature,
      webhooks_invalid_json: metrics.counters.webhooks_invalid_json,
      webhooks_rejected_topic: metrics.counters.webhooks_rejected_topic,
      webhooks_forward_failed: metrics.counters.webhooks_forward_failed
    },
    thresholds: {
      minPairedEvents: env.LAUNCH_MIN_PAIRED_EVENTS,
      maxWarningChannels: env.LAUNCH_MAX_WARNING_CHANNELS,
      maxWebhookFailureRatePct: env.LAUNCH_MAX_WEBHOOK_FAILURE_RATE_PCT
    }
  });

  res.status(200).json({
    ok: true,
    source_of_truth: "elevar",
    runtime_mode: env.RUNTIME_MODE,
    parity,
    parity_counts: paritySummary.counts,
    parity_mismatches_preview: paritySummary.mismatches_preview,
    channels: channelSummary,
    troubleshooting: {
      issues,
      links: getChannelHelpLinks()
    },
    launch_readiness: launchReadiness,
    recent: {
      shadow_events: getRecentShadowEvents(limit),
      channel_events: getRecentChannelEvents(limit)
    }
  });
});

app.get("/launch/readiness", requireIngressToken, (req, res) => {
  const phaseQuery = typeof req.query.phase === "string" ? req.query.phase : "validation";
  const phase = phaseQuery === "cutover" ? "cutover" : "validation";

  const paritySummary = getShadowCompareSummary();
  const parity = getShadowParityReport(env.SHADOW_COMPARE_MISMATCH_ALERT_PCT);
  const channelSummary = getChannelHealthSummary(env.CHANNEL_HEALTH_STALE_MINUTES, env.CHANNEL_HEALTH_WARN_FAILURE_PCT);
  const metrics = getMetricsSnapshot();

  const report = buildLaunchReadinessReport({
    phase,
    runtimeMode: env.RUNTIME_MODE,
    parity,
    paritySummary,
    channelSummary,
    metrics: {
      webhooks_received: metrics.counters.webhooks_received,
      webhooks_invalid_signature: metrics.counters.webhooks_invalid_signature,
      webhooks_invalid_json: metrics.counters.webhooks_invalid_json,
      webhooks_rejected_topic: metrics.counters.webhooks_rejected_topic,
      webhooks_forward_failed: metrics.counters.webhooks_forward_failed
    },
    thresholds: {
      minPairedEvents: env.LAUNCH_MIN_PAIRED_EVENTS,
      maxWarningChannels: env.LAUNCH_MAX_WARNING_CHANNELS,
      maxWebhookFailureRatePct: env.LAUNCH_MAX_WEBHOOK_FAILURE_RATE_PCT
    }
  });

  res.status(200).json({
    ok: true,
    source_of_truth: "elevar",
    runtime_mode: env.RUNTIME_MODE,
    report
  });
});

app.get("/compare/recent", requireIngressToken, (req, res) => {
  const limitRaw = typeof req.query.limit === "string" ? req.query.limit : "100";
  const parsedLimit = Number.parseInt(limitRaw, 10);
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : 100;
  const events = getRecentShadowEvents(limit);

  res.status(200).json({
    ok: true,
    runtime_mode: env.RUNTIME_MODE,
    count: events.length,
    events
  });
});

app.options("/event", publicEventGuard);
app.post("/event", publicEventGuard, async (req, res) => {
  incrementCounter("runtime_events_received");

  try {
    const event = parseRuntimeEvent(req.body);
    const validation = validateRuntimeEventAgainstCatalog(event);

    if (validation.issues.some((issue) => issue.level === "error")) {
      incrementCounter("runtime_events_validation_errors");
    }

    if (validation.issues.some((issue) => issue.level === "warning")) {
      incrementCounter("runtime_events_validation_warnings");
    }

    if (isRuntimeDuplicate(event)) {
      incrementCounter("runtime_events_duplicate");
      recordRuntimeTelemetry({
        at: new Date().toISOString(),
        event_name: event.event_name,
        event_id: event.event_id ?? event.marketing.event_id,
        source: event.source,
        status: "duplicate",
        reason: "duplicate_event",
        visitor_type: event.customer.visitor_type
      });

      res.status(200).json({
        ok: true,
        status: "duplicate_ignored",
        validation
      });
      return;
    }

    const policy = evaluateRuntimeEventPolicy(event);
    if (!policy.allowed) {
      incrementCounter("runtime_events_suppressed");
      recordRuntimeTelemetry({
        at: new Date().toISOString(),
        event_name: event.event_name,
        event_id: event.event_id ?? event.marketing.event_id,
        source: event.source,
        status: "suppressed",
        reason: policy.reason,
        visitor_type: event.customer.visitor_type
      });

      res.status(202).json({
        ok: true,
        status: "suppressed",
        reason: policy.reason,
        validation
      });
      return;
    }

    const payload = {
      event_name: event.event_name,
      event_id: event.event_id ?? event.marketing.event_id,
      timestamp: event.session.timestamp ?? new Date().toISOString(),
      source: event.source,
      source_theme: event.source_theme ?? "unknown",
      source_surface: event.source_surface ?? "unknown",
      destination_hints: event.marketing.destinations ?? [],
      gcwSynapse: {
        customer: event.customer,
        product: event.product,
        collection: event.collection,
        cart: event.cart,
        checkout: event.checkout,
        marketing: event.marketing,
        session: event.session,
        consent: event.consent
      }
    };

    await forwardToGtmServer(payload);

    ingestChannelEvent({
      channel: "server_gtm",
      surface: "runtime",
      destination: "collect",
      event_name: event.event_name,
      event_id: event.event_id ?? event.marketing.event_id,
      transaction_id: event.checkout.order_id,
      source_theme: event.source_theme,
      source_surface: event.source_surface,
      status: "ok",
      observed_at: payload.timestamp
    });

    incrementCounter("runtime_events_forwarded");
    recordRuntimeTelemetry({
      at: new Date().toISOString(),
      event_name: event.event_name,
      event_id: event.event_id ?? event.marketing.event_id,
      source: event.source,
      status: "forwarded",
      visitor_type: event.customer.visitor_type
    });

    res.status(202).json({
      ok: true,
      status: "forwarded",
      event_name: event.event_name,
      event_id: event.event_id ?? event.marketing.event_id,
      validation
    });
  } catch {
    const runtimeBody = req.body as Partial<{
      event_name: string;
      event_id: string;
      source_theme: string;
      source_surface: string;
      checkout: { order_id?: string };
      session: { timestamp?: string };
    }>;

    ingestChannelEvent({
      channel: "server_gtm",
      surface: "runtime",
      destination: "collect",
      event_name: runtimeBody.event_name ?? "unknown",
      event_id: runtimeBody.event_id,
      transaction_id: runtimeBody.checkout?.order_id,
      source_theme: runtimeBody.source_theme,
      source_surface: runtimeBody.source_surface,
      status: "error",
      error_message: "runtime_forward_or_validation_failed",
      observed_at: runtimeBody.session?.timestamp
    });

    incrementCounter("runtime_events_rejected_invalid_payload");
    res.status(400).json({
      ok: false,
      error: "Invalid runtime event payload"
    });
  }
});

// Shopify webhook routes use raw body so signature verification remains valid.
app.use(
  env.WEBHOOK_PATH_PREFIX,
  express.raw({ type: "application/json", limit: "1mb" }),
  webhooksRouter
);

app.use(
  env.REFUNDS_WEBHOOK_PATH_PREFIX,
  express.raw({ type: "application/json", limit: "1mb" }),
  refundsRouter
);

const startupDeadLetter = getDeadLetterSummary(env.GTM_DEAD_LETTER_PATH);
const startupGuard = evaluateLaunchGuard({
  strictEnabled: env.STRICT_LAUNCH_GUARD,
  deadLetter: startupDeadLetter,
  maxDeadLetterRecords: env.LAUNCH_MAX_DEAD_LETTER_RECORDS,
  blockOnThemeConflicts: env.LAUNCH_BLOCK_ON_THEME_CONFLICTS,
  themeAuditPath: env.LAUNCH_THEME_AUDIT_PATH
});

if (!startupGuard.allowed) {
  console.error("Launch guard blocked startup:");
  for (const blocker of startupGuard.blockers) {
    console.error(`- ${blocker}`);
  }
  process.exit(1);
}

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: "Not found" });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logError("Unhandled request error", {
    path: req.path,
    method: req.method,
    error: (err as Error)?.message ?? "unknown_error"
  });

  if (res.headersSent) {
    return;
  }

  res.status(500).json({ ok: false, error: "Internal server error" });
});

const server = app.listen(env.PORT, () => {
  console.log(`GCW-Synapse listening on port ${env.PORT}`);
});

let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  logInfo("Received shutdown signal, draining connections", { signal });

  const forceTimer = setTimeout(() => {
    logError("Forced shutdown after timeout", { signal });
    process.exit(1);
  }, env.SHUTDOWN_TIMEOUT_MS);
  forceTimer.unref();

  server.close(() => {
    clearTimeout(forceTimer);
    logInfo("Server closed cleanly", { signal });
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
