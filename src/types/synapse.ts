export const REQUIRED_EVENTS = [
  "page_view",
  "view_item",
  "view_item_list",
  "view_search_results",
  "add_to_cart",
  "remove_from_cart",
  "view_cart",
  "begin_checkout",
  "add_shipping_info",
  "add_payment_info",
  "purchase",
  "sign_up",
  "login",
  "newsletter_signup"
] as const;

export type SynapseEventName = (typeof REQUIRED_EVENTS)[number];

export type ConsentState = "granted" | "denied" | "unknown";

export type SynapseConsent = {
  analytics_storage?: ConsentState;
  ad_storage?: ConsentState;
  ad_user_data?: ConsentState;
  ad_personalization?: ConsentState;
};

export type SynapseCustomer = {
  id?: string;
  email?: string;
  phone?: string;
  visitor_type?: string;
  customer_tier?: string;
};

export type SynapseProduct = {
  product_id?: string;
  variant_id?: string;
  sku?: string;
  name?: string;
  category?: string;
  brand?: string;
  product_type?: string;
  variant_title?: string;
  item_list_name?: string;
  price?: number;
  quantity?: number;
};

export type SynapseCollection = {
  id?: string;
  name?: string;
  filters?: string[];
};

export type SynapseCart = {
  cart_id?: string;
  total?: number;
  subtotal?: number;
  discount_total?: number;
  currency?: string;
  item_count?: number;
  items?: SynapseProduct[];
};

export type SynapseCheckout = {
  checkout_id?: string;
  order_id?: string;
  revenue?: number;
  shipping?: number;
  tax?: number;
  coupon?: string;
  currency?: string;
  payment_type?: string;
  shipping_tier?: string;
};

export type SynapseMarketing = {
  event_id?: string;
  user_id?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
  click_id?: string;
  fbp?: string;
  fbc?: string;
  destinations?: string[];
};

export type SynapseSession = {
  id?: string;
  page_url?: string;
  page_path?: string;
  referrer?: string;
  timestamp?: string;
  sequence?: number;
  locale?: string;
  user_agent?: string;
};

export type SynapseRuntimeEvent = {
  event_name: SynapseEventName;
  event_id?: string;
  source: "theme" | "customer_events" | "server";
  source_theme?: "hyper" | "expanse" | "unknown";
  source_surface?: "web" | "checkout" | "webhook" | "unknown";
  customer: SynapseCustomer;
  product: SynapseProduct;
  collection: SynapseCollection;
  cart: SynapseCart;
  checkout: SynapseCheckout;
  marketing: SynapseMarketing;
  session: SynapseSession;
  consent: SynapseConsent;
};

export type RuntimeEventDecision = {
  allowed: boolean;
  reason?: string;
};
