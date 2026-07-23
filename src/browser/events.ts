import { pushDataLayerEvent } from "./push";
import { sendBeacon } from "./beacon";
import { getOrCreateSession } from "./session";
import { toSynapseProduct } from "./product";
import { buildUserProperties } from "./userProperties";
import type { SynapseConfig, SynapseDataLayerEvent, SynapseProduct } from "./types";

function emit(config: SynapseConfig, event: SynapseDataLayerEvent): SynapseDataLayerEvent {
  const session = getOrCreateSession();
  const withMarketing: SynapseDataLayerEvent = {
    ...event,
    user_properties: event.user_properties ?? buildUserProperties(config),
    marketing: {
      landing_site: session.landing_site,
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

export function emitUserData(config: SynapseConfig): void {
  const cartItems = config.cart?.items ?? [];
  emit(config, {
    event: "dl_user_data",
    cart_total: config.cart?.total ?? "0.0",
    ecommerce: {
      currencyCode: config.currency,
      cart_contents: { products: cartItems }
    }
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
    ecommerce: {
      currencyCode: config.currency,
      detail: {
        actionField: {
          list: config.page?.path || location.pathname,
          action: "detail"
        },
        products: [product]
      }
    }
  });
}

export function emitViewItemList(config: SynapseConfig): void {
  const impressions = config.collection?.products ?? [];
  if (!impressions.length) return;

  emit(config, {
    event: "dl_view_item_list",
    ecommerce: {
      currencyCode: config.currency,
      impressions
    }
  });
}

export function emitViewSearchResults(config: SynapseConfig): void {
  const impressions = config.search?.products ?? [];
  if (!config.search?.terms && !impressions.length) return;

  emit(config, {
    event: "dl_view_search_results",
    ecommerce: {
      currencyCode: config.currency,
      actionField: { list: "search results" },
      impressions
    }
  });
}

export function emitSelectItem(config: SynapseConfig, product: SynapseProduct, list?: string): void {
  emit(config, {
    event: "dl_select_item",
    ecommerce: {
      currencyCode: config.currency,
      click: {
        actionField: {
          list: list || location.pathname,
          action: "click"
        },
        products: [product]
      }
    }
  });
}

export function emitAddToCart(config: SynapseConfig, products: SynapseProduct[]): void {
  if (!products.length) return;
  emit(config, {
    event: "dl_add_to_cart",
    ecommerce: {
      currencyCode: config.currency,
      add: {
        actionField: { list: location.pathname },
        products
      }
    }
  });
}

export function emitRemoveFromCart(config: SynapseConfig, products: SynapseProduct[]): void {
  if (!products.length) return;
  emit(config, {
    event: "dl_remove_from_cart",
    ecommerce: {
      currencyCode: config.currency,
      remove: {
        actionField: { list: location.pathname },
        products
      }
    }
  });
}

export function emitViewCart(config: SynapseConfig): void {
  const impressions = config.cart?.items ?? [];
  emit(config, {
    event: "dl_view_cart",
    cart_total: config.cart?.total ?? "0.0",
    ecommerce: {
      currencyCode: config.currency,
      actionField: {},
      impressions
    }
  });
}

export function emitBeginCheckout(config: SynapseConfig, products?: SynapseProduct[]): void {
  const items = products ?? config.cart?.items ?? [];
  emit(config, {
    event: "dl_begin_checkout",
    ecommerce: {
      currencyCode: config.currency,
      checkout: {
        actionField: { step: "1" },
        products: items
      }
    }
  });
}

export function emitAddShippingInfo(config: SynapseConfig, products?: SynapseProduct[]): void {
  const items = products ?? config.cart?.items ?? [];
  emit(config, {
    event: "dl_add_shipping_info",
    ecommerce: {
      currencyCode: config.currency,
      checkout: {
        actionField: { step: "2" },
        products: items
      }
    }
  });
}

export function emitAddPaymentInfo(config: SynapseConfig, products?: SynapseProduct[]): void {
  const items = products ?? config.cart?.items ?? [];
  emit(config, {
    event: "dl_add_payment_info",
    ecommerce: {
      currencyCode: config.currency,
      checkout: {
        actionField: { step: "3" },
        products: items
      }
    }
  });
}

export function emitPurchase(
  config: SynapseConfig,
  actionField: Record<string, string>,
  products: SynapseProduct[]
): void {
  emit(config, {
    event: "dl_purchase",
    ecommerce: {
      currencyCode: config.currency,
      purchase: {
        actionField,
        products
      }
    }
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
