(function () {
  "use strict";

  function nowIso() {
    return new Date().toISOString();
  }

  function randomId(prefix) {
    return prefix + "_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function baseSynapseState() {
    return {
      customer: {
        id: "123456789",
        email: "preview.user@example.com",
        phone: "+18005550199",
        visitor_type: "human",
        customer_tier: "returning"
      },
      product: {
        product_id: "9001",
        variant_id: "9001-RED-S",
        sku: "GCW-FOOTIE-RED-S",
        name: "Organic Cotton Footie",
        category: "Footies",
        price: 49.98,
        quantity: 1
      },
      collection: {
        id: "spring-collection",
        name: "Spring Collection",
        filters: ["new", "organic"]
      },
      cart: {
        cart_id: "cart-preview-001",
        total: 49.98,
        currency: "USD",
        item_count: 1,
        items: [
          {
            product_id: "9001",
            variant_id: "9001-RED-S",
            sku: "GCW-FOOTIE-RED-S",
            name: "Organic Cotton Footie",
            category: "Footies",
            price: 49.98,
            quantity: 1
          }
        ]
      },
      checkout: {
        checkout_id: "checkout-preview-001",
        order_id: "100042",
        revenue: 49.98,
        shipping: 4.99,
        tax: 3.5,
        coupon: "WELCOME10"
      },
      marketing: {
        event_id: randomId("mkt"),
        user_id: "123456789",
        source: "preview_console",
        medium: "manual",
        campaign: "synapse_placeholder_probe"
      },
      session: {
        id: "session-preview-001",
        page_url: window.location.href,
        referrer: document.referrer || "",
        timestamp: nowIso(),
        sequence: 1
      },
      consent: {
        analytics_storage: "granted",
        ad_storage: "granted",
        ad_user_data: "granted",
        ad_personalization: "granted"
      }
    };
  }

  function merge(base, patch) {
    var out = Object.assign({}, base);
    Object.keys(patch || {}).forEach(function (key) {
      var next = patch[key];
      if (next && typeof next === "object" && !Array.isArray(next)) {
        out[key] = merge(out[key] || {}, next);
      } else {
        out[key] = next;
      }
    });
    return out;
  }

  function pushSynapseEvent(eventName, patch) {
    var base = baseSynapseState();
    var merged = merge(base, patch || {});
    var eventId = (merged.marketing && merged.marketing.event_id) || randomId("evt");

    merged.marketing = merged.marketing || {};
    merged.marketing.event_id = eventId;
    merged.session = merged.session || {};
    merged.session.timestamp = nowIso();

    window.dataLayer = window.dataLayer || [];
    var dataLayerEvent = {
      event: "gcw_synapse_event",
      event_name: eventName,
      event_id: eventId,
      gcwSynapse: {
        customer: merged.customer,
        product: merged.product,
        collection: merged.collection,
        cart: merged.cart,
        checkout: merged.checkout,
        marketing: merged.marketing,
        session: merged.session,
        consent: merged.consent
      }
    };

    if (eventName === "user_data") {
      dataLayerEvent.user_properties = {
        visitor_type: merged.customer && merged.customer.visitor_type,
        customer_id: merged.customer && merged.customer.id,
        customer_email: merged.customer && merged.customer.email,
        user_consent: merged.consent && merged.consent.ad_user_data
      };
      dataLayerEvent.ecommerce = {
        cart_total: merged.cart && merged.cart.total != null ? String(merged.cart.total) : undefined,
        currency: merged.cart && merged.cart.currency
      };
    }

    window.dataLayer.push(dataLayerEvent);

    console.log("[GCW Synapse Preview] pushed", {
      event: "gcw_synapse_event",
      event_name: eventName,
      event_id: eventId,
      expected_legacy_event: "dl_" + eventName
    });
  }

  function runDefaultSuite() {
    pushSynapseEvent("user_data", {
      cart: {
        cart_id: "cart-preview-001",
        total: 49.98,
        currency: "USD",
        item_count: 1
      }
    });
    pushSynapseEvent("page_view");
    pushSynapseEvent("view_item");
    pushSynapseEvent("add_to_cart", {
      cart: {
        item_count: 2,
        total: 99.96
      },
      product: {
        quantity: 2
      }
    });
    pushSynapseEvent("begin_checkout", {
      cart: {
        total: 104.95,
        item_count: 2
      }
    });
    pushSynapseEvent("purchase", {
      checkout: {
        order_id: "100043",
        revenue: 104.95,
        tax: 7.35,
        shipping: 6.99,
        coupon: "SUMMER15"
      },
      cart: {
        total: 104.95,
        item_count: 2
      }
    });
  }

  window.GCWSynapsePreview = {
    push: pushSynapseEvent,
    runDefaultSuite: runDefaultSuite
  };

  console.log("[GCW Synapse Preview] harness loaded.");
  console.log("Use GCWSynapsePreview.push('add_to_cart') or GCWSynapsePreview.runDefaultSuite().");
})();
