(function () {
  "use strict";

  var endpoint = window.GCW_SYNAPSE_ENDPOINT || "/event";
  var ingressToken = window.GCW_SYNAPSE_INGRESS_TOKEN || "";
  var queueKey = "gcw_synapse_pending_events";
  var dedupeTtlMs = 1200;
  var maxQueueSize = 25;
  var sequence = 0;
  var lastSentByKey = {};
  var allowedEventNames = {
    user_data: true,
    page_view: true,
    view_item: true,
    view_item_list: true,
    view_search_results: true,
    add_to_cart: true,
    remove_from_cart: true,
    view_cart: true,
    begin_checkout: true,
    add_shipping_info: true,
    add_payment_info: true,
    purchase: true,
    sign_up: true,
    login: true,
    newsletter_signup: true
  };

  var destinationHintsByEvent = {
    user_data: ["ga4", "meta", "instagram", "pinterest", "stackadapt", "google_ads"],
    page_view: ["ga4", "meta", "instagram", "pinterest", "stackadapt"],
    view_item: ["ga4", "meta", "instagram", "tiktok", "pinterest", "stackadapt", "triple_whale"],
    view_item_list: ["ga4", "meta", "instagram", "tiktok", "pinterest", "google_ads"],
    view_search_results: ["ga4", "meta", "instagram", "tiktok", "pinterest", "google_ads"],
    add_to_cart: ["ga4", "meta", "instagram", "tiktok", "pinterest", "reddit", "google_ads", "triple_whale", "bloomreach"],
    remove_from_cart: ["ga4", "google_ads"],
    view_cart: ["ga4", "google_ads"],
    begin_checkout: ["ga4", "meta", "instagram", "tiktok", "pinterest", "reddit", "google_ads", "triple_whale"],
    add_shipping_info: ["ga4", "meta", "instagram", "tiktok"],
    add_payment_info: ["ga4", "meta", "instagram", "tiktok"],
    purchase: ["ga4", "meta", "instagram", "tiktok", "pinterest", "reddit", "google_ads", "triple_whale", "bloomreach", "commission_junction", "stackadapt"],
    sign_up: ["ga4", "meta", "instagram", "tiktok", "pinterest"],
    login: ["ga4"],
    newsletter_signup: ["ga4", "meta", "instagram", "tiktok", "pinterest", "bloomreach"]
  };

  function nowIso() {
    return new Date().toISOString();
  }

  function randomId(prefix) {
    return prefix + "_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function detectTheme() {
    var candidates = [];
    if (window.theme && typeof window.theme.name === "string") candidates.push(window.theme.name);
    if (window.Shopify && window.Shopify.theme && typeof window.Shopify.theme.name === "string") candidates.push(window.Shopify.theme.name);
    if (document.documentElement && document.documentElement.getAttribute) {
      var dataTheme = document.documentElement.getAttribute("data-theme");
      if (dataTheme) candidates.push(dataTheme);
    }
    var source = candidates.join(" ").toLowerCase();
    if (source.indexOf("hyper") !== -1) return "hyper";
    if (source.indexOf("expanse") !== -1) return "expanse";
    return "unknown";
  }

  function readCookie(name) {
    var parts = (document.cookie || "").split("; ");
    for (var i = 0; i < parts.length; i += 1) {
      var entry = parts[i].split("=");
      if (entry[0] === name) {
        return decodeURIComponent(entry.slice(1).join("="));
      }
    }
    return undefined;
  }

  function collectMarketingContext() {
    var params = new URLSearchParams(window.location.search || "");
    return {
      source: params.get("utm_source") || document.referrer || "direct",
      medium: params.get("utm_medium") || undefined,
      campaign: params.get("utm_campaign") || undefined,
      term: params.get("utm_term") || undefined,
      content: params.get("utm_content") || undefined,
      click_id: params.get("gclid") || params.get("fbclid") || params.get("ttclid") || undefined,
      fbp: readCookie("_fbp"),
      fbc: readCookie("_fbc")
    };
  }

  function destinationHints(eventName) {
    return destinationHintsByEvent[eventName] || ["ga4", "server_gtm"];
  }

  function readVisitorType() {
    if (window.commerceShield && typeof window.commerceShield.visitorType === "string") {
      return window.commerceShield.visitorType;
    }

    if (window.commerceShield && typeof window.commerceShield.classification === "string") {
      return window.commerceShield.classification;
    }

    return "unknown";
  }

  function readConsent() {
    var consent = {
      analytics_storage: "unknown",
      ad_storage: "unknown",
      ad_user_data: "unknown",
      ad_personalization: "unknown"
    };

    var p = window.pandectes;
    if (p && p.consent) {
      consent.analytics_storage = p.consent.analytics ? "granted" : "denied";
      consent.ad_storage = p.consent.marketing ? "granted" : "denied";
      consent.ad_user_data = p.consent.marketing ? "granted" : "denied";
      consent.ad_personalization = p.consent.marketing ? "granted" : "denied";
    }

    return consent;
  }

  function readUserConsentLabel(consent) {
    var c = consent || {};
    if (c.ad_user_data === "granted" || c.analytics_storage === "granted") {
      return "granted";
    }
    if (c.ad_user_data === "denied" && c.analytics_storage === "denied") {
      return "denied";
    }
    return "unknown";
  }

  function buildLegacyUserDataFields(payload) {
    var customer = payload.customer || {};
    var cart = payload.cart || {};
    var consent = payload.consent || readConsent();

    return {
      user_properties: {
        visitor_type: customer.visitor_type,
        customer_id: customer.id,
        customer_email: customer.email,
        user_consent: readUserConsentLabel(consent)
      },
      ecommerce: {
        cart_total: cart.total != null ? String(cart.total) : undefined,
        currency: cart.currency
      }
    };
  }

  function parseCartJs(cart) {
    if (!cart) {
      return {};
    }

    var totalCents = Number(cart.total_price);
    var total = Number.isFinite(totalCents) ? totalCents / 100 : undefined;

    return {
      cart_id: cart.token ? String(cart.token) : undefined,
      total: total,
      currency: typeof cart.currency === "string" ? cart.currency : undefined,
      item_count: typeof cart.item_count === "number" ? cart.item_count : undefined
    };
  }

  function fetchCartSnapshot(callback) {
    fetch("/cart.js", {
      credentials: "same-origin",
      headers: {
        Accept: "application/json"
      }
    })
      .then(function (response) {
        if (!response.ok) {
          return null;
        }
        return response.json();
      })
      .then(function (cart) {
        callback(parseCartJs(cart));
      })
      .catch(function () {
        callback({});
      });
  }

  function baseState() {
    var customerEmail = window.ShopifyAnalytics && window.ShopifyAnalytics.meta && window.ShopifyAnalytics.meta.page ? window.ShopifyAnalytics.meta.page.customerEmail : undefined;

    return {
      customer: {
        id: window.Shopify && window.Shopify.customerId ? String(window.Shopify.customerId) : undefined,
        email: customerEmail,
        visitor_type: readVisitorType()
      },
      product: {},
      collection: {},
      cart: {},
      checkout: {},
      marketing: {
        source: document.referrer || "direct"
      },
      session: {
        id: window.GCW_SYNAPSE_SESSION_ID || (window.GCW_SYNAPSE_SESSION_ID = randomId("session")),
        page_url: window.location.href,
        page_path: window.location.pathname,
        referrer: document.referrer || "",
        timestamp: nowIso(),
        sequence: sequence,
        locale: document.documentElement && document.documentElement.lang ? document.documentElement.lang : undefined,
        user_agent: window.navigator && window.navigator.userAgent ? window.navigator.userAgent : undefined
      },
      consent: readConsent()
    };
  }

  function merge(target, source) {
    var out = Object.assign({}, target);
    Object.keys(source || {}).forEach(function (key) {
      var value = source[key];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        out[key] = merge(out[key] || {}, value);
      } else {
        out[key] = value;
      }
    });
    return out;
  }

  function queueEvent(payload) {
    try {
      var raw = window.localStorage.getItem(queueKey);
      var queue = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(queue)) {
        queue = [];
      }

      queue.push(payload);
      if (queue.length > maxQueueSize) {
        queue = queue.slice(queue.length - maxQueueSize);
      }
      window.localStorage.setItem(queueKey, JSON.stringify(queue));
    } catch (_e) {
      return;
    }
  }

  function flushQueue(headers) {
    try {
      var raw = window.localStorage.getItem(queueKey);
      var queue = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(queue) || queue.length === 0) {
        return;
      }

      window.localStorage.removeItem(queueKey);
      queue.forEach(function (item) {
        fetch(endpoint, {
          method: "POST",
          headers: headers,
          credentials: "same-origin",
          body: JSON.stringify(item),
          keepalive: true
        }).catch(function () {
          queueEvent(item);
          return undefined;
        });
      });
    } catch (_e) {
      return;
    }
  }

  function buildDedupeKey(eventName, payload) {
    var p = payload || {};
    return [
      eventName,
      p.product && p.product.product_id ? String(p.product.product_id) : "",
      p.product && p.product.variant_id ? String(p.product.variant_id) : "",
      p.cart && p.cart.cart_id ? String(p.cart.cart_id) : "",
      p.session && p.session.page_url ? String(p.session.page_url) : window.location.pathname
    ].join("|");
  }

  function postEvent(eventName, patch) {
    if (!allowedEventNames[eventName]) {
      return;
    }

    sequence += 1;

    var state = baseState();
    state.session.sequence = sequence;
    state.session.timestamp = nowIso();

    var payload = merge(state, patch || {});
    payload.event_name = eventName;
    payload.source = "theme";
    payload.source_theme = detectTheme();
    payload.source_surface = "web";
    payload.marketing = merge(collectMarketingContext(), payload.marketing || {});
    payload.marketing.destinations = destinationHints(eventName);
    payload.event_id = payload.marketing && payload.marketing.event_id ? payload.marketing.event_id : randomId("evt");

    var dedupeKey = buildDedupeKey(eventName, payload);
    var now = Date.now();
    if (lastSentByKey[dedupeKey] && now - lastSentByKey[dedupeKey] < dedupeTtlMs) {
      return;
    }
    lastSentByKey[dedupeKey] = now;

    window.dataLayer = window.dataLayer || [];
    var dataLayerEvent = {
      event: "gcw_synapse_event",
      event_name: payload.event_name,
      event_id: payload.event_id,
      gcwSynapse: {
        customer: payload.customer,
        product: payload.product,
        collection: payload.collection,
        cart: payload.cart,
        checkout: payload.checkout,
        marketing: payload.marketing,
        session: payload.session,
        consent: payload.consent
      }
    };

    if (eventName === "user_data") {
      var legacyUserData = buildLegacyUserDataFields(payload);
      dataLayerEvent.user_properties = legacyUserData.user_properties;
      dataLayerEvent.ecommerce = legacyUserData.ecommerce;
    }

    window.dataLayer.push(dataLayerEvent);

    var headers = {
      "Content-Type": "application/json"
    };

    if (ingressToken) {
      headers["X-Synapse-Token"] = ingressToken;
    }

    fetch(endpoint, {
      method: "POST",
      headers: headers,
      credentials: "same-origin",
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(function () {
      queueEvent(payload);
      return undefined;
    });

    flushQueue(headers);
  }

  function trackPageView() {
    postEvent("page_view", {
      marketing: {
        event_id: randomId("pv")
      }
    });
  }

  function trackUserData(cartPatch) {
    var state = baseState();
    postEvent("user_data", {
      cart: cartPatch || {},
      marketing: {
        event_id: randomId("ud"),
        user_id: state.customer && state.customer.id ? state.customer.id : undefined
      }
    });
  }

  function trackUserDataWithCart() {
    fetchCartSnapshot(function (cartPatch) {
      trackUserData(cartPatch);
    });
  }

  function trackSearch() {
    var query = new URLSearchParams(window.location.search).get("q");
    if (!query) {
      return;
    }

    postEvent("view_search_results", {
      collection: {
        name: "search"
      },
      marketing: {
        event_id: randomId("search")
      },
      session: {
        page_url: window.location.href
      }
    });
  }

  function bindHyperEvents() {
    var supported = {
      "hyper:variant:change": "view_item",
      "hyper:quickadd:success": "add_to_cart",
      "hyper:cart:drawer:open": "view_cart",
      "hyper:collection:impression": "view_item_list",
      "hyper:collection:filter": "view_item_list",
      "hyper:search:results": "view_search_results",
      "hyper:checkout:begin": "begin_checkout",
      "hyper:checkout:shipping": "add_shipping_info",
      "hyper:checkout:payment": "add_payment_info"
    };

    Object.keys(supported).forEach(function (eventName) {
      document.addEventListener(eventName, function (evt) {
        var detail = evt && evt.detail ? evt.detail : {};
        postEvent(supported[eventName], {
          product: {
            product_id: detail.product_id ? String(detail.product_id) : undefined,
            variant_id: detail.variant_id ? String(detail.variant_id) : undefined,
            sku: detail.sku,
            name: detail.name,
            category: detail.category,
            price: typeof detail.price === "number" ? detail.price : undefined,
            quantity: typeof detail.quantity === "number" ? detail.quantity : undefined
          },
          collection: {
            id: detail.collection_id ? String(detail.collection_id) : undefined,
            name: detail.collection_name,
            filters: Array.isArray(detail.filters) ? detail.filters : undefined
          },
          cart: {
            cart_id: detail.cart_id,
            total: typeof detail.cart_total === "number" ? detail.cart_total : undefined,
            currency: detail.currency,
            item_count: typeof detail.item_count === "number" ? detail.item_count : undefined
          },
          marketing: {
            event_id: detail.event_id || randomId("hyper")
          }
        });
      });
    });
  }

  function bindExpanseEvents() {
    var supported = {
      "expanse:variant:change": "view_item",
      "expanse:quickadd:success": "add_to_cart",
      "expanse:cart:drawer:open": "view_cart",
      "expanse:collection:impression": "view_item_list",
      "expanse:collection:filter": "view_item_list",
      "expanse:search:results": "view_search_results",
      "expanse:checkout:begin": "begin_checkout",
      "expanse:checkout:shipping": "add_shipping_info",
      "expanse:checkout:payment": "add_payment_info"
    };

    Object.keys(supported).forEach(function (eventName) {
      document.addEventListener(eventName, function (evt) {
        var detail = evt && evt.detail ? evt.detail : {};
        postEvent(supported[eventName], {
          product: {
            product_id: detail.product_id ? String(detail.product_id) : undefined,
            variant_id: detail.variant_id ? String(detail.variant_id) : undefined,
            sku: detail.sku,
            name: detail.name,
            category: detail.category,
            brand: detail.brand,
            product_type: detail.product_type,
            variant_title: detail.variant_title,
            item_list_name: detail.item_list_name,
            price: typeof detail.price === "number" ? detail.price : undefined,
            quantity: typeof detail.quantity === "number" ? detail.quantity : undefined
          },
          collection: {
            id: detail.collection_id ? String(detail.collection_id) : undefined,
            name: detail.collection_name,
            filters: Array.isArray(detail.filters) ? detail.filters : undefined
          },
          cart: {
            cart_id: detail.cart_id,
            total: typeof detail.cart_total === "number" ? detail.cart_total : undefined,
            subtotal: typeof detail.cart_subtotal === "number" ? detail.cart_subtotal : undefined,
            discount_total: typeof detail.cart_discount_total === "number" ? detail.cart_discount_total : undefined,
            currency: detail.currency,
            item_count: typeof detail.item_count === "number" ? detail.item_count : undefined
          },
          marketing: {
            event_id: detail.event_id || randomId("expanse")
          }
        });
      });
    });
  }

  function bindNativeFallbacks() {
    document.addEventListener("CartDrawer:open", function () {
      postEvent("view_cart", {
        marketing: {
          event_id: randomId("expanse_drawer_open")
        }
      });
    });

    document.addEventListener("drawerOpen", function () {
      postEvent("view_cart", {
        marketing: {
          event_id: randomId("drawer_open")
        }
      });
    });

    document.addEventListener("CartDrawer:change", function () {
      postEvent("view_cart", {
        marketing: {
          event_id: randomId("cart_change")
        }
      });
    });

    document.addEventListener("collection:reloaded", function () {
      postEvent("view_item_list", {
        collection: {
          name: document.title || "collection"
        },
        marketing: {
          event_id: randomId("collection_reload")
        }
      });
    });

    document.addEventListener("predictiveSearch:open", function () {
      trackSearch();
    });

    document.addEventListener("submit", function (evt) {
      var form = evt.target;
      if (!(form instanceof HTMLFormElement)) {
        return;
      }

      var action = form.getAttribute("action") || "";
      if (action.indexOf("/cart/add") !== -1) {
        postEvent("add_to_cart", {
          marketing: {
            event_id: randomId("native_add")
          }
        });
      }

      if (action.indexOf("/account/login") !== -1) {
        postEvent("login", {
          marketing: {
            event_id: randomId("native_login")
          }
        });
      }

      if (
        form.matches('.newsletter-form, form[action*="/contact"]') ||
        form.querySelector('input[name="contact[email]"]') ||
        form.querySelector('input[name*="newsletter"]')
      ) {
        postEvent("newsletter_signup", {
          marketing: {
            event_id: randomId("newsletter")
          }
        });
      }
    }, true);

    document.addEventListener("click", function (evt) {
      var target = evt.target;
      if (!target || !target.closest) return;
      var quickAddBtn = target.closest('.js-modal-open-quick-add, .js-quick-add-open, .js-br-quick-add, .quick-add-btn, [data-single-variant-quick-add]');
      if (quickAddBtn) {
        postEvent("view_item", {
          product: {
            product_id: quickAddBtn.getAttribute("data-product-id") || quickAddBtn.getAttribute("data-productid") || undefined,
            variant_id: quickAddBtn.getAttribute("data-variant-id") || undefined,
            name: quickAddBtn.getAttribute("data-product-title") || quickAddBtn.getAttribute("aria-label") || undefined
          },
          marketing: {
            event_id: randomId("quick_add_open")
          }
        });
      }

      var addBtn = target.closest('[name="add"], button[data-add-to-cart], .add-to-cart, [data-product-atc]');
      if (addBtn) {
        postEvent("add_to_cart", {
          marketing: {
            event_id: randomId("native_click_add")
          }
        });
      }
    }, true);

    window.addEventListener("pageshow", function (evt) {
      if (evt.persisted) {
        trackPageView();
        trackUserDataWithCart();
      }
    });
  }

  window.gcwSynapse = {
    emit: postEvent,
    state: baseState,
    version: "1.0.0"
  };

  bindHyperEvents();
  bindExpanseEvents();
  bindNativeFallbacks();
  window.addEventListener("online", function () {
    var headers = {
      "Content-Type": "application/json"
    };
    if (ingressToken) {
      headers["X-Synapse-Token"] = ingressToken;
    }
    flushQueue(headers);
  });
  trackPageView();
  trackUserDataWithCart();
  trackSearch();
})();
