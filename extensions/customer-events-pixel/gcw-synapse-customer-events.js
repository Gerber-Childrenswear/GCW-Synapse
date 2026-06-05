/* global analytics */
(function () {
  "use strict";

  var endpoint = "https://gcw-synapse.your-domain.com/event";
  var ingressToken = "";
  var dedupeTtlMs = 1200;
  var lastSentByKey = {};
  var endpointConfigured = endpoint.indexOf("your-domain") === -1;
  var allowedEventNames = {
    begin_checkout: true,
    add_shipping_info: true,
    add_payment_info: true,
    purchase: true
  };

  var destinationHintsByEvent = {
    begin_checkout: ["ga4", "meta", "instagram", "tiktok", "pinterest", "reddit", "triple_whale"],
    add_shipping_info: ["ga4", "meta", "instagram", "tiktok"],
    add_payment_info: ["ga4", "meta", "instagram", "tiktok"],
    purchase: ["ga4", "meta", "instagram", "tiktok", "pinterest", "reddit", "google_ads", "triple_whale", "bloomreach", "commission_junction", "stackadapt"]
  };

  function randomId(prefix) {
    return prefix + "_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function destinationHints(eventName) {
    return destinationHintsByEvent[eventName] || ["ga4", "server_gtm"];
  }

  function readConsent(context) {
    var c = context && context.consent ? context.consent : {};
    return {
      analytics_storage: c.analytics ? "granted" : "denied",
      ad_storage: c.marketing ? "granted" : "denied",
      ad_user_data: c.marketing ? "granted" : "denied",
      ad_personalization: c.marketing ? "granted" : "denied"
    };
  }

  function publish(eventName, payload) {
    if (!allowedEventNames[eventName]) {
      return Promise.resolve();
    }

    if (!endpointConfigured) {
      // Fail closed: never send to the placeholder domain. The endpoint must be
      // set to the deployed GCW-Synapse URL before this pixel is published.
      return Promise.resolve();
    }

    var dedupeKey = [
      eventName,
      payload && payload.session && payload.session.id ? payload.session.id : "",
      payload && payload.checkout && payload.checkout.checkout_id ? payload.checkout.checkout_id : "",
      payload && payload.marketing && payload.marketing.event_id ? payload.marketing.event_id : ""
    ].join("|");

    var now = Date.now();
    if (lastSentByKey[dedupeKey] && now - lastSentByKey[dedupeKey] < dedupeTtlMs) {
      return Promise.resolve();
    }
    lastSentByKey[dedupeKey] = now;

    var headers = {
      "Content-Type": "application/json"
    };

    if (ingressToken) {
      headers["X-Synapse-Token"] = ingressToken;
    }

    var body = JSON.stringify({
      event_name: eventName,
      event_id: payload.marketing.event_id,
      source: "customer_events",
      source_theme: payload.source_theme || "unknown",
      source_surface: "checkout",
      customer: payload.customer,
      product: payload.product,
      collection: payload.collection,
      cart: payload.cart,
      checkout: payload.checkout,
      marketing: payload.marketing,
      session: payload.session,
      consent: payload.consent
    });

    function send() {
      return fetch(endpoint, {
        method: "POST",
        headers: headers,
        body: body,
        keepalive: true
      });
    }

    return send().catch(function () {
      // Single retry to absorb transient network blips during checkout.
      return send().catch(function () {
        return undefined;
      });
    });
  }

  function basePayload(evt) {
    var data = evt && evt.data ? evt.data : {};
    var context = evt && evt.context ? evt.context : {};

    return {
      customer: {
        id: data.customer && data.customer.id ? String(data.customer.id) : undefined,
        email: data.customer && data.customer.email ? data.customer.email : undefined,
        visitor_type: context.visitorType || "unknown"
      },
      product: {},
      collection: {},
      cart: {
        cart_id: data.cart && data.cart.id ? String(data.cart.id) : undefined,
        total: data.cart && typeof data.cart.totalAmount === "number" ? data.cart.totalAmount : undefined,
        currency: data.currencyCode,
        item_count: data.cart && typeof data.cart.linesCount === "number" ? data.cart.linesCount : undefined
      },
      checkout: {
        checkout_id: data.checkout && data.checkout.token ? String(data.checkout.token) : undefined,
        order_id: data.checkout && data.checkout.order && data.checkout.order.id ? String(data.checkout.order.id) : undefined,
        revenue: data.checkout && typeof data.checkout.totalPrice === "number" ? data.checkout.totalPrice : undefined,
        shipping: data.checkout && typeof data.checkout.shippingPrice === "number" ? data.checkout.shippingPrice : undefined,
        tax: data.checkout && typeof data.checkout.totalTax === "number" ? data.checkout.totalTax : undefined
      },
      marketing: {
        event_id: data.eventId || randomId("ce"),
        user_id: data.customer && data.customer.id ? String(data.customer.id) : undefined,
        source: context.document && context.document.referrer ? context.document.referrer : "direct",
        medium: data.marketing && data.marketing.medium ? data.marketing.medium : undefined,
        campaign: data.marketing && data.marketing.campaign ? data.marketing.campaign : undefined,
        term: data.marketing && data.marketing.term ? data.marketing.term : undefined,
        content: data.marketing && data.marketing.content ? data.marketing.content : undefined
      },
      session: {
        id: context.sessionId || randomId("checkout"),
        page_url: context.document && context.document.location ? context.document.location.href : undefined,
        page_path: context.document && context.document.location ? context.document.location.pathname : undefined,
        referrer: context.document && context.document.referrer ? context.document.referrer : "",
        timestamp: new Date().toISOString(),
        locale: context.document && context.document.documentElement ? context.document.documentElement.lang : undefined,
        user_agent: context.navigator && context.navigator.userAgent ? context.navigator.userAgent : undefined
      },
      consent: readConsent(context),
      source_theme: data.theme && typeof data.theme === "string" ? data.theme.toLowerCase() : "unknown"
    };
  }

  analytics.subscribe("checkout_started", function (evt) {
    var payload = basePayload(evt);
    payload.marketing.destinations = destinationHints("begin_checkout");
    publish("begin_checkout", payload);
  });

  analytics.subscribe("checkout_shipping_info_submitted", function (evt) {
    var payload = basePayload(evt);
    payload.marketing.destinations = destinationHints("add_shipping_info");
    publish("add_shipping_info", payload);
  });

  analytics.subscribe("checkout_payment_info_submitted", function (evt) {
    var payload = basePayload(evt);
    payload.marketing.destinations = destinationHints("add_payment_info");
    publish("add_payment_info", payload);
  });

  analytics.subscribe("checkout_completed", function (evt) {
    var payload = basePayload(evt);
    payload.marketing.destinations = destinationHints("purchase");
    publish("purchase", payload);
  });
})();
