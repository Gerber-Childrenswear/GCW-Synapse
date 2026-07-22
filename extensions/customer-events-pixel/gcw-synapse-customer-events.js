import { register } from "@shopify/web-pixels-extension";

function asString(value) {
  if (value == null) return "";
  return String(value);
}

function toPrice(amount) {
  if (amount == null) return "0.0";
  const n = typeof amount === "number" ? amount : Number.parseFloat(String(amount));
  if (!Number.isFinite(n)) return "0.0";
  // Shopify pixel money often already decimal; if integer cents-like keep as-is when small.
  return n.toFixed(2);
}

function mapLineItem(item, index) {
  const variant = item?.variant || {};
  const product = variant.product || item?.product || {};
  const sku = variant.sku || "";
  const variantId = asString(variant.id || item?.variantId || "");
  const productId = asString(product.id || item?.productId || "");
  return {
    id: sku || variantId || productId,
    name: asString(product.title || item?.title || ""),
    brand: asString(product.vendor || ""),
    category: asString(product.type || ""),
    variant: asString(variant.title || ""),
    price: toPrice(variant.price?.amount ?? item?.price?.amount ?? item?.price),
    quantity: asString(item?.quantity ?? 1),
    position: index + 1,
    product_id: productId,
    variant_id: variantId,
    compare_at_price: toPrice(variant.compareAtPrice?.amount ?? "0.0"),
    image: asString(variant.image?.src || product.image?.src || ""),
    url: asString(product.url || "")
  };
}

function buildEventId(parts) {
  return parts.filter(Boolean).join("|").slice(0, 120);
}

async function sendBeacon(url, payload) {
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true
    });
  } catch (_err) {
    // Sandbox fetch failures are non-fatal.
  }
}

register(({ analytics, settings, init }) => {
  const beaconUrl = settings?.beaconUrl || "https://gcw-synapse-super.gcwsynapse.workers.dev/browser/beacon";
  const shop = settings?.shopDomain || init?.data?.shop?.myshopifyDomain || "";
  const currency =
    init?.data?.shop?.paymentSettings?.currencyCode ||
    init?.data?.cart?.cost?.totalAmount?.currencyCode ||
    "USD";

  const baseUser = {
    visitor_type: init?.data?.customer?.id ? "logged_in" : "guest",
    customer_id: init?.data?.customer?.id ? asString(init.data.customer.id) : undefined,
    customer_email: init?.data?.customer?.email || undefined
  };

  function emit(eventName, ecommerce, extras = {}) {
    const event_id = buildEventId([shop, eventName, Date.now().toString(36)]);
    const payload = {
      source: "synapse-web-pixel",
      shop,
      event: eventName,
      event_id,
      currency,
      user_properties: baseUser,
      ecommerce,
      ...extras,
      observed_at: new Date().toISOString()
    };
    sendBeacon(beaconUrl, payload);
  }






  analytics.subscribe("checkout_started", (event) => {
    const lines = event.data?.checkout?.lineItems || [];
    const products = lines.map((line, i) => mapLineItem(line, i));
    emit("dl_begin_checkout", {
      currencyCode: currency,
      checkout: {
        actionField: { step: "1" },
        products
      }
    });
  });

  analytics.subscribe("checkout_shipping_info_submitted", (event) => {
    const lines = event.data?.checkout?.lineItems || [];
    const products = lines.map((line, i) => mapLineItem(line, i));
    emit("dl_add_shipping_info", {
      currencyCode: currency,
      checkout: {
        actionField: { step: "2" },
        products
      }
    });
  });

  analytics.subscribe("payment_info_submitted", (event) => {
    const lines = event.data?.checkout?.lineItems || [];
    const products = lines.map((line, i) => mapLineItem(line, i));
    emit("dl_add_payment_info", {
      currencyCode: currency,
      checkout: {
        actionField: { step: "3" },
        products
      }
    });
  });

  analytics.subscribe("checkout_completed", (event) => {
    const checkout = event.data?.checkout;
    if (!checkout) return;
    const lines = checkout.lineItems || [];
    const products = lines.map((line, i) => mapLineItem(line, i));
    emit("dl_purchase", {
      currencyCode: currency,
      purchase: {
        actionField: {
          id: asString(checkout.order?.id || checkout.token || ""),
          order_name: asString(checkout.order?.name || ""),
          revenue: toPrice(checkout.totalPrice?.amount),
          tax: toPrice(checkout.totalTax?.amount),
          shipping: toPrice(checkout.shippingLine?.price?.amount),
          sub_total: toPrice(checkout.subtotalPrice?.amount),
          product_sub_total: toPrice(checkout.subtotalPrice?.amount),
          discount_amount: toPrice(checkout.discountsAmount?.amount || 0),
          sales_channel: "website"
        },
        products
      }
    });
  });
});
