export type SynapseProduct = {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  variant?: string;
  price: string;
  quantity?: string;
  position?: number;
  list?: string;
  product_id: string;
  variant_id: string;
  compare_at_price?: string;
  image?: string;
  url?: string;
};

export type SynapseUserProperties = {
  /** Elevar GTM contract uses title case: "Logged In" | "Guest". */
  visitor_type: "Logged In" | "Guest";
  customer_id?: string;
  customer_email?: string;
  customer_first_name?: string;
  customer_last_name?: string;
  customer_phone?: string;
  customer_order_count?: string;
  customer_total_spent?: string;
  customer_address_1?: string;
  customer_city?: string;
  customer_province?: string;
  customer_province_code?: string;
  customer_zip?: string;
  customer_country?: string;
  customer_country_code?: string;
};

export type SynapseConfig = {
  shop: string;
  currency: string;
  beaconUrl?: string;
  /** Fraction of non-funnel events mirrored to Worker (0–1). Default 1 during dual-run. GTM uses dataLayer either way. */
  beaconSampleRate?: number;
  debug?: boolean;
  enabled?: boolean;
  customer?: {
    id?: number | null;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    orderCount?: number;
    totalSpent?: string;
    address1?: string | null;
    city?: string | null;
    province?: string | null;
    provinceCode?: string | null;
    zip?: string | null;
    country?: string | null;
    countryCode?: string | null;
  };
  page?: {
    type?: string;
    path?: string;
    title?: string;
    searchTerm?: string;
  };
  cart?: {
    total?: string;
    itemCount?: number;
    items?: SynapseProduct[];
  };
  product?: {
    id: number;
    title: string;
    vendor?: string;
    type?: string;
    url?: string;
    selectedVariant: {
      id: number;
      sku?: string;
      title?: string;
      price: string;
      compareAtPrice?: string;
      image?: string;
    };
  };
  collection?: {
    handle?: string;
    title?: string;
    path?: string;
    products?: SynapseProduct[];
  };
  search?: {
    terms?: string;
    products?: SynapseProduct[];
  };
};

export type SynapseDataLayerEvent = {
  event: string;
  event_id?: string;
  cart_total?: string;
  lead_type?: string;
  user_properties?: SynapseUserProperties;
  marketing?: {
    landing_site?: string;
    user_id?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
  };
  ecommerce?: Record<string, unknown>;
  [key: string]: unknown;
};

declare global {
  interface Window {
    dataLayer: Array<Record<string, unknown>>;
    SynapseDataLayer: Array<Record<string, unknown>>;
    SynapseConfig?: SynapseConfig;
    SynapseInvalidateContext?: () => void;
    Synapse?: {
      push: (event: SynapseDataLayerEvent) => void;
      getSession: () => Record<string, string>;
      version: string;
    };
  }
}

export {};
