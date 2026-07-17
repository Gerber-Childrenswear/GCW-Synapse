export type ShopifyAddress = {
  first_name?: string;
  last_name?: string;
  city?: string;
  province_code?: string;
  zip?: string;
  country_code?: string;
};

export type ShopifyLineItem = {
  sku?: string;
  product_id?: number;
  variant_id?: number;
  variant_title?: string;
  product_type?: string;
  title: string;
  price: string;
  quantity: number;
};

export type ShopifyOrder = {
  name?: string;
  order_number?: number;
  email?: string;
  phone?: string;
  currency: string;
  total_price: string;
  total_tax?: string;
  landing_site?: string;
  note_attributes?: Array<{ name?: string; value?: string }>;
  total_shipping_price_set?: {
    shop_money?: {
      amount?: string;
    };
  };
  customer?: {
    id?: number;
    email?: string;
    first_name?: string;
    last_name?: string;
  };
  billing_address?: ShopifyAddress;
  line_items: ShopifyLineItem[];
};

export type SynapseEventPayload = {
  client_id: string;
  user_id?: string | undefined;
  event_id?: string | undefined;
  event_name: "purchase";
  currency: string;
  value: number;
  tax: number;
  shipping: number;
  transaction_id: string;
  items: Array<{
    item_id?: string | undefined;
    item_name: string;
    item_variant?: string | undefined;
    item_category?: string | undefined;
    price: number;
    quantity: number;
    product_id?: string | undefined;
    sku?: string | undefined;
  }>;
  user_data: {
    email_address?: string | undefined;
    phone_number?: string | undefined;
    address: {
      first_name?: string | undefined;
      last_name?: string | undefined;
      city?: string | undefined;
      region?: string | undefined;
      postal_code?: string | undefined;
      country?: string | undefined;
    };
  };
  marketing?: {
    session_id?: string | undefined;
    landing_site?: string | undefined;
    utm_source?: string | undefined;
    utm_medium?: string | undefined;
    utm_campaign?: string | undefined;
  };
};
