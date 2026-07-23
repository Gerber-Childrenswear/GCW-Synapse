# Stolen Elevar config (gcw-dev + prod GTM constants)

Public IDs and runtime settings pulled from live Elevar so Synapse can replace the embed without guessing destination IDs.

**Do not** put destination API secrets (Meta CAPI tokens, TikTok Events API keys, etc.) in the Worker — those stay in web GTM / sGTM.

## Sources

| Source | What we took |
|---|---|
| `https://shopify-gtm-suite.getelevar.com/configs/103307518eec9c84785c4f47361b4addb99f9017/config.js` | gcw-dev Elevar suite config (GTM container, event toggles, ignored referrers) |
| `docs/gtm/GTM-TKW58K8_elevar_active_rebuild_bundle.json` | Prod web GTM constant variables (pixel / measurement IDs) |

## Destination IDs (GTM-TKW58K8 constants)

| Channel | Elevar / GTM variable | Value |
|---|---|---|
| Meta | `Facebook - Pixel ID` | `823006016363458` |
| GA4 | `GA4 ID` | `G-YMJ9F7HY6P` |
| Pinterest | `PINTEREST ISO - Tag ID` | `2612527712746` |
| TikTok | `TikTok - Pixel ID` | `COUGEIBC77UF83EUUA6G` |
| Reddit | tag param `id` | `a2_iql6tlstlbj4` |
| Google Ads | `Google Ads - Conversion ID - 874796722` | `874796722` |
| Bloomreach | `BloomReach Account ID` | `7858` |

Product identifier constants Elevar used:

- `product_id` (Facebook / TikTok content id field)
- `product_group` (content type)
- `id` / SKU for GA4 item id
- conversion value field: `revenue`

## gcw-dev Elevar suite config (2026-07)

```json
{
  "shop_url": "gcw-dev.myshopify.com",
  "allow_gtm": true,
  "consent_enabled": false,
  "market_groups": [
    {
      "id": 10319,
      "gtm_container": "GTM-WH3W368X"
    }
  ],
  "connector_url": "https://hits.getelevar.com",
  "event_config": {
    "cart_reconcile": true,
    "cart_view": true,
    "checkout_complete": true,
    "collection_view": true,
    "product_add_to_cart": false,
    "product_add_to_cart_ajax": true,
    "product_remove_from_cart": true,
    "product_select": true,
    "product_view": true,
    "search_results_view": true,
    "user": true,
    "save_order_notes": false
  },
  "destinations": {},
  "sources": {}
}
```

Notes:

- `destinations` / `sources` are empty on gcw-dev — pixels live in GTM, not Elevar destination packs.
- Dev web container is **`GTM-WH3W368X`** (prove here; never touch prod web `GTM-TKW58K8` from automation).
- Elevar scripts: `getelevar/3.34.5` (`dl-app-embed-block`, `dl-web-pixel-*`, `dl-custom-pages`).

## Synapse wiring

Worker vars in `wrangler.toml` (public IDs only):

- `FACEBOOK_PIXEL_ID`
- `GA4_MEASUREMENT_ID`
- `PINTEREST_ID`
- `TIKTOK_PIXEL_ID`
- `REDDIT_PIXEL_ID`
- `GOOGLE_ADS_CONVERSION_ID`
- `BLOOMREACH_ACCOUNT_ID`

Edge compatibility endpoints:

- `GET /compatibility/ga4-id`
- `GET /compatibility/facebook-pixel-id`
- `GET /compatibility/pinterest-id`
- `GET /compatibility/tiktok-pixel-id`
- `GET /compatibility/reddit-pixel-id`
- `GET /compatibility/google-ads-conversion-id`
- `GET /compatibility/bloomreach-account-id`
- `GET /compatibility/currency-code`
- `GET /compatibility/ids` — dump of all stolen public IDs

## Event parity vs Elevar toggles

Synapse browser bundle should keep covering the same surfaces Elevar had on:

| Elevar toggle | Synapse `dl_*` |
|---|---|
| `user` | `dl_user_data` |
| `product_view` | `dl_view_item` |
| `collection_view` | `dl_view_item_list` |
| `search_results_view` | `dl_view_search_results` |
| `product_select` | `dl_select_item` |
| `product_add_to_cart_ajax` | `dl_add_to_cart` (Ajax / fetch hook) |
| `product_remove_from_cart` | `dl_remove_from_cart` |
| `cart_view` / `cart_reconcile` | `dl_view_cart` + idle cart sync |
| `checkout_complete` | web pixel `dl_purchase` + order webhooks |

Elevar had `product_add_to_cart: false` (theme button) and relied on Ajax — Synapse matches that lean path.
