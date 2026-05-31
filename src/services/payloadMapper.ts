import type { ShopifyOrder, ShopifyRefund, SynapseEventPayload } from "../types/shopify";
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

function sumRefundValue(refund: ShopifyRefund): number {
  const transactions = Array.isArray(refund.transactions) ? refund.transactions : [];
  let total = 0;

  for (const tx of transactions) {
    const kind = String(tx.kind ?? "").toLowerCase();
    const status = String(tx.status ?? "").toLowerCase();
    if (status === "failure") {
      continue;
    }

    // Shopify usually marks refund amounts in transactions with kind=refund.
    if (kind === "refund" || kind === "suggested_refund") {
      total += Math.abs(toNumber(tx.amount));
    }
  }

  if (total > 0) {
    return total;
  }

  const refundItems = Array.isArray(refund.refund_line_items) ? refund.refund_line_items : [];
  return refundItems.reduce((sum, item) => {
    const qty = item.quantity ?? item.line_item?.quantity ?? 0;
    const price = item.line_item?.price;
    return sum + Math.abs(toNumber(price) * qty);
  }, 0);
}

function mapRefundLineItems(refund: ShopifyRefund) {
  const refundItems = Array.isArray(refund.refund_line_items) ? refund.refund_line_items : [];
  const normalized = refundItems.map((item) => {
    const lineItem = item.line_item;
    const normalizedItem: {
      sku?: string;
      product_id?: number;
      variant_id?: number;
      variant_title?: string;
      product_type?: string;
      title: string;
      price: string;
      quantity: number;
    } = {
      title: lineItem?.title ?? "Refunded Item",
      price: lineItem?.price ?? "0",
      quantity: item.quantity ?? lineItem?.quantity ?? 0
    };

    if (lineItem?.sku) {
      normalizedItem.sku = lineItem.sku;
    }
    if (lineItem?.product_id != null) {
      normalizedItem.product_id = lineItem.product_id;
    }
    if (lineItem?.variant_id != null) {
      normalizedItem.variant_id = lineItem.variant_id;
    }
    if (lineItem?.variant_title) {
      normalizedItem.variant_title = lineItem.variant_title;
    }
    if (lineItem?.product_type) {
      normalizedItem.product_type = lineItem.product_type;
    }

    return normalizedItem;
  });

  return resolvePurchaseProducts(normalized);
}

export function mapRefundToRefundEvent(
  refund: ShopifyRefund,
  defaultCurrency = "USD",
  eventId?: string,
  fallbackCustomerId = "guest"
): SynapseEventPayload {
  const resolvedCustomerId = resolveCustomerId(
    {
      customerId: refund.customer?.id
    },
    fallbackCustomerId
  );
  const resolvedCustomerEmail = resolveCustomerEmail({
    customerEmail: refund.customer?.email,
    checkoutEmail: refund.email
  });

  const currency = resolveCurrencyCode(
    {
      ecommerceCurrency: refund.currency
    },
    defaultCurrency
  );

  const refundTax = (Array.isArray(refund.refund_line_items) ? refund.refund_line_items : []).reduce(
    (sum, item) => sum + Math.abs(toNumber(item.total_tax)),
    0
  );

  return {
    client_id: resolvedCustomerId,
    user_id: resolvedCustomerEmail,
    event_id: eventId,
    event_name: "refund",
    currency,
    value: sumRefundValue(refund),
    tax: refundTax,
    shipping: 0,
    transaction_id: resolveOrderId({
      orderNumber: refund.order_id,
      orderName: refund.order_name
    }),
    items: mapRefundLineItems(refund),
    user_data: {
      email_address: resolvedCustomerEmail,
      phone_number: normalizeCustomerPhone(refund.phone),
      address: {
        first_name: refund.customer?.first_name ?? refund.billing_address?.first_name,
        last_name: refund.customer?.last_name ?? refund.billing_address?.last_name,
        city: refund.billing_address?.city,
        region: refund.billing_address?.province_code,
        postal_code: refund.billing_address?.zip,
        country: refund.billing_address?.country_code
      }
    }
  };
}
