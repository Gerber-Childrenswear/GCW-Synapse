# Prod-ready hardening checklist

P0 remediations for sole-tracker readiness (SEC-001 / SEC-002 / DATA-001).

## Before next Worker deploy

**Lesson from #14:** shipping without `ADMIN_UI_PASSWORD` as a Worker **secret** (and with the var removed from `wrangler.toml`) locks `/ops/*`. If that happens, temporarily restore the var, redeploy, then `wrangler secret put ADMIN_UI_PASSWORD` and remove plaintext again.

1. Set (or rotate) the secret on the live Worker **before** removing the var:

```bash
wrangler secret put ADMIN_UI_PASSWORD --config wrangler.toml
# paste a strong password (can keep Sugi2.0 until rotated)
```

2. Optionally set a dedicated session key:

```bash
wrangler secret put SESSION_HMAC_SECRET --config wrangler.toml
```

3. Confirm webhook HMAC secret is set:

```bash
wrangler secret put SHOPIFY_WEBHOOK_SECRET --config wrangler.toml
```

4. Deploy from `worker` path / Workers Builds (`npm run cf:deploy` / repo `wrangler.toml`).

5. Smoke:

```bash
export ADMIN_UI_PASSWORD='<new-secret>'
curl -sS -H "X-Synapse-Token: $ADMIN_UI_PASSWORD" \
  https://gcw-synapse-super.gcwsynapse.workers.dev/ops/connection | jq '.status,.incomplete'
curl -sS -H "X-Synapse-Token: $ADMIN_UI_PASSWORD" \
  https://gcw-synapse-super.gcwsynapse.workers.dev/launch/readiness | jq '.report.status,.report.checks'
```

## Real dual-run proof (gcw-dev)

```bash
# Chromium once: npx playwright install chromium
GCW_DEV_STOREFRONT_PASSWORD='…' ADMIN_UI_PASSWORD='…' npm run prove:dual-run:dev
# optional: --rounds 8 --headed --product <handle>
```

This drives a real browser funnel and checks `/launch/readiness` (synthetic demo/sim traffic does not count).

## Cutover still needs humans

1. Real browse dual-run on gcw-dev + GTM Preview `GTM-WH3W368X`.
2. Prod app install on `gerberchildrenswear.myshopify.com`.
3. Wire webhooks / pixel / theme embed; dual-run; then Elevar off.
