# gcw-dev GTM cutover playbook (Synapse-only)

**Web container:** `GTM-WH3W368X` (GCW Dev)  
**Do not touch prod web:** `GTM-TKW58K8`  
**Prod sGTM (later):** `GTM-N45F3JCC`

## Preconditions

- [ ] Synapse theme embed enabled on gcw-dev
- [ ] Synapse web pixel active with beacon URL
- [ ] Dual-run browser parity ≥ 95% on core funnel (`dl_view_item`, `dl_add_to_cart`, `dl_begin_checkout`, `dl_purchase`)
- [ ] Purchase shadow parity GO on `/launch/readiness?phase=validation`
- [ ] GTM Preview shows Synapse `dl_*` events without Elevar script

## Cutover steps

1. In GTM Preview on gcw-dev, confirm tags fire on Synapse-emitted `dl_*` only (block Elevar script temporarily via uBlock or theme disable).
2. Disable Elevar app embed / scripts on gcw-dev.
3. Re-check event volumes for 24h in GA4/Meta test properties wired to `GTM-WH3W368X`.
4. When ready for server purchase forward: set real `GTM_SERVER_URL`, flip Worker `RUNTIME_MODE=forward`.
5. Re-check `/launch/readiness?phase=cutover`.

## Rollback

1. Re-enable Elevar theme/app on gcw-dev.
2. Set `RUNTIME_MODE=shadow_compare`.
3. Investigate mismatches via `/compare/browser` and `/compare/parity`.

## Prod (only after gcw-dev sign-off)

1. Deploy same Synapse app version to prod shop.
2. Dual-run against Elevar on prod.
3. Cut web container tags only after parity; keep sGTM destination ownership.
