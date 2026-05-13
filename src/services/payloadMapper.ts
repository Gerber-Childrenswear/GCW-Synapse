import type { ShopifyOrder, SynapseEventPayload } from "../types/shopify";

function toNumber(value: string | undefined): number {
  const parsed = Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

export function mapOrderToPurchase(order: ShopifyOrder): SynapseEventPayload {
  return {
    client_id: order.customer?.id?.toString() ?? "guest",
    user_id: order.customer?.email ?? order.email,
    event_name: "purchase",
    currency: order.currency,
    value: toNumber(order.total_price),
    tax: toNumber(order.total_tax),
    shipping: toNumber(order.total_shipping_price_set?.shop_money?.amount),
    transaction_id: order.order_number?.toString() ?? order.name ?? "unknown-order",
    items: order.line_items.map((item) => ({
      item_id: item.sku ?? item.product_id?.toString(),
      item_name: item.title,
      price: toNumber(item.price),
      quantity: item.quantity
    })),
    user_data: {
      email_address: order.email,
      phone_number: order.phone,
      address: {
        first_name: order.customer?.first_name ?? order.billing_address?.first_name,
        last_name: order.customer?.last_name ?? order.billing_address?.last_name,
        city: order.billing_address?.city,
        region: order.billing_address?.province_code,
        postal_code: order.billing_address?.zip,
        country: order.billing_address?.country_code
      }
    }
  };
}
