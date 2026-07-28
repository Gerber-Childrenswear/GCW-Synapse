# Prod Elevar cutover playbook

**Only after gcw-dev sign-off** (`docs/GCW_DEV_GTM_CUTOVER.md`).

See also **[PROD_READY_HARDENING.md](PROD_READY_HARDENING.md)** (admin secret rotation, webhook fail-closed, synthetic-excluded launch gate) before treating Synapse as sole tracker.

## Containers

| Env | Web GTM | Server GTM |
|---|---|---|
| Dev (prove first) | `GTM-WH3W368X` | n/a for cutover proof |
| Prod | `GTM-TKW58K8` (**do not edit until ready**) | `GTM-N45F3JCC` |

## Ownership (post-cutover)

- **Synapse** owns: theme embed `dl_*`, web pixel checkout events, session/UTM cookies, purchase webhooks → sGTM, browser dual-run parity, ops alerts.
- **GTM web + sGTM** own: all destination tags (Meta, GA4, Ads, Reddit CAPI, etc.).
- **Elevar** is uninstalled after parity gates pass.

## Prod install (blocked until app is on gerberchildrenswear)

```bash
# Status
curl -s -H "X-Synapse-Token: $TOKEN" \
  https://gcw-synapse-super.gcwsynapse.workers.dev/ops/shopify-install-status | jq

# Install landing (owner)
open "https://gcw-synapse-super.gcwsynapse.workers.dev/install?shop=gerberchildrenswear.myshopify.com"

# After OAuth
curl -s -X POST -H "X-Synapse-Token: $TOKEN" -H "Origin: https://gcw-synapse-super.gcwsynapse.workers.dev" \
  "https://gcw-synapse-super.gcwsynapse.workers.dev/ops/wire?shop=gerberchildrenswear.myshopify.com" | jq
```

Or: `npm run cutover:status` (prints install links + marks `prod_installed` / `prod_wire` as TODO until green).

## Prod sequence

1. Deploy Synapse app version already validated on gcw-dev (`shopify app deploy` + Worker / Workers Builds).
2. Install / re-auth on prod shop (links above); enable theme App embed **GCW Synapse**; activate web pixel (`beaconUrl` → Worker `/browser/beacon`).
3. Dual-run with Elevar still on. Watch:
   - `/compare/browser` → `parity.matched_rate_pct` ≥ 95 on core funnel
   - `/launch/readiness` → `status: go`
   - Platforms UI launch gate = GO
4. Channel-by-channel validation via `docs/ELEVAR_CHANNEL_CUTOVER_SHEET.md`.
5. Set Worker secrets: real `GTM_SERVER_URL`, `GTM_FORWARD_SHARED_SECRET`, `SHOPIFY_WEBHOOK_SECRET`; keep `RUNTIME_MODE=shadow_compare` until purchase shadow is green.
6. Flip `RUNTIME_MODE=forward` for purchase server path.
7. Disable Elevar theme/app on prod; re-check volumes 24–48h.
8. Optional: configure `SLACK_WEBHOOK_URL` / `ALERT_EMAIL_*` for accuracy alerts.

## Rollback

1. Re-enable Elevar theme embed / app.
2. Set `RUNTIME_MODE=shadow_compare`.
3. Investigate `/compare/browser`, `/compare/parity`, `/ops/alerts`.

## Explicit non-touch

Do not modify prod web container `GTM-TKW58K8` during gcw-dev work. Prod web tag edits happen only in the dedicated prod cutover window after this playbook’s gates are green.
