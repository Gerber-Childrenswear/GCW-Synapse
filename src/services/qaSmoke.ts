import { resolveEventId } from "./eventId";
import { createForwardHeaders } from "./gtmForwarder";
import { mapOrderToPurchase, mapRefundToRefundEvent } from "./payloadMapper";
import { evaluateRuntimeEventPolicy } from "./runtimeEventPolicy";
import { isRuntimeDuplicate, parseRuntimeEvent } from "./runtimeEvents";
import { getShadowParityReport } from "./shadowCompare";
import type { ShopifyOrder, ShopifyRefund } from "../types/shopify";

export type SmokeTestCase = {
  name: string;
  passed: boolean;
  durationMs: number;
  error: string | null;
  detail: Record<string, unknown>;
};

export type SmokeTestResult = {
  passed: number;
  failed: number;
  total: number;
  results: SmokeTestCase[];
};

const MOCK_ORDER: ShopifyOrder = {
  name: "#TEST-1001",
  order_number: 1001,
  email: "qa@gcw.com",
  phone: "+15125550100",
  currency: "USD",
  total_price: "99.99",
  total_tax: "7.22",
  total_shipping_price_set: {
    shop_money: {
      amount: "0"
    }
  },
  customer: {
    id: 4000000001,
    email: "qa@gcw.com",
    first_name: "QA",
    last_name: "Tester"
  },
  billing_address: {
    city: "Austin",
    province_code: "TX",
    zip: "78701",
    country_code: "US"
  },
  line_items: [
    {
      sku: "GCW-TEE-TEST-BLK-M",
      product_id: 7000000001,
      variant_id: 43000000001,
      variant_title: "Black / M",
      product_type: "Shirts",
      title: "GCW Test Product",
      price: "49.995",
      quantity: 2
    }
  ]
};

const MOCK_REFUND: ShopifyRefund = {
  order_id: 9999000001,
  order_name: "#TEST-1001",
  email: "qa@gcw.com",
  phone: "+15125550100",
  currency: "USD",
  customer: {
    id: 4000000001,
    email: "qa@gcw.com",
    first_name: "QA",
    last_name: "Tester"
  },
  billing_address: {
    city: "Austin",
    province_code: "TX",
    zip: "78701",
    country_code: "US"
  },
  refund_line_items: [
    {
      quantity: 1,
      subtotal: "49.995",
      total_tax: "3.61",
      line_item: {
        sku: "GCW-TEE-TEST-BLK-M",
        product_id: 7000000001,
        variant_id: 43000000001,
        variant_title: "Black / M",
        product_type: "Shirts",
        title: "GCW Test Product",
        price: "49.995",
        quantity: 1
      }
    }
  ],
  transactions: [
    {
      amount: "53.60",
      kind: "refund",
      status: "success"
    }
  ]
};

async function runCase(name: string, fn: () => Promise<Record<string, unknown>>): Promise<SmokeTestCase> {
  const start = Date.now();

  try {
    const detail = await fn();
    return {
      name,
      passed: true,
      durationMs: Date.now() - start,
      error: null,
      detail
    };
  } catch (error) {
    return {
      name,
      passed: false,
      durationMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
      detail: {}
    };
  }
}

export async function runQaSmokeTests(): Promise<SmokeTestResult> {
  const results: SmokeTestCase[] = [];

  results.push(
    await runCase("purchase payload mapping", async () => {
      const payload = mapOrderToPurchase(MOCK_ORDER, "USD", "evt_purchase_qa", "guest");
      if (!payload.transaction_id || payload.items.length === 0) {
        throw new Error("Missing transaction_id or items");
      }

      return {
        transaction_id: payload.transaction_id,
        item_count: payload.items.length,
        value: payload.value
      };
    })
  );

  results.push(
    await runCase("refund payload mapping", async () => {
      const payload = mapRefundToRefundEvent(MOCK_REFUND, "USD", "evt_refund_qa", "guest");
      if (payload.event_name !== "refund" || payload.value <= 0) {
        throw new Error("Refund payload did not map correctly");
      }

      return {
        transaction_id: payload.transaction_id,
        value: payload.value,
        tax: payload.tax
      };
    })
  );

  results.push(
    await runCase("event id fallback strategy", async () => {
      const eventId = resolveEventId({
        webhookId: "webhook_evt_qa",
        orderNumber: 1001,
        orderName: "#TEST-1001"
      });
      if (!eventId || eventId.length < 8) {
        throw new Error("Event ID not resolved");
      }

      return {
        event_id: eventId
      };
    })
  );

  results.push(
    await runCase("runtime consent suppression", async () => {
      const event = parseRuntimeEvent({
        event_name: "purchase",
        event_id: "evt_runtime_qa_001",
        source: "theme",
        customer: {
          id: "1",
          email: "qa@gcw.com",
          visitor_type: "human"
        },
        product: {},
        collection: {},
        cart: {},
        checkout: {},
        marketing: {},
        session: {
          id: "qa_session_1",
          page_url: "https://www.gerberchildrenswear.com/products/qa"
        },
        consent: {
          analytics_storage: "granted",
          ad_storage: "denied",
          ad_user_data: "granted",
          ad_personalization: "granted"
        }
      });

      const decision = evaluateRuntimeEventPolicy(event);
      if (decision.allowed) {
        throw new Error("Expected marketing consent suppression");
      }

      return {
        reason: decision.reason ?? "unknown"
      };
    })
  );

  results.push(
    await runCase("runtime duplicate detection", async () => {
      const event = parseRuntimeEvent({
        event_name: "view_item",
        event_id: "evt_runtime_qa_002",
        source: "theme",
        customer: {
          id: "1",
          email: "qa@gcw.com",
          visitor_type: "human"
        },
        product: {},
        collection: {},
        cart: {},
        checkout: {},
        marketing: {},
        session: {
          id: "qa_session_2",
          page_url: "https://www.gerberchildrenswear.com/products/qa"
        },
        consent: {
          analytics_storage: "granted",
          ad_storage: "granted",
          ad_user_data: "granted",
          ad_personalization: "granted"
        }
      });

      const first = isRuntimeDuplicate(event);
      const second = isRuntimeDuplicate(event);

      if (first || !second) {
        throw new Error("Duplicate detection did not behave as expected");
      }

      return {
        first_duplicate: first,
        second_duplicate: second
      };
    })
  );

  results.push(
    await runCase("signed GTM forward headers", async () => {
      const payloadJson = JSON.stringify({
        event_name: "purchase",
        event_id: "evt_headers_qa",
        transaction_id: "#TEST-1001"
      });

      const headers = createForwardHeaders(
        payloadJson,
        {
          event_name: "purchase",
          event_id: "evt_headers_qa",
          transaction_id: "#TEST-1001"
        },
        "0123456789abcdef0123456789abcdef",
        1700000000
      );

      if (!headers["X-Synapse-Signature"] || !headers["X-Synapse-Timestamp"]) {
        throw new Error("Missing signature headers");
      }

      return {
        signature: headers["X-Synapse-Signature"],
        timestamp: headers["X-Synapse-Timestamp"]
      };
    })
  );

  results.push(
    await runCase("shadow parity report generation", async () => {
      const parity = getShadowParityReport(5);
      if (parity.paired_events < 0) {
        throw new Error("Invalid parity count");
      }

      return {
        status: parity.status,
        paired_events: parity.paired_events,
        mismatch_rate_pct: parity.mismatch_rate_pct
      };
    })
  );

  const passed = results.filter((result) => result.passed).length;
  const failed = results.length - passed;

  return {
    passed,
    failed,
    total: results.length,
    results
  };
}
