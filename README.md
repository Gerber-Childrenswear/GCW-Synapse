# GCW-Synapse

GCW-Synapse is a Shopify analytics relay service that replaces Elevar by forwarding signed Shopify order and refund webhooks to your Server GTM endpoint.

## What It Does

- Verifies Shopify webhook signatures with HMAC.
- Maps Shopify order payloads into a normalized purchase event payload.
- Maps Shopify refund payloads into a normalized refund event payload.
- Forwards server events to your Server GTM collection endpoint.
- Retries transient GTM failures with bounded backoff.
- Ignores duplicate webhooks within a configurable TTL window.
- Emits structured JSON logs for ingestion and troubleshooting.

## Endpoints

- GET /health
- GET /diagnostics
- GET /runtime/summary
- GET /runtime/recent
- GET /ops/alerts
- GET /ops/dead-letter
- GET /ops/dashboard
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
- GET /compatibility/product-group
- GET /compatibility/page-title
- GET /compatibility/add-to-cart
- GET /compatibility/product-view-details
- POST /compare/elevar
- POST /compare/channel-event
- POST /compare/channel-event/batch
- GET /api/advisor/alerts
- POST /api/advisor/chat
- GET /api/events/catalog
- POST /api/events/validate-runtime
- GET /api/gtm/placeholders
- GET /api/gtm/compatibility-matrix
- GET /api/gtm/compatibility-gaps
- GET /api/gtm/compatibility-usage
- GET /api/gtm/compatibility-drilldown
- GET /api/gtm/go-live-gate
- GET /api/monitor/weekend
- GET /api/theme-adapters
- GET /api/theme-adapters/:key/coverage
- GET /api/theme-adapters/:key/summary
- GET /compare/summary
- GET /compare/parity
- GET /compare/channels
- GET /compare/troubleshoot
- GET /compare/ui-model
- GET /compare/recent
- POST /event
- GET /launch/readiness
- POST /webhooks/shopify/orders/create
- POST /webhooks/shopify/orders/paid
- POST /webhooks/shopify/refunds/create

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

## Local AI Advisor (Shopify Admin)

GCW-Synapse now includes an in-app advisor tab for operators to ask questions and get proactive alerts about Shopify analytics health, Elevar parity, GTM mappings, and destination issues.

Configuration:

- `LOCAL_ADVISOR_ENABLED` (`true|false`)
- `LOCAL_ADVISOR_BASE_URL` (default `http://127.0.0.1:11434`)
- `LOCAL_ADVISOR_MODEL` (for example `qwen2.5:14b-instruct`)
- `LOCAL_ADVISOR_TIMEOUT_MS`

API:

- `GET /api/advisor/alerts`
	- Returns prioritized warning/critical advisor alerts.
- `POST /api/advisor/chat`
	- Body: `{ "message": "...", "history": [{ "role": "user|assistant", "content": "..." }] }`
	- Uses local model runtime when enabled, and deterministic fallback guidance when disabled/unavailable.

Notes:

- These routes are protected by `X-Synapse-Token` (`INGRESS_SHARED_TOKEN`) like other admin/ops APIs.
- Advisor responses are grounded in live Synapse context (`ops alerts`, `runtime summary`, `channel health`, `launch readiness`, `parity report`, recent runtime events).

## Shopify Internal App Setup

Synapse is set up as an internal Shopify app for your organization, not a public OAuth app.
The server currently uses the webhook secret and ingress token for runtime security; the Shopify
app client ID and secret belong in your local `.env` or secret manager and are only needed if you
add Shopify OAuth or app install flows later.

The backend now exposes a protected status endpoint at `GET /ops/shopify-app` so you can verify
that the internal app credentials and app URL are wired correctly.

It also exposes a lightweight install flow:

- `GET /auth/shopify/install?shop=your-shop.myshopify.com`
- `GET /auth/shopify/callback`

Installed shop tokens are stored locally in the token store path you configure with
`SHOPIFY_TOKEN_STORE_PATH`.

Recommended Shopify dashboard settings:

- App type: internal or custom organization app
- App URL: your deployed admin UI URL
- Allowed redirection URLs: only needed if you add OAuth callbacks later
- Theme app extension and customer events pixel: point them at the deployed Synapse URL

Required backend env vars for the internal app:

- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SHOPIFY_APP_URL`
- `SHOPIFY_APP_SCOPES`
- `SHOPIFY_AUTH_CALLBACK_PATH`
- `SHOPIFY_TOKEN_STORE_PATH` if you want a persistent token store outside memory

If you want to keep this repo strictly relay-only, you can leave the Shopify API key/secret
unused until you build the install flow.

## Production Build

```bash
npm run build
npm start
```

## Cloudflare Hosting (Super Version)

This repo now supports a Cloudflare-hosted control plane using a Worker gateway plus static admin assets.

Architecture:

- Cloudflare Worker serves the built admin UI from `apps/admin/dist`.
- The same Worker serves control-plane, event ingestion, runtime, compare, launch, and webhook endpoints natively at the edge.
- No external origin is required for the core GCW Synapse control-plane workflow.

Files:

- `wrangler.toml`
- `cloudflare/worker.ts`

Required configuration:

- No required origin for edge-only mode.
- Optional origin for legacy passthrough routes: `SYNAPSE_ORIGIN_URL` (in `wrangler.toml` vars or environment)
- Optional Worker secret for passthrough mode: `SYNAPSE_INGRESS_TOKEN`
- Public event origin allowlist: `PUBLIC_EVENT_ALLOWED_ORIGINS` (comma-separated)
- Public event payload cap in bytes: `PUBLIC_EVENT_MAX_BODY_BYTES`
- Public event per-IP rate cap per minute: `PUBLIC_EVENT_RATE_LIMIT_PER_MINUTE`

Commands:

```bash
npm run cf:build
npm run cf:dev
npm run cf:deploy
```

Set Worker secret (optional but recommended when origin requires ingress token):

```bash
npx wrangler secret put SYNAPSE_INGRESS_TOKEN
```

Notes:

- Native edge endpoints include `/health`, `/event`, `/runtime/*`, `/compare/*`, `/launch/readiness`, `/webhooks/*`, `/ops/*`, `/api/status`, `/api/events/schemas`, `/api/qa/checklist`, `/api/qa/smoke`, `/api/shadow/stats`, `/api/shadow/comparisons`, and `/api/vendors/matrix`.
- In edge-only mode, `/auth/*` and `/compatibility/*` return `501` to avoid hidden dependencies on external backends.
- SPA routes are supported by serving `index.html` fallback for non-file paths.
- For free-tier efficiency, non-public internal routes should be accessed with `X-Synapse-Token` when `SYNAPSE_INGRESS_TOKEN` is configured.

## Tests

```bash
npm test
```

## Operator Helpers

Use these endpoints to quickly identify and action issues before they impact reporting:

- `GET /ops/alerts`
	- Returns `ok|warning|critical` status with user-friendly recommendations.
- `GET /ops/dead-letter`
	- Shows dead-letter backlog and replay commands.
- `GET /ops/dashboard`
	- One payload for launch monitoring: status, alerts, parity, runtime, channels, dead-letter, and next actions.

## GTM Cutover Report

Generate a timestamped cutover decision artifact from the go-live gate endpoint:

- Command: `npm run gtm:report:cutover`
- Strict CI command (fails when gate is HOLD): `npm run gtm:report:cutover:strict`
- Output directory: `docs/reports/cutover/`
- Output files: timestamped `.json` and `.md` per run
- Stable latest files refreshed each run:
	- `docs/reports/cutover/cutover-gate-latest.json`
	- `docs/reports/cutover/cutover-gate-latest.md`
	- `docs/reports/cutover/cutover-gate-status.json` (machine-readable status snapshot for dashboards/alerts)

Required auth/input:

- `SYNAPSE_INGRESS_TOKEN` or `INGRESS_SHARED_TOKEN`
- Optional base URL override: `SYNAPSE_BASE_URL` (default `http://127.0.0.1:3000`)

Threshold override examples:

```bash
npm run gtm:report:cutover -- --min_coverage_pct 98 --max_mismatch_rate_pct 3 --min_paired_events 500
```

Supported override flags:

- `--min_coverage_pct`
- `--max_non_available_helpers`
- `--min_paired_events`
- `--max_mismatch_rate_pct`
- `--max_critical_channels`
- `--max_warning_channels`
- `--max_compat_failure_rate_pct`
- `--max_compat_error_hits`
- `--base_url`
- `--token`
- `--out_dir`
- `--fail_on_hold` (causes non-zero exit code when gate result is HOLD)

## Takeover Verification

Run endpoint contract checks plus gate status validation as one verification pass:

- Command: `npm run gtm:verify:takeover`
- Strict command (fails on HOLD or contract drift): `npm run gtm:verify:takeover:strict`
- Output artifacts:
	- timestamped `docs/reports/cutover/takeover-verify-<timestamp>.json`
	- stable `docs/reports/cutover/takeover-verify-latest.json`

Supported override flags:

- `--base_url`
- `--token`
- `--out_dir`
- `--fail_on_hold`
- `--fail_on_contract_drift`

## Takeover Notifications

Post GO/HOLD summaries to Slack/Teams-compatible webhooks using latest generated artifacts:

- Command: `npm run gtm:notify:takeover`
- Reads:
	- `docs/reports/cutover/cutover-gate-status.json`
	- `docs/reports/cutover/takeover-verify-latest.json`

Webhook input options:

- `TAKEOVER_NOTIFY_WEBHOOK_URL`
- or `SLACK_WEBHOOK_URL`
- or `TEAMS_WEBHOOK_URL`

Optional flags:

- `--webhook_url`
- `--out_dir`

## Takeover Confidence Index

Compute a single weighted confidence score from cutover gate + contract verification artifacts:

- Command: `npm run gtm:confidence:takeover`
- Strict command (fails below threshold): `npm run gtm:confidence:takeover:strict`
- Output artifacts:
	- timestamped `docs/reports/cutover/takeover-confidence-<timestamp>.json`
	- stable `docs/reports/cutover/takeover-confidence-latest.json`

Scoring model:

- 70% from gate readiness score
- 30% from contract pass rate
- penalties when gate is HOLD or contract status is FAIL

Supported flags:

- `--out_dir`
- `--min_confidence_pct` (default 95)
- `--fail_on_low_confidence`

## Takeover Decision Runbook

Generate a leadership-ready GO/HOLD packet from latest cutover, verification, and confidence artifacts:

- Command: `npm run gtm:runbook:takeover`
- Strict command (fails on HOLD verdict): `npm run gtm:runbook:takeover:strict`
- Output artifacts:
	- timestamped `docs/reports/cutover/takeover-runbook-<timestamp>.json`
	- timestamped `docs/reports/cutover/takeover-runbook-<timestamp>.md`
	- stable `docs/reports/cutover/takeover-runbook-latest.json`
	- stable `docs/reports/cutover/takeover-runbook-latest.md`

Supported flags:

- `--out_dir`
- `--fail_on_hold`

## GitHub Automation

This repo includes a scheduled/manual readiness workflow:

- Workflow file: `.github/workflows/takeover-readiness.yml`
- Triggers:
	- manual (`workflow_dispatch`)
	- scheduled every 6 hours

What it runs:

1. `npm run gtm:report:cutover:strict`
2. `npm run gtm:verify:takeover:strict`
3. `npm run gtm:confidence:takeover:strict`
4. `npm run gtm:runbook:takeover`
5. Uploads `docs/reports/cutover/` as workflow artifacts
6. Optionally posts webhook status with `npm run gtm:notify:takeover`
7. Auto-opens or updates a GitHub issue titled `Takeover readiness regression` when strict checks fail

Required repository secrets:

- `SYNAPSE_BASE_URL`
- `SYNAPSE_INGRESS_TOKEN`

Optional repository secrets:

- `TAKEOVER_NOTIFY_WEBHOOK_URL`

## Release Tag Guard

This repo includes a release tag blocker workflow:

- Workflow file: `.github/workflows/release-tag-guard.yml`
- Triggers:
	- tag pushes matching `v*` or `release-*`
	- manual (`workflow_dispatch`)

Behavior:

- Reads recent results from `takeover-readiness.yml`
- Blocks release tags when consecutive takeover-readiness failures reach threshold (`HOLD_STREAK_THRESHOLD`, default `3`)
- Also blocks when no successful takeover-readiness run exists yet

## Strict Launch Guard

To prevent risky go-lives, enable strict startup blocking:

- `STRICT_LAUNCH_GUARD=true`
- `LAUNCH_MAX_DEAD_LETTER_RECORDS=0`
- `LAUNCH_THEME_AUDIT_PATH=docs/gtm/THEME_TRACKING_AUDIT.md`
- `LAUNCH_BLOCK_ON_THEME_CONFLICTS=true`

When enabled, Synapse will fail fast at startup if:

- Dead-letter backlog exceeds `LAUNCH_MAX_DEAD_LETTER_RECORDS`
- Theme audit report contains conflict findings (for example Elevar and Triple Whale both enabled)

Replay dead-letter backlog:

- `npm run replay:dead-letter:dry`
- `npm run replay:dead-letter -- --limit 50`

## Shopify Webhook Configuration

Create webhook subscriptions in Shopify Admin pointing to:

- https://YOUR_HOST/webhooks/shopify/orders/create
- https://YOUR_HOST/webhooks/shopify/orders/paid
- https://YOUR_HOST/webhooks/shopify/refunds/create

Use the same webhook signing secret in Shopify and in SHOPIFY_WEBHOOK_SECRET.

Route/topic enforcement is strict:

- /webhooks/shopify/orders/create only accepts X-Shopify-Topic: orders/create
- /webhooks/shopify/orders/paid only accepts X-Shopify-Topic: orders/paid
- /webhooks/shopify/refunds/create only accepts X-Shopify-Topic: refunds/create

## Reliability Controls

- GTM_FORWARD_MAX_RETRIES controls retry count for transient GTM failures.
- GTM_FORWARD_BACKOFF_MS controls linear backoff per retry attempt.
- IDEMPOTENCY_TTL_MS controls how long processed webhook IDs remain deduped.
- ALLOWED_WEBHOOK_TOPICS controls which Shopify topics are accepted.
- JSON_BODY_LIMIT controls max JSON request size accepted on ingress routes.
- GTM_FORWARD_SHARED_SECRET enables signed outbound requests to GTM with:
	- X-Synapse-Timestamp
	- X-Synapse-Signature (v1=HMAC_SHA256(secret, `${timestamp}.${rawBody}`))
- GTM_DEAD_LETTER_PATH optionally stores terminal GTM forward failures as JSONL for replay.

Dead-letter replay:

- Dry run: `npm run replay:dead-letter:dry`
- Execute replay: `npm run replay:dead-letter`
- Optional flags:
	- `--path <jsonlPath>` to override file path
	- `--limit <n>` to cap attempts per run
	- `--dry-run` to validate without sending

Replay keeps a timestamped `.bak` snapshot and rewrites the dead-letter file with only unresolved records.

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

## Troubleshooting API For UI

To support richer troubleshooting UI (Lovable or custom), use these endpoints:

- `POST /compare/channel-event`
	- Ingest per-destination telemetry from pixel/server checks.
	- Required fields: `channel`, `surface` (`pixel|server|runtime|webhook`), `destination`, `event_name`, `status` (`ok|error`).
	- Optional fields: `event_id`, `transaction_id`, `source_theme`, `source_surface`, `pixel_id`, `error_message`, `observed_at`.
- `POST /compare/channel-event/batch`
	- Ingest multiple telemetry events in one request using `{ "events": [...] }`.
	- Returns accepted/rejected counts and per-item validation feedback.
- `GET /compare/channels`
	- Returns per-channel/per-pixel health with status, failure rate, and freshness.
- `GET /compare/troubleshoot`
	- Returns issue list with recommendations and platform doc links.
- `GET /compare/ui-model`
	- Consolidated payload combining parity, channels, troubleshooting, and recent events for dashboard rendering.

Channel health tuning:

- `CHANNEL_HEALTH_STALE_MINUTES` marks integrations stale after inactivity.
- `CHANNEL_HEALTH_WARN_FAILURE_PCT` marks warning/critical by failure rate.

### Destination callback examples

Use these payloads from GTM server tags or post-processing callbacks so Synapse can show per-destination delivery health:

```json
{
	"channel": "meta",
	"surface": "server",
	"destination": "conversions_api",
	"event_name": "purchase",
	"event_id": "evt_purchase_1001",
	"transaction_id": "#1001",
	"source_theme": "hyper",
	"source_surface": "checkout",
	"status": "ok",
	"observed_at": "2026-06-05T18:00:00.000Z"
}
```

```json
{
	"channel": "instagram",
	"surface": "server",
	"destination": "meta_conversions_api",
	"event_name": "purchase",
	"event_id": "evt_purchase_1001",
	"transaction_id": "#1001",
	"source_theme": "expanse",
	"source_surface": "checkout",
	"status": "ok",
	"observed_at": "2026-06-05T18:00:01.000Z"
}
```

```json
{
	"channel": "reddit",
	"surface": "server",
	"destination": "capi",
	"event_name": "purchase",
	"event_id": "evt_purchase_1001",
	"transaction_id": "#1001",
	"source_theme": "hyper",
	"source_surface": "checkout",
	"status": "error",
	"error_message": "HTTP 429 from Reddit CAPI",
	"observed_at": "2026-06-05T18:00:02.000Z"
}
```

Runtime forwarding health to Server GTM is now auto-recorded by Synapse using:

- `channel=server_gtm`
- `surface=runtime`
- `destination=collect`

## Launch Readiness Gate

Use `GET /launch/readiness` to get a strict go/hold report for launch.

- Query: `phase=validation|cutover` (default `validation`)
- Returns per-check pass/fail with recommendations.

Threshold settings:

- `LAUNCH_MIN_PAIRED_EVENTS`
- `LAUNCH_MAX_WARNING_CHANNELS`
- `LAUNCH_MAX_WEBHOOK_FAILURE_RATE_PCT`

The same launch readiness report is included in `GET /compare/ui-model` under `launch_readiness`.

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
