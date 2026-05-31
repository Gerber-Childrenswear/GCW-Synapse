# GCW Synapse Production Handoff Bundle

## Scope

This handoff package covers production readiness for GCW Synapse replacing Elevar components while preserving Triple Whale.

## Environment Variables (Production)

Core API:
- NODE_ENV=production
- RUNTIME_MODE=shadow_compare for launch week, then forward after gates pass
- PORT=4000
- GTM_SERVER_URL=https://<sgtm-host>/g/collect
- SHOPIFY_WEBHOOK_SECRET=<shopify webhook signing secret>
- WEBHOOK_PATH_PREFIX=/webhooks/shopify/orders
- INGRESS_SHARED_TOKEN=<shared ingress token>

Reliability:
- REQUEST_TIMEOUT_MS=10000
- GTM_FORWARD_MAX_RETRIES=2
- GTM_FORWARD_BACKOFF_MS=300
- IDEMPOTENCY_TTL_MS=600000
- ALLOWED_WEBHOOK_TOPICS=orders/create,orders/paid

Identity and commerce fallback:
- CUSTOMER_ID_FALLBACK=guest
- SHOP_DEFAULT_CURRENCY=USD

Integrations:
- FACEBOOK_PIXEL_ID=<meta pixel id>
- PINTEREST_ID=<pinterest id>
- GA4_MEASUREMENT_ID=<ga4 id>
- GA4_MEASUREMENT_ID_BY_SHOP=<optional per-shop overrides>

Shadow compare and readiness gates:
- SHADOW_COMPARE_MAX_RECORDS=5000
- SHADOW_COMPARE_MISMATCH_ALERT_PCT=5
- CHANNEL_HEALTH_STALE_MINUTES=90
- CHANNEL_HEALTH_WARN_FAILURE_PCT=5
- LAUNCH_MIN_PAIRED_EVENTS=100
- LAUNCH_MAX_WARNING_CHANNELS=0
- LAUNCH_MAX_WEBHOOK_FAILURE_RATE_PCT=2

## Required Shopify Config

1. Webhooks:
- orders/create -> https://<synapse-host>/webhooks/shopify/orders/create
- orders/paid -> https://<synapse-host>/webhooks/shopify/orders/paid

2. Theme app extension:
- Enable GCW Synapse block in Hyper theme
- Set Synapse endpoint and ingress token

3. Customer events pixel:
- Publish extensions/customer-events-pixel/gcw-synapse-customer-events.js
- Set endpoint and ingress token inside pixel script

## GTM Import Companion

Import file:
- docs/gtm/GTM-TKW58K8_synapse_runtime_companion_import.json

Outcome:
- Adds gcw_synapse_event trigger
- Adds Synapse runtime DLV variables
- Adds bridge tag from gcw_synapse_event to legacy dl_<event_name> events

## Operational Commands

Backend verification:
- npm run typecheck
- npm test

Runtime checks:
- GET /runtime/summary
- GET /runtime/recent?limit=100
- GET /compare/parity
- GET /launch/readiness?phase=validation

## Security Checklist

1. INGRESS_SHARED_TOKEN is set and rotated.
2. Shopify webhook secret matches production app config.
3. No secret values committed in repo.
4. /diagnostics and /compare routes require ingress token.
5. CORS and WAF rules applied at edge for API host.

## Handoff Sign-off

Sign-off requires:
1. Typecheck and tests green.
2. GTM preview validates gcw_synapse_event and legacy dl_ bridge events.
3. Shadow parity within threshold.
4. Commerce Shield suppression metrics visible in /runtime/summary.
5. Launch readiness endpoint returns go for cutover phase.
