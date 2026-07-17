# Full Elevar Replacement (Synapse)

Synapse owns the **browser data layer**, **checkout web pixel**, and **server purchase webhooks**. Destinations stay in web GTM + Server GTM.

## Components

| Piece | Path | Role |
|---|---|---|
| Theme App Embed | `extensions/synapse-theme/` | Pushes Elevar-shaped `dl_*` events to `window.dataLayer` |
| Browser bundle | `src/browser/` → `extensions/synapse-theme/assets/gcw-synapse.js` | Session cookies, event_id, observers |
| Web Pixel | `extensions/synapse-web-pixel/` | Checkout / thank-you events → `/browser/beacon` |
| Beacon API | `POST /browser/beacon` | CORS mirror for parity + ops |
| Purchase webhooks | `orders/create`, `orders/paid` | HMAC → sGTM (with session marketing attach) |
| Compatibility vars | `/compatibility/*` | Elevar-shaped HTTP variables for GTM |

## Events covered

`dl_user_data`, `dl_view_item`, `dl_view_item_list`, `dl_view_search_results`, `dl_select_item`, `dl_add_to_cart`, `dl_remove_from_cart`, `dl_view_cart`, `dl_begin_checkout`, `dl_add_shipping_info`, `dl_add_payment_info`, `dl_purchase`, `dl_sign_up`, `dl_login`, `dl_subscribe`

## Deploy / install (gcw-dev first)

1. `npm run build:browser`
2. `shopify app deploy` (releases theme + web pixel extensions)
3. On **gcw-dev**: Theme settings → App embeds → enable **Synapse Data Layer**
4. Create/activate web pixel settings (`beaconUrl`, `shopDomain=gcw-dev.myshopify.com`)
5. Re-authorize app scopes: `read_orders,read_products,read_customers,write_pixels,read_customer_events`
6. Keep Elevar on for dual-run; mirror Elevar browser events to `POST /compare/browser/elevar` (token) if needed
7. Watch `/app/summary` → browser parity + activity table + GO/HOLD checks
8. When browser + purchase gates are green, disable Elevar on gcw-dev and validate `GTM-WH3W368X` still fires
9. Only then repeat on prod (`GTM-TKW58K8` web, `GTM-N45F3JCC` sGTM)

## Alerts

Optional env:

- `SLACK_WEBHOOK_URL`
- `ALERT_EMAIL_TO` + `ALERT_EMAIL_WEBHOOK_URL` (+ optional `ALERT_EMAIL_FROM`)

Parity alerts fire (rate-limited) when purchase or browser mismatch exceeds threshold.

## Build notes

```bash
npm run build:browser   # esbuild → theme asset
npm test
npm run typecheck
```
