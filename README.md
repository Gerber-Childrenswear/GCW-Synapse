# GCW-Synapse

GCW-Synapse is a Shopify analytics relay service that replaces Elevar by forwarding signed Shopify order webhooks to your Server GTM endpoint.

## What It Does

- Verifies Shopify webhook signatures with HMAC.
- Maps Shopify order payloads into a normalized purchase event payload.
- Forwards purchase events to your Server GTM collection endpoint.
- Retries transient GTM failures with bounded backoff.
- Ignores duplicate webhooks within a configurable TTL window.
- Emits structured JSON logs for ingestion and troubleshooting.

## Endpoints

- GET /health
- GET /diagnostics
- GET /compatibility/ga4-id
- GET /compatibility/currency-code
- GET /compatibility/event-id
- GET /compatibility/customer-id
- GET /compatibility/customer-email
- GET /compatibility/purchase-products
- GET /compatibility/facebook-pixel-id
- GET /compatibility/product-identifier
- GET /compatibility/order-id
- GET /compatibility/pinterest-id
- GET /compatibility/cart-total
- GET /compatibility/checkout-products
- GET /compatibility/search-term
- GET /compatibility/visitor-type
- GET /compatibility/order-revenue
- GET /compatibility/customer-phone
- GET /compatibility/impressions
- GET /compatibility/add-to-cart
- GET /compatibility/product-view-details
- POST /compare/elevar
- GET /compare/summary
- GET /compare/parity
- GET /compare/recent
- POST /webhooks/shopify/orders/create
- POST /webhooks/shopify/orders/paid

## Local Setup

1. Install dependencies.
2. Copy .env.example to .env and set real values.
3. Run the app in dev mode.

```bash
npm install
cp .env.example .env
npm run dev
```

PowerShell alternative:

```powershell
Copy-Item .env.example .env
```

## Production Build

```bash
npm run build
npm start
```

## Tests

```bash
npm test
```

## Shopify Webhook Configuration

Create webhook subscriptions in Shopify Admin pointing to:

- https://YOUR_HOST/webhooks/shopify/orders/create
- https://YOUR_HOST/webhooks/shopify/orders/paid

Use the same webhook signing secret in Shopify and in SHOPIFY_WEBHOOK_SECRET.

Route/topic enforcement is strict:

- /webhooks/shopify/orders/create only accepts X-Shopify-Topic: orders/create
- /webhooks/shopify/orders/paid only accepts X-Shopify-Topic: orders/paid

## Reliability Controls

- GTM_FORWARD_MAX_RETRIES controls retry count for transient GTM failures.
- GTM_FORWARD_BACKOFF_MS controls linear backoff per retry attempt.
- IDEMPOTENCY_TTL_MS controls how long processed webhook IDs remain deduped.
- ALLOWED_WEBHOOK_TOPICS controls which Shopify topics are accepted.

## Optional Ingress Token

If INGRESS_SHARED_TOKEN is set, requests to /diagnostics and /event must include:

- Header: X-Synapse-Token
- Value: the same token configured in INGRESS_SHARED_TOKEN

This token does not replace Shopify HMAC validation for webhook routes.

## Shadow Compare Mode (Elevar Source Of Truth)

Use this mode to run Synapse and Elevar in parallel for a few days without sending duplicate downstream events.

- Set `RUNTIME_MODE=shadow_compare`.
- In this mode, Shopify webhooks are verified and mapped, but Synapse does not forward events to GTM server.
- Synapse captures local comparable records only.

Comparison flow:

1. Synapse captures your mapped payload automatically from Shopify webhooks.
2. Send Elevar baseline payloads to `POST /compare/elevar` (protected by ingress token).
3. Review apples-to-apples parity at `GET /compare/summary`.
4. Review alert-oriented parity at `GET /compare/parity`.
5. Inspect recent captured records at `GET /compare/recent?limit=100`.

Comparison fields currently tracked per key (`event_name:transaction_id`):

- value
- currency
- item_count

Optional persistence:

- `SHADOW_COMPARE_STORE_PATH` appends captured records to JSONL.
- `SHADOW_COMPARE_MAX_RECORDS` controls in-memory retention.
- `SHADOW_COMPARE_MISMATCH_ALERT_PCT` sets alert threshold for mismatch rate (default `5`).

Alert rule:

- `GET /compare/parity` returns `status: alert` when `mismatch_rate_pct > SHADOW_COMPARE_MISMATCH_ALERT_PCT`.

## GA4 Compatibility Variable

GCW-Synapse now includes the first compatibility-variable implementation for `GA4 ID`.

- `GA4_MEASUREMENT_ID` sets the default GA4 Measurement ID.
- `GA4_MEASUREMENT_ID_BY_SHOP` optionally overrides the value per Shopify shop domain.
- `GET /compatibility/ga4-id?shop=store.myshopify.com` returns the resolved value.

## Currency Compatibility Variable

GCW-Synapse now includes compatibility logic for `dlv - Global - Currency Code`.

- `SHOP_DEFAULT_CURRENCY` sets the final fallback currency.
- `GET /compatibility/currency-code` resolves using fallback order:
	- `ecommerce_currency`
	- `checkout_currency`
	- `shop_currency`
	- `SHOP_DEFAULT_CURRENCY`

Example:

`/compatibility/currency-code?ecommerce_currency=usd&checkout_currency=cad&shop_currency=eur`

## Event ID Compatibility Variable

GCW-Synapse now includes compatibility logic for `dlv - event_id`.

- `GET /compatibility/event-id` resolves using fallback order:
	- `webhook_id`
	- deterministic hash from `shop|topic|order_number|order_name`

Example:

`/compatibility/event-id?webhook_id=abc123&shop=store.myshopify.com&topic=orders/create&order_number=1001&order_name=%231001`

## Customer Identity Compatibility Variables

GCW-Synapse now includes compatibility logic for `dlv - Customer ID` and `dlv - Customer Email`.

- `CUSTOMER_ID_FALLBACK` sets the fallback when customer id is unavailable.
- `GET /compatibility/customer-id` resolves customer id using:
	- `customer_id`
	- `CUSTOMER_ID_FALLBACK`
- `GET /compatibility/customer-email` resolves email using:
	- `customer_email`
	- `checkout_email`

Examples:

`/compatibility/customer-id?customer_id=12345`

`/compatibility/customer-email?customer_email=Customer%40Example.com&checkout_email=checkout%40example.com`

## Purchase Products Compatibility Variable

GCW-Synapse now includes compatibility logic for `dlv - Thank You Page - ecommerce.purchase.products`.

- `GET /compatibility/purchase-products` accepts a `line_items_json` query value.
- It returns a normalized purchase products array preserving key item fields used by downstream tags.

Example:

`/compatibility/purchase-products?line_items_json=%5B%7B%22sku%22%3A%22SKU-123%22%2C%22title%22%3A%22Footie%22%2C%22price%22%3A%2249.98%22%2C%22quantity%22%3A2%7D%5D`

## Facebook Pixel And Product Identifier Compatibility

GCW-Synapse now includes compatibility logic for `Facebook - Pixel ID`, `Facebook - product identifier`, and `GA4 - product identifier`.

- `FACEBOOK_PIXEL_ID` stores the active Facebook Pixel ID.
- `GET /compatibility/facebook-pixel-id` returns the configured pixel id.
- `GET /compatibility/product-identifier` resolves product identifier using:
	- `sku`
	- `variant_id`
	- `product_id`

Examples:

`/compatibility/facebook-pixel-id`

`/compatibility/product-identifier?sku=SKU-123&variant_id=456&product_id=789`

## Order And Pinterest Compatibility

GCW-Synapse now includes compatibility logic for `dlv - Thank You Page - Order ID` and `Pinterest ID`.

- `GET /compatibility/order-id` resolves order id using:
	- `order_number`
	- `transaction_id`
	- `order_name`
- `PINTEREST_ID` stores the active Pinterest ID.
- `GET /compatibility/pinterest-id` returns the configured ID.

Examples:

`/compatibility/order-id?order_number=12345&order_name=%2312345`

`/compatibility/pinterest-id`

## Cart And Search Compatibility

GCW-Synapse now includes compatibility logic for `dlv - Cart Total`, `dlv - ecommerce.checkout.products`, and `url - Search - Search Term`.

- `GET /compatibility/cart-total` resolves cart total using:
	- `ecommerce_value`
	- `checkout_total_price`
	- `subtotal_price`
- `GET /compatibility/checkout-products` accepts `line_items_json` and returns canonical checkout item array.
- `GET /compatibility/search-term` accepts `url` and resolves search term from common query keys (`q`, `query`, `search`, `term`).

Examples:

`/compatibility/cart-total?ecommerce_value=99.95&checkout_total_price=109.95`

`/compatibility/checkout-products?line_items_json=%5B%7B%22sku%22%3A%22SKU-123%22%2C%22title%22%3A%22Footie%22%2C%22price%22%3A%2225.00%22%2C%22quantity%22%3A1%7D%5D`

`/compatibility/search-term?url=https%3A%2F%2Fwww.gerberchildrenswear.com%2Fsearch%3Fq%3Dfootie`

## Visitor And Thank You Compatibility

GCW-Synapse now includes compatibility logic for `dlv - Global - Visitor Type`, `dlv - Thank You Page - Order Revenue`, and `dlv - Thank You Page - Customer Phone Number`.

- `GET /compatibility/visitor-type` resolves visitor type from identity hints (`customer_id`, `customer_email`).
- `GET /compatibility/order-revenue` resolves thank-you revenue from `ecommerce_value` then `total_price`.
- `GET /compatibility/customer-phone` normalizes phone values to an E.164-style format.

Examples:

`/compatibility/visitor-type?customer_id=12345`

`/compatibility/order-revenue?ecommerce_value=99.95&total_price=109.95`

`/compatibility/customer-phone?customer_phone=%28212%29%20555-0100`

## Catalog Compatibility

GCW-Synapse now includes compatibility logic for catalog and product-context variables.

- `GET /compatibility/impressions` resolves `dlv - ecommerce.impressions`.
- `GET /compatibility/add-to-cart` resolves:
	- `dlv - Add to Cart - Add Array`
	- `dlv - Add to Cart - Quantity`
	- `dlv - Add to Cart - Price`
	- `dlv - Add to Cart - Category`
- `GET /compatibility/product-view-details` resolves `dlv - Product View - Details Array`.

All three endpoints accept `line_items_json`.

Example:

`/compatibility/add-to-cart?line_items_json=%5B%7B%22sku%22%3A%22SKU-123%22%2C%22title%22%3A%22Footie%22%2C%22price%22%3A%2225.00%22%2C%22quantity%22%3A2%2C%22product_type%22%3A%22Onesies%22%7D%5D`

## Local Signed Replay

With the service running locally and SHOPIFY_WEBHOOK_SECRET set in your .env, you can replay a signed webhook:

1. Create flow: npm run replay:webhook:create
2. Paid flow: npm run replay:webhook:paid
