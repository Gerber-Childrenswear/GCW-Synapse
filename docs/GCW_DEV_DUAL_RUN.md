# gcw-dev dual-run: Synapse ↔ Elevar side by side

Dev store only — both stacks stay **on** so we can compare.

## What is on

| Piece | State |
|---|---|
| Elevar app embed | **ON** (do not disable yet) |
| Synapse theme embed | **ON** — script `gcw-synapse.js?v=1.4.0`, beacon 100% |
| Synapse web pixel | **ON** — checkout → `/browser/beacon` |
| Purchase webhooks | **ON** → Worker |
| Worker `RUNTIME_MODE` | **`forward`** — purchases post to sGTM (`GTM_SERVER_URL`) |
| Browser dual-run mirror | Synapse `dl_*` → beacon `source=synapse`; non-Synapse `dl_*` → beacon `source=elevar` |

Web GTM stays `GTM-TKW58K8` on this storefront; sGTM is `GTM-N45F3JCC` via the live collect URL.

## Compare URLs

- Browser parity: https://gcw-synapse-super.gcwsynapse.workers.dev/compare/browser  
- Platforms: https://gcw-synapse-super.gcwsynapse.workers.dev/compare/platforms  
- Launch gate: https://gcw-synapse-super.gcwsynapse.workers.dev/launch/readiness  
- Ops: https://gcw-synapse-super.gcwsynapse.workers.dev/ops/connection  

## Theme script cache bust

In **Theme → App embeds → GCW Synapse**, set script URL to:

`https://gcw-synapse-super.gcwsynapse.workers.dev/gcw-synapse.js?v=1.4.0`

Beacon sample rate: **100%**. Keep Elevar enabled.

## v1.4.0 beat-Elevar field parity

- `cart_total` on ATC / remove / view_cart / checkout steps / purchase
- `ecommerce.currency` + `currencyCode` (GTM vars that read either)
- UTMs on dataLayer `marketing` + cart attributes (`utm_content` / `utm_term` too)
- `cart_contents.products` on `dl_view_cart` / `dl_user_data`
- Visitor type title case: **`Logged In` / `Guest`** (Elevar GTM contract)
- Cart reconcile after mutate + XHR hook
- Admin dual-run table + cart_total / product_id field coverage

## Expectation

Browsing product/collection/cart on password-unlocked gcw-dev should grow both `synapse_events` and `elevar_events` on `/compare/browser`. GTM tags may fire twice during dual-run — that is intentional on this empty order store.

Launch GO uses **volume match** (and fuzzy product pairing), not identical `event_id`s — Synapse and Elevar mint different IDs by design.

Hardening (v1.3.1+): ATC form+fetch dedupe, Elevarmirror once-only + event_id dedupe, beacon 429/5xx retry, skip password-page boot, Worker beacon retry dedupe.

When paired volume ≥ ~80% and purchase forward looks good, disable Elevar embed on gcw-dev only (see `GCW_DEV_GTM_WIRING.md`).
