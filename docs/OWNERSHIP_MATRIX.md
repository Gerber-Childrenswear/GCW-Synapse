# Ownership matrix — Synapse vs GTM

Canonical companion to `docs/FULL_ELEVAR_REPLACEMENT.md`.

| Capability | Owner | Notes |
|---|---|---|
| Storefront `dl_*` data layer | **Synapse** theme embed | `extensions/theme-app-extension` + CDN `gcw-synapse.js` |
| Checkout / thank-you `dl_*` | **Synapse** web pixel | `extensions/customer-events-pixel` |
| Session / UTM cookies + cart attributes | **Synapse** browser bundle | Attached on purchase webhook |
| Purchase / refund webhooks → sGTM | **Synapse** Worker | HMAC + `RUNTIME_MODE` shadow/forward |
| Compatibility HTTP variables | **Synapse** `/compatibility/*` | For GTM vars still resolving over HTTP |
| Browser dual-run parity UI | **Synapse** | `/compare/browser`, Platforms launch gate |
| Accuracy Slack/email alerts | **Synapse** | `SLACK_WEBHOOK_URL`, `ALERT_EMAIL_*` |
| Destination tags (Meta, GA4, Ads, …) | **GTM web + sGTM** | Dev web `GTM-WH3W368X`; prod web `GTM-TKW58K8`; sGTM `GTM-N45F3JCC` |

**Out of scope:** Triple Whale (attribution + pixel). Do not monitor or dual-run with TW — Synapse + GTM own the Elevar replacement.

## Cutover docs

- Dev: `docs/GCW_DEV_GTM_CUTOVER.md`
- Prod: `docs/PROD_ELEVAR_CUTOVER_PLAYBOOK.md`
- Channels: `docs/ELEVAR_CHANNEL_CUTOVER_SHEET.md`
