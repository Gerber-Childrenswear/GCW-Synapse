import crypto from "node:crypto";
import axios from "axios";

type ReplayTopic = "orders/create" | "orders/paid";

const topic = ((process.argv[2] as ReplayTopic | undefined) ?? "orders/create");
if (topic !== "orders/create" && topic !== "orders/paid") {
  throw new Error("Topic must be orders/create or orders/paid");
}

const baseUrl = process.env.REPLAY_BASE_URL ?? "http://localhost:4000";
const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
const shopDomain = process.env.REPLAY_SHOP_DOMAIN ?? "example.myshopify.com";

if (!secret) {
  throw new Error("SHOPIFY_WEBHOOK_SECRET is required for replay");
}

const endpoint = topic === "orders/create"
  ? `${baseUrl}/webhooks/shopify/orders/create`
  : `${baseUrl}/webhooks/shopify/orders/paid`;

const orderNumber = Date.now();
const payload = {
  order_number: orderNumber,
  name: `#${orderNumber}`,
  email: "replay@example.com",
  phone: "+12125550100",
  currency: "USD",
  total_price: "120.50",
  total_tax: "8.50",
  total_shipping_price_set: {
    shop_money: {
      amount: "7.00"
    }
  },
  customer: {
    id: 100200300,
    email: "replay@example.com",
    first_name: "Replay",
    last_name: "Tester"
  },
  billing_address: {
    city: "Fremont",
    province_code: "CA",
    zip: "94536",
    country_code: "US"
  },
  line_items: [
    {
      sku: "REPLAY-SKU-1",
      title: "Replay Product",
      price: "120.50",
      quantity: 1
    }
  ]
};

const raw = Buffer.from(JSON.stringify(payload), "utf8");
const hmac = crypto.createHmac("sha256", secret).update(raw).digest("base64");
const webhookId = `replay-${Date.now()}`;

async function main() {
  const response = await axios.post(endpoint, raw, {
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Topic": topic,
      "X-Shopify-Shop-Domain": shopDomain,
      "X-Shopify-Hmac-Sha256": hmac,
      "X-Shopify-Webhook-Id": webhookId
    },
    timeout: 15000
  });

  console.log(JSON.stringify({
    endpoint,
    topic,
    status: response.status,
    data: response.data
  }, null, 2));
}

main().catch((error: unknown) => {
  if (axios.isAxiosError(error)) {
    console.error(JSON.stringify({
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    }, null, 2));
  } else {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
  }
  process.exitCode = 1;
});
