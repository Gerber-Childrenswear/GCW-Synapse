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

## Local Signed Replay

With the service running locally and SHOPIFY_WEBHOOK_SECRET set in your .env, you can replay a signed webhook:

1. Create flow: npm run replay:webhook:create
2. Paid flow: npm run replay:webhook:paid
