# GA4: Browser vs Measurement Protocol / sGTM

Measurement ID: `G-YMJ9F7HY6P`  
Compatibility: `GET /compatibility/ga4-id`

**API secret** stays in GTM/sGTM — not a Worker secret.

## Surfaces

| Surface | Where it fires | Dedupe key |
|---|---|---|
| Browser | Web GTM GA4 config + event tags | Prefer shared `event_id`; purchase also needs matching `transaction_id` |
| Server | sGTM GA4 / Measurement Protocol | Same `transaction_id` on purchase; align `client_id` when possible |

Platforms health uses **`transaction_id`** as the GA4 key field (falls back to `event_id`).

## Funnel map

| Synapse `dl_*` | Browser GA4 event | Server / MP event | Monitored |
|---|---|---|---|
| page / `dl_user_data` | `page_view` | `page_view` | Yes |
| `dl_view_item` | `view_item` | `view_item` | Yes |
| `dl_add_to_cart` | `add_to_cart` | `add_to_cart` | Yes |
| `dl_begin_checkout` | `begin_checkout` | `begin_checkout` | Yes |
| `dl_purchase` | `purchase` | `purchase` | Yes |

Also in Elevar GTM (not in Platforms core 5): `add_payment_info`, `add_shipping_info`, `view_cart`, `remove_from_cart`, `view_item_list`, `search`, `sign_up`, `generate_lead`.

## Required shared fields

- **Purchase:** identical `transaction_id` (order name/id) on browser + server
- **Items:** same item `id` strategy as Elevar (`id` / SKU)
- **Currency:** `USD` (`SHOP_DEFAULT_CURRENCY` / `dlv - Global - Currency Code`)
- **measurement_id** + MP **api_secret** on the server tag

## Failure modes

| Code | Symptom | Fix |
|---|---|---|
| `ga4.dedupe_partial` | Browser-only / server-only keys | Align `transaction_id` / `event_id`; clear orphan pulses |
| Missing MP secret | Server silent or 403 | Set GA4 Measurement Protocol API secret in sGTM |
| Wrong measurement ID | Events land in wrong property | Match `G-YMJ9F7HY6P` on browser config + server tag |

## Verify

```bash
curl -sS https://gcw-synapse-super.gcwsynapse.workers.dev/compare/platforms \
  | jq '.matrix.platforms[] | select(.id=="ga4") | {status, match_pct, dedupe}'
```

Target: `healthy`, `dedupe.confirmation_pct=100`.
