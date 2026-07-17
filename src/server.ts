import express from "express";
import { env } from "./config/env";
import { createIngressTokenMiddleware } from "./lib/ingressAuth";
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
import { resolveEventId } from "./services/eventId";
import { resolveGa4MeasurementId } from "./services/ga4Measurement";
import { getMetricsSnapshot, incrementCounter } from "./services/metrics";
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
import { resolveVisitorType } from "./services/visitorType";
import { normalizeCustomerPhone } from "./services/customerPhone";
import { resolveFacebookProductGroup } from "./services/facebookProductGroup";
import { resolvePageTitle } from "./services/pageTitle";
import { resolveThankYouActionField } from "./services/thankYouActionField";
import { resolveProductViewName, resolveProductViewPrice } from "./services/productViewScalars";
import { getShopifyAppConfig } from "./services/shopifyApp";
import { completeShopifyInstall, getShopifyInstallStatus, startShopifyInstall } from "./services/shopifyAuth";
import { renderAppHome } from "./ui/renderAppHome";

const app = express();
export { app };

const requireIngressToken = createIngressTokenMiddleware(env.INGRESS_SHARED_TOKEN);

configureShadowCompare({
  runtimeMode: env.RUNTIME_MODE,
  maxRecords: env.SHADOW_COMPARE_MAX_RECORDS,
  storePath: env.SHADOW_COMPARE_STORE_PATH
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

type ChannelEventRequestBody = {
  channel?: string;
  surface?: "pixel" | "server";
  destination?: string;
  pixel_id?: string;
  event_name?: string;
  transaction_id?: string;
  status?: "ok" | "error";
  error_message?: string;
  observed_at?: string;
};

function parseChannelEventBody(body: ChannelEventRequestBody): { event?: ChannelEventInput; error?: string } {
  if (
    !body.channel ||
    (body.surface !== "pixel" && body.surface !== "server") ||
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
      transaction_id: body.transaction_id,
      status: body.status,
      error_message: body.error_message,
      observed_at: body.observed_at
    }
  };
}

app.get("/", (req, res) => {
  const shop = typeof req.query.shop === "string" ? req.query.shop : "";
  const host = typeof req.query.host === "string" ? req.query.host : "";
  const shopifyApp = getShopifyAppConfig();

  res.status(200).type("html").send(
    renderAppHome({
      shop,
      host,
      clientId: shopifyApp.client_id ?? "",
      runtimeMode: env.RUNTIME_MODE,
      appUrl: shopifyApp.app_url ?? env.SHOPIFY_APP_URL ?? "https://gcw-synapse.ncassidy.workers.dev"
    })
  );
});

app.get("/app/summary", (_req, res) => {
  try {
    const paritySummary = getShadowCompareSummary();
    const parity = getShadowParityReport(env.SHADOW_COMPARE_MISMATCH_ALERT_PCT);
    const channelSummary = getChannelHealthSummary(env.CHANNEL_HEALTH_STALE_MINUTES, env.CHANNEL_HEALTH_WARN_FAILURE_PCT);
    const metrics = getMetricsSnapshot();

    const webhookFailures =
      metrics.counters.webhooks_invalid_signature +
      metrics.counters.webhooks_invalid_json +
      metrics.counters.webhooks_rejected_topic +
      metrics.counters.webhooks_forward_failed;
    const webhookReceived = metrics.counters.webhooks_received;
    const webhookFailureRatePct = webhookReceived > 0 ? (webhookFailures / webhookReceived) * 100 : 0;

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
      service: "gcw-synapse",
      runtime_mode: env.RUNTIME_MODE,
      shopify_client_id: env.SHOPIFY_API_KEY,
      parity: {
        status: parity.status,
        mismatch_rate_pct: parity.mismatch_rate_pct,
        matched_rate_pct: parity.matched_rate_pct,
        paired_events: parity.paired_events,
        threshold_pct: parity.threshold_pct
      },
      parity_counts: paritySummary.counts,
      metrics: {
        webhooks_received: metrics.counters.webhooks_received,
        webhooks_shadow_captured: metrics.counters.webhooks_shadow_captured,
        webhooks_forwarded: metrics.counters.webhooks_forwarded,
        webhook_failure_rate_pct: webhookFailureRatePct
      },
      thresholds: {
        min_paired_events: env.LAUNCH_MIN_PAIRED_EVENTS,
        mismatch_alert_pct: env.SHADOW_COMPARE_MISMATCH_ALERT_PCT,
        max_webhook_failure_rate_pct: env.LAUNCH_MAX_WEBHOOK_FAILURE_RATE_PCT
      },
      launch_readiness: launchReadiness,
      channels: {
        critical: channelSummary.totals.critical,
        warning: channelSummary.totals.warning,
        healthy: channelSummary.totals.healthy
      }
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Failed to build app summary"
    });
  }
});

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "gcw-synapse" });
});

app.get("/diagnostics", requireIngressToken, (_req, res) => {
  const shopifyApp = getShopifyAppConfig();

  res.status(200).json({
    ok: true,
    service: "gcw-synapse",
    shopify_app: {
      client_id: shopifyApp.client_id,
      configured: shopifyApp.configured,
      app_url: shopifyApp.app_url,
      scopes: shopifyApp.scopes
    },
    metrics: getMetricsSnapshot()
  });
});

app.get("/ops/shopify-app", requireIngressToken, (_req, res) => {
  const shopifyApp = getShopifyAppConfig();

  res.status(200).json({
    ok: true,
    app: shopifyApp
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

  try {
    const install = startShopifyInstall(shop);
    res.status(200).json({
      ok: true,
      shop,
      client_id: env.SHOPIFY_API_KEY,
      install_url: install.url
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Failed to start Shopify install"
    });
  }
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

app.get("/compatibility/facebook-product-group", requireIngressToken, (req, res) => {
  const productId = typeof req.query.product_id === "string" ? req.query.product_id : undefined;
  const contentType = typeof req.query.content_type === "string" ? req.query.content_type : undefined;

  const resolved = resolveFacebookProductGroup({
    productId,
    contentType
  });

  res.status(200).json({
    ok: true,
    variable: "Facebook - product group",
    resolved_facebook_product_group: resolved.content_type,
    resolved_item_group_id: resolved.item_group_id,
    sources: {
      product_id: productId,
      content_type: contentType
    }
  });
});

app.get("/compatibility/page-title", requireIngressToken, (req, res) => {
  const title = typeof req.query.title === "string" ? req.query.title : undefined;
  const documentTitle = typeof req.query.document_title === "string" ? req.query.document_title : undefined;
  const fallback = typeof req.query.fallback === "string" ? req.query.fallback : undefined;

  const resolvedPageTitle = resolvePageTitle({
    title,
    documentTitle,
    fallback
  });

  res.status(200).json({
    ok: true,
    variable: "DOM - Page Title",
    resolved_page_title: resolvedPageTitle,
    sources: {
      title,
      document_title: documentTitle,
      fallback
    }
  });
});

app.get("/compatibility/thank-you-action-field", requireIngressToken, (req, res) => {
  const orderNumber = typeof req.query.order_number === "string" ? req.query.order_number : undefined;
  const orderName = typeof req.query.order_name === "string" ? req.query.order_name : undefined;
  const transactionId = typeof req.query.transaction_id === "string" ? req.query.transaction_id : undefined;
  const ecommerceValue = typeof req.query.ecommerce_value === "string" ? req.query.ecommerce_value : undefined;
  const totalPrice = typeof req.query.total_price === "string" ? req.query.total_price : undefined;
  const currency = typeof req.query.currency === "string" ? req.query.currency : undefined;
  const tax = typeof req.query.tax === "string" ? req.query.tax : undefined;
  const shipping = typeof req.query.shipping === "string" ? req.query.shipping : undefined;

  const actionField = resolveThankYouActionField({
    orderNumber,
    orderName,
    transactionId,
    ecommerceValue,
    totalPrice,
    currency,
    tax,
    shipping
  });

  res.status(200).json({
    ok: true,
    variable: "dlv - Thank You Page - Action Field",
    resolved_thank_you_action_field: actionField,
    sources: {
      order_number: orderNumber,
      order_name: orderName,
      transaction_id: transactionId,
      ecommerce_value: ecommerceValue,
      total_price: totalPrice,
      currency,
      tax,
      shipping
    }
  });
});

app.get("/compatibility/product-view-price", requireIngressToken, (req, res) => {
  const price = typeof req.query.price === "string" ? req.query.price : undefined;
  const ecommercePrice = typeof req.query.ecommerce_price === "string" ? req.query.ecommerce_price : undefined;

  const resolvedPrice = resolveProductViewPrice({
    price,
    ecommercePrice
  });

  res.status(200).json({
    ok: true,
    variable: "dlv - Product View - Price",
    resolved_product_view_price: resolvedPrice,
    sources: {
      price,
      ecommerce_price: ecommercePrice
    }
  });
});

app.get("/compatibility/product-view-name", requireIngressToken, (req, res) => {
  const name = typeof req.query.name === "string" ? req.query.name : undefined;
  const title = typeof req.query.title === "string" ? req.query.title : undefined;
  const productTitle = typeof req.query.product_title === "string" ? req.query.product_title : undefined;

  const resolvedName = resolveProductViewName({
    name,
    title,
    productTitle
  });

  res.status(200).json({
    ok: true,
    variable: "dlv - Product View - Name",
    resolved_product_view_name: resolvedName,
    sources: {
      name,
      title,
      product_title: productTitle
    }
  });
});

// Shopify webhooks must use raw body BEFORE express.json() so HMAC verification stays valid.
app.use(
  env.WEBHOOK_PATH_PREFIX,
  express.raw({ type: "application/json", limit: "1mb" }),
  webhooksRouter
);

app.use(express.json());

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

app.post("/event", requireIngressToken, (req, res) => {
  res.status(501).json({
    message: "Use Shopify order webhooks endpoints instead",
    received: !!req.body
  });
});

const isCloudflareWorker = process.env.CF_WORKER === "1";

if (!isCloudflareWorker) {
  app.listen(env.PORT, "0.0.0.0", () => {
    console.log(`GCW-Synapse listening on 0.0.0.0:${env.PORT}`);
  });
}
