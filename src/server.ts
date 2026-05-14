import express from "express";
import { env } from "./config/env";
import { createIngressTokenMiddleware } from "./lib/ingressAuth";
import { webhooksRouter } from "./routes/webhooks";
import { resolveCartTotal } from "./services/cartTotal";
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
import { resolveOrderId } from "./services/orderId";
import { resolveOrderRevenue } from "./services/orderRevenue";
import { resolveProductIdentifier } from "./services/productIdentifier";
import { resolvePurchaseProducts } from "./services/purchaseProducts";
import { resolveSearchTerm } from "./services/searchTerm";
import {
  configureShadowCompare,
  getRecentShadowEvents,
  getShadowCompareSummary,
  ingestElevarShadow
} from "./services/shadowCompare";
import { resolveVisitorType } from "./services/visitorType";
import { normalizeCustomerPhone } from "./services/customerPhone";

const app = express();
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

// Shopify webhook routes use raw body so signature verification remains valid.
app.use(
  env.WEBHOOK_PATH_PREFIX,
  express.raw({ type: "application/json", limit: "1mb" }),
  webhooksRouter
);

app.listen(env.PORT, () => {
  console.log(`GCW-Synapse listening on port ${env.PORT}`);
});
