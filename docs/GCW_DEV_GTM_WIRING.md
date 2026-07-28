# GTM wiring status (gcw-dev)

## Live observation (2026-07-23)

Password-unlocked storefront loads **`GTM-TKW58K8`** (not `GTM-WH3W368X`).

Elevar suite config still lists `market_groups[].gtm_container = GTM-WH3W368X`, but the theme/GTM snippet currently injects **TKW58K8**. Synapse `dl_*` events therefore feed the same Elevar tags already in TKW58K8.

sGTM collect host observed from page traffic:

`https://server-side-tagging-he5lc7bj4a-uc.a.run.app/g/collect`

Worker secret `GTM_SERVER_URL` is set to that URL. Worker `RUNTIME_MODE` is **`forward`** on gcw-dev so Synapse purchases also hit sGTM while Elevar stays on for side-by-side (`docs/GCW_DEV_DUAL_RUN.md`).

## Companion import

Use existing:

- `docs/gtm/GTM-TKW58K8_synapse_runtime_companion_import.json`

Import into a **Synapse Preview** workspace on account `4131312986` / container `9938197` before publishing.

If `user-gtm` MCP is not connected in your environment, import manually via the GTM UI or from an editor session with GTM MCP connected.

## Prove Synapse-only later

1. Keep dual-run with Elevar on.
2. When `/compare/browser` paired ≥ 95%, disable Elevar app embed on gcw-dev only.
3. Confirm TKW58K8 still fires from Synapse `dl_*`.
4. Only then consider pointing a dedicated WH3W368X container (if that container is still desired for isolation).
