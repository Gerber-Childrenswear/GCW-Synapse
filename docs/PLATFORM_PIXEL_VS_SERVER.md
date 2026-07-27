# Platform pixel vs server maps (gcw-dev)

Companion to `TIKTOK_PIXEL_EVENTS_API.md` and `GA4_BROWSER_VS_MP.md`.  
Public IDs from `ELEVAR_STOLEN_CONFIG.md`. Destination tokens stay in GTM/sGTM.

## Paid social

### Meta — `823006016363458`

| Synapse | Browser (Pixel) | Server (CAPI) | Dedupe |
|---|---|---|---|
| page / view | `PageView` / `ViewContent` | same | `event_id` |
| `dl_add_to_cart` | `AddToCart` | same | `event_id` |
| `dl_begin_checkout` | `InitiateCheckout` | same | `event_id` |
| `dl_purchase` | `Purchase` | same | `event_id` (+ order id) |

Also send `fbp`/`fbc` + hashed `em`/`ph` when consent allows.

### Pinterest — `2612527712746`

| Synapse | Browser (Tag) | Server (CAPI) | Dedupe |
|---|---|---|---|
| page | `page_visit` | same | `event_id` |
| `dl_view_item_list` | `view_category` | same | `event_id` |
| `dl_add_to_cart` | `add_to_cart` | same | `event_id` |
| `dl_purchase` / checkout | `checkout` | same | `event_id` |

Elevar also has Product Detail View, Search, Lead, Sign Up — keep `event_id` on each.

### Reddit — `a2_iql6tlstlbj4`

| Synapse | Browser (Pixel) | Server (CAPI) | Dedupe |
|---|---|---|---|
| page | `PageVisit` | same | conversion / `event_id` |
| `dl_view_item` | `ViewContent` | same | same key both sides |
| `dl_add_to_cart` | `AddToCart` | same | |
| `dl_purchase` | `Purchase` | same | |

sGTM Reddit CAPI tags use bot suppression (triggers 30/31) — known crawlers should not look like confirmed bots.

## Search / ads

### Google Ads — conversion ID `874796722`

| Synapse | Browser | Server (Enhanced Conv) | Dedupe |
|---|---|---|---|
| page | remarketing `page_view` | optional | |
| `dl_add_to_cart` / checkout | remarketing events | | |
| `dl_purchase` | Conversion - Purchase | Enhanced conversions | `transaction_id` + hashed PII match |

Re-check conversion **label** mapping after Synapse cutover.

## Commerce / pipe

### Bloomreach — account `7858`

Primarily **GTM browser tags** (Product Page, Add To Cart, Purchase) reading Synapse `dl_*` + Bloomreach cookies/segments — not a classic Pixel/CAPI pair. Platforms expected: `view_item`, `cart_update`, `purchase`, `consent`. Remap any Elevar-only dataLayer paths before cutover.

### CJ (Commission Junction)

Server-side order confirmation with coupon fidelity — Platforms expects `purchase` with stable order id.

### Server GTM (`GTM-N45F3JCC`) + Synapse

Pipe rows: healthy when either surface is firing. Synapse theme embed + web pixel emit `dl_*`; webhooks forward purchases into sGTM. If sGTM is silent, every destination downstream starves.

## Live verify

```bash
# Prefer healthy demo pulses (clears prior health, seeds Meta/TikTok/Pinterest/… green)
curl -sS -X POST 'https://gcw-synapse-super.gcwsynapse.workers.dev/compare/demo-seed'
curl -sS https://gcw-synapse-super.gcwsynapse.workers.dev/compare/platforms \
  | jq '.matrix.platforms[] | {id, status, dedupe:.dedupe.status, pct:.dedupe.confirmation_pct}'
```

Consent-gated pixels (Pandectes) may not fire in headless — use GTM Preview on `gcw-dev` for real browser proof.
