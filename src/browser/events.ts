import { pushDataLayerEvent } from "./push";
import { sendBeacon } from "./beacon";
import { getOrCreateSession } from "./session";
import { toSynapseProduct } from "./product";
import { buildUserProperties } from "./userProperties";
import { shouldEmitOnce } from "./emitDedupe";
import type { SynapseConfig, SynapseDataLayerEvent, SynapseProduct } from "./types";

function productKey(event: SynapseDataLayerEvent): string {
  const ecommerce = event.ecommerce;
  if (!ecommerce || typeof ecommerce !== "object") return "";
  const root = ecommerce as Record<string, unknown>;
  const ids: string[] = [];
  for (const bucket of ["detail", "add", "remove", "click", "checkout", "purchase", "cart_contents"]) {
    const nested = root[bucket];
    if (nested && typeof nested === "object") {
      const products = (nested as { products?: unknown }).products;
      if (Array.isArray(products)) {
        for (const item of products) {
          if (!item || typeof item !== "object") continue;
          const row = item as Record<string, unknown>;
          const id = row.variant_id ?? row.product_id ?? row.id;
          if (id != null) ids.push(String(id));
        }
      }
    }
  }
  return ids.slice(0, 6).join(",");
}

function emit(config: SynapseConfig, event: SynapseDataLayerEvent): SynapseDataLayerEvent | null {
  const path = typeof location !== "undefined" ? location.pathname : "";
  const products = productKey(event);
  // ATC often fires from both form submit and /cart/add.js with slightly different id shapes.
  const dedupeKey =
    event.event === "dl_add_to_cart" || event.event === "dl_remove_from_cart"
      ? `${config.shop}|${event.event}|${path}`
      : `${config.shop}|${event.event}|${path}|${products}|${event.cart_total ?? ""}`;
  const ttl =
    event.event === "dl_user_data"
      ? 800
      : event.event === "dl_add_to_cart" || event.event === "dl_remove_from_cart"
        ? 2200
        : 1600;
  if (!shouldEmitOnce(dedupeKey, ttl)) {
    if (config.debug) {
      // eslint-disable-next-line no-console
      console.info("[Synapse] deduped", event.event);
    }
    return null;
  }

  const session = getOrCreateSession();
  const withMarketing: SynapseDataLayerEvent = {
    ...event,
    user_properties: event.user_properties ?? buildUserProperties(config),
    marketing: {
      landing_site: session.landing_site,
      ...(session.utm_source ? { utm_source: session.utm_source } : {}),
      ...(session.utm_medium ? { utm_medium: session.utm_medium } : {}),
      ...(session.utm_campaign ? { utm_campaign: session.utm_campaign } : {}),
      ...(session.utm_content ? { utm_content: session.utm_content } : {}),
      ...(session.utm_term ? { utm_term: session.utm_term } : {}),
      ...(event.marketing || {})
    }
  };

  const pushed = pushDataLayerEvent(withMarketing, {
    shop: config.shop,
    debug: Boolean(config.debug)
  });

  sendBeacon(config.beaconUrl, config.shop, pushed, session, config.beaconSampleRate ?? 1);
  return pushed;
}

function cartTotalFromProducts(products: SynapseProduct[], fallback?: string): string {
  if (fallback && fallback !== "0" && fallback !== "0.0" && fallback !== "0.00") return fallback;
  let sum = 0;
  let any = false;
  for (const p of products) {
    const price = Number.parseFloat(String(p.price ?? "0"));
    const qty = Number.parseFloat(String(p.quantity ?? "1"));
    if (Number.isFinite(price) && Number.isFinite(qty)) {
      sum += price * qty;
      any = true;
    }
  }
  return any ? sum.toFixed(2) : fallback ?? "0.0";
}

/** Elevar pushes currencyCode; some GTM vars also read ecommerce.currency. */
function withCurrency(config: SynapseConfig, ecommerce: Record<string, unknown>): Record<string, unknown> {
  const code = config.currency || "USD";
  return {
    currencyCode: code,
    currency: code,
    ...ecommerce
  };
}

export function emitUserData(config: SynapseConfig): void {
  const cartItems = config.cart?.items ?? [];
  emit(config, {
    event: "dl_user_data",
    cart_total: config.cart?.total ?? "0.0",
    ecommerce: withCurrency(config, {
      cart_contents: { products: cartItems }
    })
  });
}

export function emitViewItem(config: SynapseConfig): void {
  if (!config.product) return;
  const v = config.product.selectedVariant;
  const product = toSynapseProduct({
    sku: v.sku,
    name: config.product.title,
    brand: config.product.vendor,
    category: config.product.type,
    variant: v.title,
    price: v.price,
    productId: config.product.id,
    variantId: v.id,
    compareAtPrice: v.compareAtPrice,
    image: v.image,
    url: config.product.url,
    list: config.page?.path
  });

  emit(config, {
    event: "dl_view_item",
    ecommerce: withCurrency(config, {
      detail: {
        actionField: {
          list: config.page?.path || location.pathname,
          action: "detail"
        },
        products: [product]
      }
    })
  });
}

export function emitViewItemList(config: SynapseConfig): void {
  const impressions = config.collection?.products ?? [];
  if (!impressions.length) return;

  emit(config, {
    event: "dl_view_item_list",
    ecommerce: withCurrency(config, { impressions })
  });
}

export function emitViewSearchResults(config: SynapseConfig): void {
  const impressions = config.search?.products ?? [];
  if (!config.search?.terms && !impressions.length) return;

  emit(config, {
    event: "dl_view_search_results",
    ecommerce: withCurrency(config, {
      actionField: { list: "search results" },
      impressions
    })
  });
}

export function emitSelectItem(config: SynapseConfig, product: SynapseProduct, list?: string): void {
  emit(config, {
    event: "dl_select_item",
    ecommerce: withCurrency(config, {
      click: {
        actionField: {
          list: list || location.pathname,
          action: "click"
        },
        products: [product]
      }
    })
  });
}

export function emitAddToCart(config: SynapseConfig, products: SynapseProduct[]): void {
  if (!products.length) return;
  emit(config, {
    event: "dl_add_to_cart",
    cart_total: cartTotalFromProducts(products, config.cart?.total),
    ecommerce: withCurrency(config, {
      add: {
        actionField: { list: location.pathname },
        products
      }
    })
  });
}

export function emitRemoveFromCart(config: SynapseConfig, products: SynapseProduct[]): void {
  if (!products.length) return;
  emit(config, {
    event: "dl_remove_from_cart",
    cart_total: config.cart?.total ?? "0.0",
    ecommerce: withCurrency(config, {
      remove: {
        actionField: { list: location.pathname },
        products
      }
    })
  });
}

export function emitViewCart(config: SynapseConfig): void {
  const items = config.cart?.items ?? [];
  emit(config, {
    event: "dl_view_cart",
    cart_total: config.cart?.total ?? "0.0",
    ecommerce: withCurrency(config, {
      actionField: {},
      // Elevar GTM reads cart_contents.products; keep impressions for list-style tags.
      cart_contents: { products: items },
      impressions: items
    })
  });
}

export function emitBeginCheckout(config: SynapseConfig, products?: SynapseProduct[]): void {
  const items = products ?? config.cart?.items ?? [];
  emit(config, {
    event: "dl_begin_checkout",
    cart_total: cartTotalFromProducts(items, config.cart?.total),
    ecommerce: withCurrency(config, {
      checkout: {
        actionField: { step: "1" },
        products: items
      }
    })
  });
}

export function emitAddShippingInfo(config: SynapseConfig, products?: SynapseProduct[]): void {
  const items = products ?? config.cart?.items ?? [];
  emit(config, {
    event: "dl_add_shipping_info",
    cart_total: cartTotalFromProducts(items, config.cart?.total),
    ecommerce: withCurrency(config, {
      checkout: {
        actionField: { step: "2" },
        products: items
      }
    })
  });
}

export function emitAddPaymentInfo(config: SynapseConfig, products?: SynapseProduct[]): void {
  const items = products ?? config.cart?.items ?? [];
  emit(config, {
    event: "dl_add_payment_info",
    cart_total: cartTotalFromProducts(items, config.cart?.total),
    ecommerce: withCurrency(config, {
      checkout: {
        actionField: { step: "3" },
        products: items
      }
    })
  });
}

export function emitPurchase(
  config: SynapseConfig,
  actionField: Record<string, string>,
  products: SynapseProduct[]
): void {
  emit(config, {
    event: "dl_purchase",
    cart_total: actionField.revenue || cartTotalFromProducts(products, config.cart?.total),
    ecommerce: withCurrency(config, {
      purchase: {
        actionField,
        products
      }
    })
  });
}

export function emitSignUp(config: SynapseConfig): void {
  emit(config, { event: "dl_sign_up" });
}

export function emitLogin(config: SynapseConfig): void {
  emit(config, { event: "dl_login" });
}

export function emitSubscribe(
  config: SynapseConfig,
  leadType: "email" | "phone",
  contact: { email?: string; phone?: string }
): void {
  const user = buildUserProperties(config);
  if (contact.email) user.customer_email = contact.email;
  if (contact.phone) user.customer_phone = contact.phone;

  emit(config, {
    event: "dl_subscribe",
    lead_type: leadType,
    user_properties: user
  });
}
