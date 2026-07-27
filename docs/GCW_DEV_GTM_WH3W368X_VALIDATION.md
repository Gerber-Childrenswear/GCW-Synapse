# GTM-WH3W368X Synapse-only validation checklist

Use on **gcw-dev** before disabling Elevar. Do not touch prod web `GTM-TKW58K8`.

## Setup

- [ ] Synapse theme App embed enabled (CDN script loads from Worker)
- [ ] Synapse web pixel active (`beaconUrl`, `shopDomain=gcw-dev.myshopify.com`)
- [ ] Elevar still on for dual-run (initial)
- [ ] Optional: mirror Elevar events to `POST /compare/browser/elevar` (ingress token)

## Preview (GTM-WH3W368X)

- [ ] GTM Preview shows `dl_user_data`, `dl_view_item`, `dl_add_to_cart`, `dl_begin_checkout`, `dl_purchase`
- [ ] Tag fires on Synapse payloads (product id / currency / revenue present)
- [ ] Temporarily block Elevar script → tags still fire from Synapse `dl_*`

## Parity gates

- [ ] `npm run simulate:dual-run:dev` → dual-run wiring smoke OK
- [ ] `npm run cutover:status` → automated checks PASS (prod install may still be TODO)
- [ ] `/compare/browser` → core funnel matched ≥ 95%
- [ ] `/launch/readiness` → `status: go` (purchase + browser checks)
- [ ] Platforms UI launch gate shows **GO**

## Elevar off (gcw-dev only)

- [ ] Disable Elevar theme/app on gcw-dev
- [ ] Re-check volumes in GA4/Meta test properties for 24h
- [ ] When purchase path ready: set `GTM_SERVER_URL`, `RUNTIME_MODE=forward`

## Sign-off

- [ ] Dev owner signs off → proceed to `docs/PROD_ELEVAR_CUTOVER_PLAYBOOK.md`
