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

## Local Signed Replay

With the service running locally and SHOPIFY_WEBHOOK_SECRET set in your .env, you can replay a signed webhook:

1. Create flow: npm run replay:webhook:create
2. Paid flow: npm run replay:webhook:paid
