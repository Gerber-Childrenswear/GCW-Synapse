import { register } from "@shopify/web-pixels-extension";

function asString(value) {
  if (value == null) return "";
  return String(value);
}

function toPrice(amount) {
  if (amount == null) return "0.0";
  const n = typeof amount === "number" ? amount : Number.parseFloat(String(amount));
  if (!Number.isFinite(n)) return "0.0";
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

function mapVariantProduct(variant, index = 0) {
  const product = variant?.product || {};
  const sku = variant?.sku || "";
  const variantId = asString(variant?.id || "");
  const productId = asString(product.id || "");
  return {
    id: sku || variantId || productId,
    name: asString(product.title || ""),
    brand: asString(product.vendor || ""),
    category: asString(product.type || ""),
    variant: asString(variant?.title || ""),
    price: toPrice(variant?.price?.amount),
    quantity: "1",
    position: index + 1,
    product_id: productId,
    variant_id: variantId,
    compare_at_price: toPrice(variant?.compareAtPrice?.amount ?? "0.0"),
    image: asString(variant?.image?.src || product.image?.src || ""),
    url: asString(product.url || "")
  };
}

function buildEventId(parts) {
  return parts.filter(Boolean).join("|").slice(0, 120);
}

function addressProps(address) {
  if (!address || typeof address !== "object") return {};
  return {
    customer_first_name: address.firstName || address.first_name || undefined,
    customer_last_name: address.lastName || address.last_name || undefined,
    customer_phone: address.phone || undefined,
    customer_address_1: address.address1 || undefined,
    customer_city: address.city || undefined,
    customer_province_code: address.provinceCode || address.province_code || undefined,
    customer_zip: address.zip || undefined,
    customer_country_code: address.countryCode || address.country_code || undefined
  };
}

function checkoutUserProperties(checkout, baseUser) {
  const shipping = checkout?.shippingAddress || checkout?.shipping_address || {};
  const billing = checkout?.billingAddress || checkout?.billing_address || {};
  const email = checkout?.email || baseUser.customer_email;
  const phone = shipping.phone || billing.phone || checkout?.phone;
  return {
    ...baseUser,
    visitor_type: email || baseUser.customer_id ? "Logged In" : baseUser.visitor_type || "Guest",
    customer_email: email || undefined,
    customer_phone: phone || undefined,
    ...addressProps(shipping.address1 || shipping.city ? shipping : billing)
  };
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
  const beaconUrl =
    settings?.beaconUrl || "https://gcw-synapse-super.gcwsynapse.workers.dev/browser/beacon";
  const shop = settings?.shopDomain || init?.data?.shop?.myshopifyDomain || "";
  const currency =
    init?.data?.shop?.paymentSettings?.currencyCode ||
    init?.data?.cart?.cost?.totalAmount?.currencyCode ||
    "USD";

  const baseUser = {
    visitor_type: init?.data?.customer?.id || init?.data?.customer?.email ? "Logged In" : "Guest",
    customer_id: init?.data?.customer?.id ? asString(init.data.customer.id) : undefined,
    customer_email: init?.data?.customer?.email || undefined,
    customer_first_name: init?.data?.customer?.firstName || undefined,
    customer_last_name: init?.data?.customer?.lastName || undefined,
    customer_phone: init?.data?.customer?.phone || undefined,
    customer_order_count:
      init?.data?.customer?.ordersCount != null ? asString(init.data.customer.ordersCount) : undefined
  };

  function emit(eventName, ecommerce, extras = {}) {
    const event_id = buildEventId([shop, eventName, Date.now().toString(36)]);
    const payload = {
      source: "synapse-web-pixel",
      shop,
      event: eventName,
      event_id,
      currency,
      user_properties: extras.user_properties || baseUser,
      ecommerce,
      ...extras,
      observed_at: new Date().toISOString()
    };
    sendBeacon(beaconUrl, payload);
  }

  function checkoutTotal(checkout) {
    return toPrice(checkout?.totalPrice?.amount ?? checkout?.total_price);
  }

  // Storefront mirrors (checkout sandbox / pages without theme JS).
  analytics.subscribe("product_viewed", (event) => {
    const variant = event.data?.productVariant;
    if (!variant) return;
    const product = mapVariantProduct(variant);
    emit("dl_view_item", {
      currencyCode: currency,
      detail: {
        actionField: { list: "web_pixel", action: "detail" },
        products: [product]
      }
    });
  });

  analytics.subscribe("product_added_to_cart", (event) => {
    const line = event.data?.cartLine;
    if (!line) return;
    const product = mapLineItem(line, 0);
    emit(
      "dl_add_to_cart",
      {
        currencyCode: currency,
        add: {
          actionField: { list: "web_pixel" },
          products: [product]
        }
      },
      { cart_total: toPrice(event.data?.cart?.cost?.totalAmount?.amount) || product.price }
    );
  });

  analytics.subscribe("product_removed_from_cart", (event) => {
    const line = event.data?.cartLine;
    if (!line) return;
    emit(
      "dl_remove_from_cart",
      {
        currencyCode: currency,
        remove: {
          actionField: { list: "web_pixel" },
          products: [mapLineItem(line, 0)]
        }
      },
      { cart_total: toPrice(event.data?.cart?.cost?.totalAmount?.amount) }
    );
  });

  analytics.subscribe("cart_viewed", (event) => {
    const lines = event.data?.cart?.lines || [];
    const impressions = lines.map((line, i) => mapLineItem(line, i));
    emit(
      "dl_view_cart",
      {
        currencyCode: currency,
        actionField: {},
        cart_contents: { products: impressions },
        impressions
      },
      { cart_total: toPrice(event.data?.cart?.cost?.totalAmount?.amount) }
    );
  });

  analytics.subscribe("checkout_started", (event) => {
    const checkout = event.data?.checkout;
    const lines = checkout?.lineItems || [];
    const products = lines.map((line, i) => mapLineItem(line, i));
    emit(
      "dl_begin_checkout",
      {
        currencyCode: currency,
        checkout: {
          actionField: { step: "1" },
          products
        }
      },
      {
        cart_total: checkoutTotal(checkout),
        user_properties: checkoutUserProperties(checkout, baseUser)
      }
    );
  });

  analytics.subscribe("checkout_shipping_info_submitted", (event) => {
    const checkout = event.data?.checkout;
    const lines = checkout?.lineItems || [];
    const products = lines.map((line, i) => mapLineItem(line, i));
    const user_properties = checkoutUserProperties(checkout, baseUser);
    emit(
      "dl_user_data",
      {
        currencyCode: currency,
        cart_contents: { products }
      },
      { cart_total: checkoutTotal(checkout), user_properties }
    );
    emit(
      "dl_add_shipping_info",
      {
        currencyCode: currency,
        checkout: {
          actionField: { step: "2" },
          products
        }
      },
      { cart_total: checkoutTotal(checkout), user_properties }
    );
  });

  analytics.subscribe("payment_info_submitted", (event) => {
    const checkout = event.data?.checkout;
    const lines = checkout?.lineItems || [];
    const products = lines.map((line, i) => mapLineItem(line, i));
    emit(
      "dl_add_payment_info",
      {
        currencyCode: currency,
        checkout: {
          actionField: { step: "3" },
          products
        }
      },
      {
        cart_total: checkoutTotal(checkout),
        user_properties: checkoutUserProperties(checkout, baseUser)
      }
    );
  });

  analytics.subscribe("checkout_completed", (event) => {
    const checkout = event.data?.checkout;
    if (!checkout) return;
    const lines = checkout.lineItems || [];
    const products = lines.map((line, i) => mapLineItem(line, i));
    const user_properties = checkoutUserProperties(checkout, baseUser);
    const cart_total = checkoutTotal(checkout);

    // Thank-you user_data first — GTM thank-you triggers expect this Elevar shape.
    emit(
      "dl_user_data",
      {
        currencyCode: currency,
        cart_contents: { products }
      },
      { cart_total, user_properties }
    );

    emit(
      "dl_purchase",
      {
        currencyCode: currency,
        purchase: {
          actionField: {
            id: asString(checkout.order?.id || checkout.token || ""),
            order_name: asString(checkout.order?.name || ""),
            revenue: cart_total,
            tax: toPrice(checkout.totalTax?.amount),
            shipping: toPrice(checkout.shippingLine?.price?.amount),
            sub_total: toPrice(checkout.subtotalPrice?.amount),
            product_sub_total: toPrice(checkout.subtotalPrice?.amount),
            discount_amount: toPrice(checkout.discountsAmount?.amount || 0),
            sales_channel: "website"
          },
          products
        }
      },
      { cart_total, user_properties }
    );
  });
});
