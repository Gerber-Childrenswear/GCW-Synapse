export type VendorName =
  | "GA4"
  | "Google Ads"
  | "Facebook"
  | "TikTok"
  | "Pinterest"
  | "Reddit"
  | "StackAdapt"
  | "Bloomreach"
  | "Triple Whale"
  | "Commission Junction"
  | "Server GTM";

export type EventField = {
  name: string;
  type: "string" | "number" | "boolean";
  required: boolean;
  path: string;
  description: string;
  example: string;
};

export type EventSchema = {
  eventName: string;
  description: string;
  fields: EventField[];
  vendors: VendorName[];
};

export type QaChecklistItem = {
  id: string;
  category: "Events" | "Deduplication" | "Consent" | "Vendors" | "GTM";
  description: string;
  status: "pending" | "pass" | "fail";
  notes: string | null;
};

const USER_CONTEXT_FIELDS: EventField[] = [
  {
    name: "visitor_type",
    type: "string",
    required: true,
    path: "user_properties.visitor_type",
    description: "Guest or Logged In (Elevar title case)",
    example: "Logged In"
  },
  {
    name: "customer_id",
    type: "string",
    required: false,
    path: "user_properties.customer_id",
    description: "Shopify customer ID",
    example: "5001234567890"
  },
  {
    name: "customer_email",
    type: "string",
    required: false,
    path: "user_properties.customer_email",
    description: "Hashed or raw email",
    example: "user@example.com"
  },
  {
    name: "user_consent",
    type: "string",
    required: false,
    path: "user_properties.user_consent",
    description: "Consent status: granted | denied | unknown",
    example: "granted"
  }
];

const ITEM_FIELDS: EventField[] = [
  {
    name: "id",
    type: "string",
    required: true,
    path: "ecommerce.items[].id",
    description: "Product or variant ID",
    example: "12345678901234"
  },
  {
    name: "name",
    type: "string",
    required: true,
    path: "ecommerce.items[].name",
    description: "Product title",
    example: "GCW Classic Tee"
  },
  {
    name: "price",
    type: "string",
    required: true,
    path: "ecommerce.items[].price",
    description: "Unit price as string",
    example: "29.99"
  },
  {
    name: "quantity",
    type: "number",
    required: false,
    path: "ecommerce.items[].quantity",
    description: "Quantity",
    example: "2"
  }
];

const EVENT_SCHEMAS: EventSchema[] = [
  {
    eventName: "dl_user_data",
    description:
      "Fired on every page load. Sets user_properties context for all downstream events. Emitted by the theme pixel as user_data and bridged to dl_user_data in GTM.",
    fields: [
      ...USER_CONTEXT_FIELDS,
      {
        name: "cart_total",
        type: "string",
        required: false,
        path: "ecommerce.cart_total",
        description: "Current cart value",
        example: "59.98"
      }
    ],
    vendors: [
      "GA4",
      "Google Ads",
      "Facebook",
      "TikTok",
      "Pinterest",
      "Reddit",
      "StackAdapt",
      "Bloomreach",
      "Triple Whale",
      "Commission Junction",
      "Server GTM"
    ]
  },
  {
    eventName: "dl_view_item",
    description: "Product detail page view. Fires once per PDP load.",
    fields: [
      ...USER_CONTEXT_FIELDS,
      {
        name: "currency",
        type: "string",
        required: true,
        path: "ecommerce.currency",
        description: "ISO currency code",
        example: "USD"
      },
      {
        name: "value",
        type: "number",
        required: true,
        path: "ecommerce.value",
        description: "Total value",
        example: "29.99"
      },
      ...ITEM_FIELDS
    ],
    vendors: ["GA4", "Facebook", "TikTok", "Pinterest", "Reddit", "StackAdapt", "Triple Whale", "Server GTM"]
  },
  {
    eventName: "dl_view_item_list",
    description: "Collection/category page view. Fires with all visible products.",
    fields: [
      ...USER_CONTEXT_FIELDS,
      {
        name: "item_list_name",
        type: "string",
        required: true,
        path: "ecommerce.item_list_name",
        description: "Collection or list name",
        example: "mens-tops"
      },
      ...ITEM_FIELDS
    ],
    vendors: ["GA4", "Facebook", "TikTok", "Pinterest", "Triple Whale", "Server GTM"]
  },
  {
    eventName: "dl_view_search_results",
    description: "Search results page. Fires with search query and result products.",
    fields: [
      ...USER_CONTEXT_FIELDS,
      {
        name: "search_term",
        type: "string",
        required: true,
        path: "ecommerce.search_term",
        description: "The search query entered",
        example: "black tee"
      },
      ...ITEM_FIELDS
    ],
    vendors: ["GA4", "Facebook", "Bloomreach", "Triple Whale"]
  },
  {
    eventName: "dl_add_to_cart",
    description: "Add to cart event. Fires when product is added to Shopify cart.",
    fields: [
      ...USER_CONTEXT_FIELDS,
      {
        name: "currency",
        type: "string",
        required: true,
        path: "ecommerce.currency",
        description: "ISO currency code",
        example: "USD"
      },
      {
        name: "value",
        type: "number",
        required: true,
        path: "ecommerce.value",
        description: "Total value added",
        example: "59.98"
      },
      {
        name: "cart_id",
        type: "string",
        required: false,
        path: "ecommerce.cart_id",
        description: "Shopify cart token",
        example: "abc123carttoken"
      },
      ...ITEM_FIELDS
    ],
    vendors: ["GA4", "Facebook", "TikTok", "Pinterest", "Reddit", "Triple Whale", "Server GTM"]
  },
  {
    eventName: "dl_begin_checkout",
    description: "Checkout initiated. Fires on /checkout page load.",
    fields: [
      ...USER_CONTEXT_FIELDS,
      {
        name: "currency",
        type: "string",
        required: true,
        path: "ecommerce.currency",
        description: "ISO currency code",
        example: "USD"
      },
      {
        name: "value",
        type: "number",
        required: true,
        path: "ecommerce.value",
        description: "Checkout total",
        example: "89.97"
      },
      ...ITEM_FIELDS
    ],
    vendors: ["GA4", "Facebook", "TikTok", "Pinterest", "Reddit", "Triple Whale", "Server GTM"]
  },
  {
    eventName: "dl_add_payment_info",
    description: "Payment step in checkout. Fires when payment method is selected/entered.",
    fields: [
      ...USER_CONTEXT_FIELDS,
      {
        name: "payment_type",
        type: "string",
        required: false,
        path: "ecommerce.payment_type",
        description: "Payment method",
        example: "credit_card"
      },
      ...ITEM_FIELDS
    ],
    vendors: ["GA4", "Facebook", "TikTok", "Server GTM"]
  },
  {
    eventName: "dl_subscribe",
    description: "Email/SMS subscription event. Fires on newsletter signup.",
    fields: [
      ...USER_CONTEXT_FIELDS,
      {
        name: "source",
        type: "string",
        required: false,
        path: "ecommerce.source",
        description: "Subscription source widget",
        example: "footer_newsletter"
      }
    ],
    vendors: ["GA4", "Facebook", "Bloomreach", "Server GTM"]
  },
  {
    eventName: "dl_sign_up",
    description: "Account creation event. Fires when a new customer account is created.",
    fields: [
      ...USER_CONTEXT_FIELDS,
      {
        name: "method",
        type: "string",
        required: false,
        path: "ecommerce.method",
        description: "Sign-up method",
        example: "email"
      }
    ],
    vendors: ["GA4", "Facebook", "Bloomreach", "Server GTM"]
  },
  {
    eventName: "dl_purchase",
    description: "Purchase confirmation. Fires on order status page. Primary conversion event.",
    fields: [
      ...USER_CONTEXT_FIELDS,
      {
        name: "transaction_id",
        type: "string",
        required: true,
        path: "ecommerce.transaction_id",
        description: "Shopify order name",
        example: "#1001"
      },
      {
        name: "order_id",
        type: "string",
        required: true,
        path: "ecommerce.order_id",
        description: "Shopify order ID",
        example: "5001234567890"
      },
      {
        name: "value",
        type: "number",
        required: true,
        path: "ecommerce.value",
        description: "Revenue",
        example: "89.97"
      },
      {
        name: "tax",
        type: "number",
        required: true,
        path: "ecommerce.tax",
        description: "Tax total",
        example: "7.22"
      },
      {
        name: "shipping",
        type: "number",
        required: true,
        path: "ecommerce.shipping",
        description: "Shipping total",
        example: "0"
      },
      {
        name: "currency",
        type: "string",
        required: true,
        path: "ecommerce.currency",
        description: "ISO currency code",
        example: "USD"
      },
      ...ITEM_FIELDS
    ],
    vendors: [
      "GA4",
      "Google Ads",
      "Facebook",
      "TikTok",
      "Pinterest",
      "Reddit",
      "StackAdapt",
      "Bloomreach",
      "Triple Whale",
      "Commission Junction",
      "Server GTM"
    ]
  },
  {
    eventName: "shopify_dl_purchase",
    description:
      "Server-side purchase event. Sent via Shopify web pixel and server webhooks. Deduplicates with dl_purchase using order_id.",
    fields: [
      ...USER_CONTEXT_FIELDS,
      {
        name: "transaction_id",
        type: "string",
        required: true,
        path: "ecommerce.transaction_id",
        description: "Shopify order name",
        example: "#1001"
      },
      {
        name: "order_id",
        type: "string",
        required: true,
        path: "ecommerce.order_id",
        description: "Shopify order ID",
        example: "5001234567890"
      },
      {
        name: "value",
        type: "number",
        required: true,
        path: "ecommerce.value",
        description: "Revenue",
        example: "89.97"
      },
      {
        name: "currency",
        type: "string",
        required: true,
        path: "ecommerce.currency",
        description: "ISO currency code",
        example: "USD"
      },
      ...ITEM_FIELDS
    ],
    vendors: ["GA4", "Google Ads", "Facebook", "Server GTM"]
  }
];

const QA_CHECKLIST: QaChecklistItem[] = [
  {
    id: "product-view",
    category: "Events",
    description: "dl_view_item fires on PDP with correct items array and user_properties",
    status: "pending",
    notes: null
  },
  {
    id: "collection-view",
    category: "Events",
    description: "dl_view_item_list fires on collection pages with item_list_name",
    status: "pending",
    notes: null
  },
  {
    id: "search-results",
    category: "Events",
    description: "dl_view_search_results fires with search_term and result items",
    status: "pending",
    notes: null
  },
  {
    id: "add-to-cart",
    category: "Events",
    description: "dl_add_to_cart fires with cart_id, value, and items",
    status: "pending",
    notes: null
  },
  {
    id: "begin-checkout",
    category: "Events",
    description: "dl_begin_checkout fires on /checkout with correct value and items",
    status: "pending",
    notes: null
  },
  {
    id: "purchase-web",
    category: "Events",
    description: "dl_purchase fires on order status page with transaction_id, order_id, tax, shipping",
    status: "pending",
    notes: null
  },
  {
    id: "purchase-server",
    category: "Events",
    description: "shopify_dl_purchase received via server webhook, event_id matches dl_purchase dedupe",
    status: "pending",
    notes: null
  },
  {
    id: "dedupe-check",
    category: "Deduplication",
    description: "dl_purchase and shopify_dl_purchase share same event_id for same order_id",
    status: "pending",
    notes: null
  },
  {
    id: "consent-gate",
    category: "Consent",
    description: "Events blocked before consent resolution, flushed after CookieConsent fires",
    status: "pending",
    notes: null
  },
  {
    id: "commerce-shield-cj",
    category: "Consent",
    description: "Commission Junction suppressed when analytics+marketing consent not granted",
    status: "pending",
    notes: null
  },
  {
    id: "reddit-capi",
    category: "Vendors",
    description: "Reddit CAPI purchase event forwarded through GTM-N45F3JCC server container",
    status: "pending",
    notes: "Verify Commerce Shield forwarder tag in server container"
  },
  {
    id: "stackadapt-pixel",
    category: "Vendors",
    description: "StackAdapt universal pixel fires on dl_user_data for audience building",
    status: "pending",
    notes: null
  },
  {
    id: "triple-whale",
    category: "Vendors",
    description: "Triple Whale purchase event includes order_id, revenue, and items",
    status: "pending",
    notes: null
  },
  {
    id: "cj-purchase",
    category: "Vendors",
    description: "CJ tag receives purchase with OID, AMOUNT, CURRENCY, ITEMS",
    status: "pending",
    notes: null
  },
  {
    id: "gtm-web-container",
    category: "GTM",
    description: "GTM-TKW58K8 workspace197 triggers all dl_* events correctly after Elevar removal",
    status: "pending",
    notes: "140 tags, 99 triggers, 276 variables"
  },
  {
    id: "gtm-server-container",
    category: "GTM",
    description: "GTM-N45F3JCC receives shopify_dl_purchase and routes to GA4, Facebook, Reddit",
    status: "pending",
    notes: null
  }
];

const CONTROL_PANEL_VENDORS: VendorName[] = [
  "GA4",
  "Google Ads",
  "Facebook",
  "TikTok",
  "Pinterest",
  "Reddit",
  "StackAdapt",
  "Bloomreach",
  "Triple Whale",
  "Commission Junction",
  "Server GTM"
];

export function getControlPanelSchemas(): EventSchema[] {
  return EVENT_SCHEMAS;
}

export function getControlPanelChecklist(): QaChecklistItem[] {
  return QA_CHECKLIST;
}

export function getControlPanelVendors(): Array<{ name: VendorName; enabled: boolean }> {
  return CONTROL_PANEL_VENDORS.map((name) => ({ name, enabled: true }));
}

export type ThemeAdapterKey = "hyper" | "expanse" | "headless";

export type ThemeAdapterProfile = {
  key: ThemeAdapterKey;
  label: string;
  expectedRuntimeEvents: string[];
};

export type ThemeAdapterCoverage = {
  adapter: ThemeAdapterKey;
  summary: {
    expected_events: number;
    mapped_events: number;
    coverage_pct: number;
  };
  events: Array<{
    runtimeEvent: string;
    catalogEvent: string | null;
    mapped: boolean;
  }>;
};

export type ThemeAdapterReadinessSummary = {
  adapter: ThemeAdapterKey;
  status: "ready" | "in_progress" | "blocked";
  validation: {
    warnings: number;
    errors: number;
  };
  recommendations: string[];
  topGaps: string[];
};

const THEME_ADAPTER_PROFILES: ThemeAdapterProfile[] = [
  {
    key: "hyper",
    label: "Hyper",
    expectedRuntimeEvents: [
      "user_data",
      "page_view",
      "view_item",
      "view_item_list",
      "view_search_results",
      "add_to_cart",
      "view_cart",
      "begin_checkout",
      "add_shipping_info",
      "add_payment_info"
    ]
  },
  {
    key: "expanse",
    label: "Expanse",
    expectedRuntimeEvents: [
      "user_data",
      "page_view",
      "view_item",
      "view_item_list",
      "view_search_results",
      "add_to_cart",
      "view_cart",
      "begin_checkout",
      "add_shipping_info",
      "add_payment_info"
    ]
  },
  {
    key: "headless",
    label: "Headless",
    expectedRuntimeEvents: [
      "user_data",
      "page_view",
      "view_item",
      "add_to_cart",
      "begin_checkout",
      "purchase"
    ]
  }
];

export function getThemeAdapterProfiles(): ThemeAdapterProfile[] {
  return THEME_ADAPTER_PROFILES;
}

export function getThemeAdapterCoverage(
  adapterKey: ThemeAdapterKey,
  mappings: Record<string, string>
): ThemeAdapterCoverage | null {
  const profile = THEME_ADAPTER_PROFILES.find((entry) => entry.key === adapterKey);
  if (!profile) {
    return null;
  }

  const events = profile.expectedRuntimeEvents.map((runtimeEvent) => {
    const catalogEvent = mappings[runtimeEvent] ?? null;
    return {
      runtimeEvent,
      catalogEvent,
      mapped: Boolean(catalogEvent)
    };
  });

  const mappedEvents = events.filter((event) => event.mapped).length;

  return {
    adapter: adapterKey,
    summary: {
      expected_events: profile.expectedRuntimeEvents.length,
      mapped_events: mappedEvents,
      coverage_pct:
        profile.expectedRuntimeEvents.length > 0
          ? Number.parseFloat(((mappedEvents / profile.expectedRuntimeEvents.length) * 100).toFixed(2))
          : 0
    },
    events
  };
}

export function summarizeThemeAdapterReadiness(
  coverage: ThemeAdapterCoverage,
  validation: { warnings: number; errors: number }
): ThemeAdapterReadinessSummary {
  const topGaps = coverage.events.filter((event) => !event.mapped).map((event) => event.runtimeEvent);
  const recommendations: string[] = [];

  if (topGaps.length > 0) {
    recommendations.push(`Map missing runtime events in /api/mappings: ${topGaps.join(", ")}.`);
  }

  if (validation.errors > 0) {
    recommendations.push("Resolve runtime catalog validation errors before cutover.");
  }

  if (validation.warnings > 0) {
    recommendations.push("Review runtime catalog validation warnings in GTM Preview.");
  }

  let status: ThemeAdapterReadinessSummary["status"] = "ready";
  if (validation.errors > 0 || topGaps.length > 0) {
    status = validation.errors > 0 ? "blocked" : "in_progress";
  }

  return {
    adapter: coverage.adapter,
    status,
    validation,
    recommendations,
    topGaps
  };
}
