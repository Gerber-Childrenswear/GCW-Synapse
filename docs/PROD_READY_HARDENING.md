# Prod-ready hardening checklist

P0 remediations for sole-tracker readiness (SEC-001 / SEC-002 / DATA-001).

## Before next Worker deploy

Admin password is **no longer** in `wrangler.toml` and has **no code default**.

1. Set (or rotate) the secret on the live Worker **before** deploying this branch:

```bash
wrangler secret put ADMIN_UI_PASSWORD --config wrangler.toml
# paste a new strong password (do not reuse the old repo default)
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

## Launch gate honesty

- Demo-seed and `simulate:dual-run:dev` mark beacons `synthetic: true` (and `demo_` / `sim_` event ids).
- `/launch/readiness` counts **real** storefront beacons only.
- `/compare/browser` still shows all traffic (including synthetic) for wiring smoke tests.

## Cutover still needs humans

1. Real browse dual-run on gcw-dev + GTM Preview `GTM-WH3W368X`.
2. Prod app install on `gerberchildrenswear.myshopify.com`.
3. Wire webhooks / pixel / theme embed; dual-run; then Elevar off.
