# GCW Synapse Cutover Runbook

## Objective

Transition storefront/runtime ingestion from shadow_compare to forward with quantified go/no-go controls.

## Phase 0 - Preflight (T-48h)

1. Deploy latest API and extension artifacts.
2. Confirm webhooks are healthy:
- /webhooks/shopify/orders/create
- /webhooks/shopify/orders/paid
3. Confirm runtime ingestion path returns 202 for valid events on /event.
4. Import GTM companion runtime bridge JSON.

## Phase 1 - Shadow Compare (T-48h to T-0)

Set:
- RUNTIME_MODE=shadow_compare

Monitor every 2 hours:
1. /compare/parity
2. /compare/channels
3. /runtime/summary
4. /launch/readiness?phase=validation

Go thresholds:
1. Mismatch rate <= SHADOW_COMPARE_MISMATCH_ALERT_PCT for at least 12h.
2. Webhook failure rate <= LAUNCH_MAX_WEBHOOK_FAILURE_RATE_PCT.
3. Warning channels <= LAUNCH_MAX_WARNING_CHANNELS.
4. Paired events >= LAUNCH_MIN_PAIRED_EVENTS.

No-go triggers:
1. Sustained mismatch > threshold for 2 consecutive checks.
2. Any spike in suppressed human traffic.
3. Critical destination stale status in compare/channels.

## Phase 2 - Controlled Forward (T-0 to T+24h)

Set:
- RUNTIME_MODE=forward

Actions:
1. Keep Elevar script enabled for first 2 hours as contingency.
2. Verify forwarded count increases on /runtime/summary.
3. Validate dl_ bridge events in GTM preview.
4. Validate GA4/Ads/Meta/TikTok/Pinterest/Bloomreach event receipts.

Success criteria first 24h:
1. No duplicate event explosion.
2. Suppressed events map only to bots/consent-denied sessions.
3. Conversion tags continue to fire for purchase and checkout events.

## Rollback Procedure

Trigger rollback if:
1. Forwarded events collapse >20% vs shadow baseline.
2. Purchase or checkout signal loss exceeds 5% for any major platform.

Rollback steps:
1. Set RUNTIME_MODE=shadow_compare and redeploy env.
2. Disable theme app block for Synapse if severe.
3. Disable customer events pixel script for Synapse.
4. Keep webhook relay for orders/create and orders/paid active.
5. Restore Elevar client-side injection.
6. Re-run smoke suite and parity checks before reattempt.

## Hourly Incident Template

Capture each hour:
- parity.mismatch_rate_pct
- runtime.forwarded
- runtime.suppressed
- runtime.duplicate
- webhook_failure_rate_pct
- top channel issues
- action taken

## Final Exit Gate

Promotion complete when /launch/readiness?phase=cutover returns go and holds for 6 hours with no incident-level regressions.
