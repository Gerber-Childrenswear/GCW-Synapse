import type { ShopifyOrder, SynapseEventPayload } from "../types/shopify";
import { resolveCustomerEmail, resolveCustomerId } from "./customerIdentity";
import { normalizeCustomerPhone } from "./customerPhone";
import { resolveCurrencyCode } from "./currencyCode";
import { resolveOrderId } from "./orderId";
import { resolvePurchaseProducts } from "./purchaseProducts";

function toNumber(value: string | undefined): number {
  const parsed = Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

export function mapOrderToPurchase(
  order: ShopifyOrder,
  defaultCurrency = "USD",
  eventId?: string,
  fallbackCustomerId = "guest"
): SynapseEventPayload {
  const resolvedCustomerId = resolveCustomerId(
    {
      customerId: order.customer?.id
    },
    fallbackCustomerId
  );
  const resolvedCustomerEmail = resolveCustomerEmail({
    customerEmail: order.customer?.email,
    checkoutEmail: order.email
  });

  const currency = resolveCurrencyCode(
    {
      ecommerceCurrency: order.currency
    },
    defaultCurrency
  );

  return {
    client_id: resolvedCustomerId,
    user_id: resolvedCustomerEmail,
    event_id: eventId,
    event_name: "purchase",
    currency,
    value: toNumber(order.total_price),
    tax: toNumber(order.total_tax),
    shipping: toNumber(order.total_shipping_price_set?.shop_money?.amount),
    transaction_id: resolveOrderId({
      orderNumber: order.order_number,
      orderName: order.name
    }),
    items: resolvePurchaseProducts(order.line_items),
    user_data: {
      email_address: resolvedCustomerEmail,
      phone_number: normalizeCustomerPhone(order.phone),
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
