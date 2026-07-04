export type CompatibilityStatus = "available" | "partial" | "missing";

export type CompatibilityPriority = "P0" | "P1" | "P2" | "P3";

export type GtmCompatibilityEntry = {
  priority: CompatibilityPriority;
  legacyVariable: string;
  externalRefs: number;
  suggestedSource: string;
  endpointPath?: string;
  status: CompatibilityStatus;
  eventFamilies: string[];
  notes: string;
};

const ENTRIES: GtmCompatibilityEntry[] = [
  {
    priority: "P0",
    legacyVariable: "GA4 ID",
    externalRefs: 39,
    suggestedSource: "Env-backed GA4 measurement ID",
    endpointPath: "/compatibility/ga4-id",
    status: "available",
    eventFamilies: ["view_item", "view_item_list", "add_to_cart", "begin_checkout", "purchase"],
    notes: "Resolver exists and should be treated as a first-class replacement constant."
  },
  {
    priority: "P0",
    legacyVariable: "dlv - Global - Currency Code",
    externalRefs: 30,
    suggestedSource: "Canonical ecommerce currency with fallback chain",
    endpointPath: "/compatibility/currency-code",
    status: "available",
    eventFamilies: ["add_to_cart", "begin_checkout", "purchase", "view_item"],
    notes: "Resolver exists; payload validation should ensure Hyper and headless emit currency consistently."
  },
  {
    priority: "P0",
    legacyVariable: "dlv - event_id",
    externalRefs: 27,
    suggestedSource: "Deterministic event ID generator",
    endpointPath: "/compatibility/event-id",
    status: "available",
    eventFamilies: ["user_data", "add_to_cart", "purchase", "sign_up"],
    notes: "Critical for dedupe parity across browser and server pipelines."
  },
  {
    priority: "P1",
    legacyVariable: "dlv - Customer ID",
    externalRefs: 15,
    suggestedSource: "Customer identity from runtime/webhook payloads",
    endpointPath: "/compatibility/customer-id",
    status: "available",
    eventFamilies: ["add_to_cart", "begin_checkout", "purchase"],
    notes: "Resolver exists; Hyper runtime payloads must carry customer identity when known."
  },
  {
    priority: "P1",
    legacyVariable: "dlv - Customer Email",
    externalRefs: 13,
    suggestedSource: "Normalized customer email",
    endpointPath: "/compatibility/customer-email",
    status: "available",
    eventFamilies: ["purchase", "sign_up", "subscribe", "user_data"],
    notes: "Resolver exists; destination-specific hashing remains downstream."
  },
  {
    priority: "P1",
    legacyVariable: "dlv - Thank You Page - ecommerce.purchase.products",
    externalRefs: 13,
    suggestedSource: "Canonical purchase items array",
    endpointPath: "/compatibility/purchase-products",
    status: "available",
    eventFamilies: ["purchase"],
    notes: "Resolver exists and is one of the heaviest placeholder dependencies."
  },
  {
    priority: "P1",
    legacyVariable: "Facebook - Pixel ID",
    externalRefs: 12,
    suggestedSource: "Env-backed Meta Pixel constant",
    endpointPath: "/compatibility/facebook-pixel-id",
    status: "available",
    eventFamilies: ["user_data", "view_item", "add_to_cart", "purchase"],
    notes: "Ready to route through GTM constants."
  },
  {
    priority: "P1",
    legacyVariable: "Facebook - product identifier",
    externalRefs: 11,
    suggestedSource: "Canonical product identifier resolver",
    endpointPath: "/compatibility/product-identifier",
    status: "available",
    eventFamilies: ["view_item", "add_to_cart", "purchase"],
    notes: "Shared identifier resolver should stay canonical across Meta, GA4, Pinterest, and TikTok."
  },
  {
    priority: "P2",
    legacyVariable: "GA4 - product identifier",
    externalRefs: 9,
    suggestedSource: "Canonical product identifier resolver",
    endpointPath: "/compatibility/product-identifier",
    status: "available",
    eventFamilies: ["view_item", "add_to_cart", "purchase"],
    notes: "Same Synapse resolver as Meta identifier; maintain one source of truth."
  },
  {
    priority: "P2",
    legacyVariable: "dlv - Thank You Page - Order ID",
    externalRefs: 9,
    suggestedSource: "Canonical order identifier",
    endpointPath: "/compatibility/order-id",
    status: "available",
    eventFamilies: ["purchase"],
    notes: "Resolver exists and is required for conversion and dedupe parity."
  },
  {
    priority: "P2",
    legacyVariable: "Pinterest ID",
    externalRefs: 9,
    suggestedSource: "Env-backed Pinterest tag ID",
    endpointPath: "/compatibility/pinterest-id",
    status: "available",
    eventFamilies: ["user_data", "view_item", "add_to_cart", "purchase"],
    notes: "Available as a constant replacement."
  },
  {
    priority: "P2",
    legacyVariable: "dlv - Cart Total",
    externalRefs: 9,
    suggestedSource: "Canonical ecommerce/cart value",
    endpointPath: "/compatibility/cart-total",
    status: "available",
    eventFamilies: ["add_to_cart", "view_cart", "begin_checkout"],
    notes: "Resolver exists, but event-family payload validation should enforce cart totals across Hyper and headless."
  },
  {
    priority: "P2",
    legacyVariable: "Facebook - product group",
    externalRefs: 8,
    suggestedSource: "Compatibility-layer grouping logic",
    endpointPath: "/compatibility/product-group",
    status: "available",
    eventFamilies: ["view_item", "add_to_cart", "purchase"],
    notes: "Resolver now derives group using product_type first with safe title fallback for parity continuity."
  },
  {
    priority: "P2",
    legacyVariable: "DOM - Page Title",
    externalRefs: 8,
    suggestedSource: "document.title or canonical page context",
    endpointPath: "/compatibility/page-title",
    status: "available",
    eventFamilies: ["page_view", "view_item", "view_item_list", "purchase"],
    notes: "Resolver now supports explicit page_title and page_url-derived fallback title generation."
  },
  {
    priority: "P2",
    legacyVariable: "dlv - ecommerce.checkout.products",
    externalRefs: 7,
    suggestedSource: "Canonical checkout items array",
    endpointPath: "/compatibility/checkout-products",
    status: "available",
    eventFamilies: ["begin_checkout", "add_shipping_info", "add_payment_info"],
    notes: "Available through checkout product resolver."
  },
  {
    priority: "P2",
    legacyVariable: "url - Search - Search Term",
    externalRefs: 7,
    suggestedSource: "Search term resolver",
    endpointPath: "/compatibility/search-term",
    status: "available",
    eventFamilies: ["view_search_results"],
    notes: "Resolver exists; validate future headless route query handling against it."
  },
  {
    priority: "P2",
    legacyVariable: "dlv - ecommerce.impressions",
    externalRefs: 7,
    suggestedSource: "Canonical list impressions array",
    endpointPath: "/compatibility/impressions",
    status: "available",
    eventFamilies: ["view_item_list"],
    notes: "Available via catalog compatibility service."
  },
  {
    priority: "P2",
    legacyVariable: "dlv - Add to Cart - Price",
    externalRefs: 6,
    suggestedSource: "Canonical add-to-cart compatibility resolver",
    endpointPath: "/compatibility/add-to-cart",
    status: "available",
    eventFamilies: ["add_to_cart"],
    notes: "Resolver now emits parity-friendly value and vendor-specific line-item structures for add-to-cart events."
  },
  {
    priority: "P2",
    legacyVariable: "dlv - Thank You Page - Customer Phone Number",
    externalRefs: 6,
    suggestedSource: "Normalized E.164 customer phone",
    endpointPath: "/compatibility/customer-phone",
    status: "available",
    eventFamilies: ["purchase"],
    notes: "Resolver exists."
  },
  {
    priority: "P2",
    legacyVariable: "dlv - Global - Visitor Type",
    externalRefs: 6,
    suggestedSource: "Visitor type resolver",
    endpointPath: "/compatibility/visitor-type",
    status: "available",
    eventFamilies: ["user_data", "view_item", "view_item_list", "purchase"],
    notes: "Resolver exists and feeds consent/runtime policy too."
  },
  {
    priority: "P2",
    legacyVariable: "dlv - Add to Cart - Add Array",
    externalRefs: 6,
    suggestedSource: "Canonical add-to-cart line item translation",
    endpointPath: "/compatibility/add-to-cart",
    status: "available",
    eventFamilies: ["add_to_cart"],
    notes: "Resolver now emits canonical add array plus vendor-ready payload variants (Facebook, GA4, TikTok, Google Ads)."
  },
  {
    priority: "P2",
    legacyVariable: "dlv - Product View - Details Array",
    externalRefs: 6,
    suggestedSource: "Canonical product-view details array",
    endpointPath: "/compatibility/product-view-details",
    status: "available",
    eventFamilies: ["view_item"],
    notes: "Available via catalog compatibility service."
  }
];

export function getGtmCompatibilityMatrix(): GtmCompatibilityEntry[] {
  return ENTRIES;
}

export function getTopPriorityCompatibilityGaps(limit = 10): GtmCompatibilityEntry[] {
  const size = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 50)) : 10;

  return ENTRIES
    .filter((entry) => entry.status !== "available")
    .sort((left, right) => {
      const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
      const byPriority = priorityOrder[left.priority] - priorityOrder[right.priority];
      if (byPriority !== 0) {
        return byPriority;
      }

      return right.externalRefs - left.externalRefs;
    })
    .slice(0, size);
}