# TikTok: Pixel vs Events API (gcw-dev / Synapse)

Pixel ID (from Elevar GTM constant): `COUGEIBC77UF83EUUA6G`  
Compatibility route: `GET /compatibility/tiktok-pixel-id`

**Secrets stay in GTM/sGTM** — Events API `access_token` is not a Worker secret.

## Surfaces

| Surface | Where it fires | Dedupe key |
|---|---|---|
| Browser | Web GTM TikTok Pixel tags (`ttq.track` / `ttq.page`) | `event_id` (`{{dlv - event_id}}`) |
| Server | sGTM TikTok Events API tag (`pixel_code` + access token) | Same `event_id` (plus order id on purchase) |

TikTok dedupes browser + server when **Pixel ID / `pixel_code` match** and **`event_id` is shared** within the dedupe window. Platforms health uses `event_id` as the key field.

## Funnel map (Synapse `dl_*` → Pixel → Events API)

| Synapse / dataLayer | GTM trigger (Elevar) | Browser TikTok event | Events API event | Monitored in Platforms |
|---|---|---|---|---|
| `dl_view_item` / page load | Product / sitewide | `Pageview` / `ViewContent` | `Pageview` / `ViewContent` | Yes |
| `dl_view_item` | TikTok - Product View [155] | `ViewContent` | `ViewContent` | Yes |
| `dl_view_item_list` | TikTok - Collection View [148] | `ViewContent` (contents) | `ViewContent` | Extra (not in core 5) |
| `dl_add_to_cart` | TikTok - Add to Cart [157] | `AddToCart` | `AddToCart` | Yes |
| `dl_begin_checkout` | TikTok - Initiate Checkout [170] | `InitiateCheckout` | `InitiateCheckout` | Yes |
| `dl_add_payment_info` | TikTok - Add Payment Info [164] | `AddPaymentInfo` | `AddPaymentInfo` | Extra |
| `dl_purchase` | TikTok - Purchase (Complete Payment) [154] | `CompletePayment` | `CompletePayment` | Yes |
| `dl_purchase` | TikTok - Place An Order [161] | `PlaceAnOrder` | `PlaceAnOrder` | Extra |
| subscribe / signup | Email / Account Sign Up | `Subscribe` / `CompleteRegistration` | same | Extra |
| search | TikTok - Search [168] | `Search` | `Search` | Extra |

Platforms expected core set: `Pageview`, `ViewContent`, `AddToCart`, `InitiateCheckout`, `CompletePayment`.

## Required shared fields

- **`event_id`** — from Synapse/Elevar `dlv - event_id` on every browser + server tag
- **`pixel_code` / Pixel ID** — `COUGEIBC77UF83EUUA6G` on both sides
- **Purchase** — also send order id (`transaction_id` / order_id) on `CompletePayment`
- **PII** — hashed email/phone via Elevar TikTok cleaners (`js - TikTok Email`, `js - TikTok Phone`) when available

## Common failure modes (Platforms diagnostics)

| Code | Symptom | Fix |
|---|---|---|
| `tiktok.token` | Server pulses `access_token_invalid` | Regenerate Events API token for this Pixel in TikTok Events Manager; update sGTM tag |
| `tiktok.pixel_id` | Browser ID ≠ server `pixel_code` | Align GTM constant with Events API pixel |
| `tiktok.dedupe` | Partial confirmation (browser-only / server-only keys) | Ensure both tags send the same `event_id`; clear orphan test pulses via `POST /ops/reset-health` then reseed pairs |

## Verify

```bash
# After clean paired seeds
curl -sS https://gcw-synapse-super.gcwsynapse.workers.dev/compare/platforms \
  | jq '.matrix.platforms[] | select(.id=="tiktok") | {status, match_pct, dedupe}'
```

Healthy target: `status=healthy`, `dedupe.status=confirmed`, `confirmation_pct=100`.

Live storefront: GTM Preview on `gcw-dev` — confirm TikTok tags fire with `event_id` after consent; headless often misses consent-gated pixels.
