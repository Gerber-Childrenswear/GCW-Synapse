import express from "express";
import { env } from "./config/env";
import { createIngressTokenMiddleware } from "./lib/ingressAuth";
import { webhooksRouter } from "./routes/webhooks";
import { resolveCustomerEmail, resolveCustomerId } from "./services/customerIdentity";
import { resolveCurrencyCode } from "./services/currencyCode";
import { resolveEventId } from "./services/eventId";
import { resolveGa4MeasurementId } from "./services/ga4Measurement";
import { getMetricsSnapshot } from "./services/metrics";
import { resolveOrderId } from "./services/orderId";
import { resolveProductIdentifier } from "./services/productIdentifier";
import { resolvePurchaseProducts } from "./services/purchaseProducts";

const app = express();
const requireIngressToken = createIngressTokenMiddleware(env.INGRESS_SHARED_TOKEN);

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

  let lineItems: Array<{
    sku?: string;
    product_id?: number;
    variant_id?: number;
    variant_title?: string;
    product_type?: string;
    title: string;
    price: string;
    quantity: number;
  }> = [];

  try {
    const parsed = JSON.parse(lineItemsRaw) as unknown;
    if (Array.isArray(parsed)) {
      lineItems = parsed as Array<{
        sku?: string;
        product_id?: number;
        variant_id?: number;
        variant_title?: string;
        product_type?: string;
        title: string;
        price: string;
        quantity: number;
      }>;
    }
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

app.use(express.json());
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
