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

  function nowIso() {
    return new Date().toISOString();
  }

  function randomId(prefix) {
    return prefix + "_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
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
        referrer: document.referrer || "",
        timestamp: nowIso(),
        sequence: sequence
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
    payload.event_id = payload.marketing && payload.marketing.event_id ? payload.marketing.event_id : randomId("evt");

    var dedupeKey = buildDedupeKey(eventName, payload);
    var now = Date.now();
    if (lastSentByKey[dedupeKey] && now - lastSentByKey[dedupeKey] < dedupeTtlMs) {
      return;
    }
    lastSentByKey[dedupeKey] = now;

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
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
    });

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

  function bindNativeFallbacks() {
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
    }, true);

    window.addEventListener("pageshow", function (evt) {
      if (evt.persisted) {
        trackPageView();
      }
    });
  }

  window.gcwSynapse = {
    emit: postEvent,
    state: baseState,
    version: "1.0.0"
  };

  bindHyperEvents();
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
  trackSearch();
})();
