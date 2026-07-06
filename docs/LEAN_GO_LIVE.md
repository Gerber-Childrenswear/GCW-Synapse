# Lean Synapse Go-Live

**Goal:** Own your Shopify → GTM analytics pipe without Elevar — accurate client events, optional server purchases later, no cutover PhD.

Production Worker (Gerber): `https://gcw-synapse-super.gcw-synapse.workers.dev`

---

## Architecture (all you need)

```
Shopify theme pixel  ──POST /event──►  Cloudflare Worker (Synapse)
                                              │
GTM web (TKW58K8)  ◄── dl_* bridge ───  gcw_synapse_event in dataLayer
       │
GTM server (N45F3JCC) ◄── webhooks / server tags (phase 2)
       │
GA4 · Meta · Reddit · Bloomreach · etc.
```

**Ignore for now:** takeover-readiness gates, shadow-compare tooling, Render/Node origin, 129-placeholder checklist (chip away later).

---

## 5 steps to live

### 1. Deploy (or confirm) the Worker

```bash
export CLOUDFLARE_API_TOKEN="<token>"
export SYNAPSE_INGRESS_TOKEN="<strong-secret>"
npm run lean:deploy
```

Already deployed? Verify:

```bash
npm run lean:verify
```

### 2. Shopify — one client pixel owner

**Online Store → Themes → Customize → App embeds**

| Embed | Action |
|---|---|
| **GCW Synapse** | **ON** — endpoint: `https://gcw-synapse-super.gcw-synapse.workers.dev/event` |
| **Elevar** | Leave ON until step 4 validates; then **OFF** |
| **Triple Whale** | Pick TW **or** Synapse+GTM for client events — not both |

Ingress token in theme block: **leave blank** (browsers must not hold secrets).

**Customer-events pixel** (checkout): same endpoint in `extensions/customer-events-pixel/gcw-synapse-customer-events.js` (defaults on `main`).

### 3. GTM web container — one import

Container: **GTM-TKW58K8** (web only — never sGTM `GTM-N45F3JCC`).

Import: `docs/gtm/GTM-TKW58K8_synapse_runtime_companion_import.json`

This adds:
- `gcw_synapse_event` trigger
- Runtime bridge tag → `dl_<event_name>` for existing tags

### 4. GTM Preview — four critical events

Load the storefront in Preview. Confirm **one fire per action**:

| Action | Expect |
|---|---|
| Any page load | `gcw_synapse_event` + `dl_user_data` |
| Product page | `dl_view_item` |
| Add to cart | `dl_add_to_cart` |
| Test order / thank-you | `dl_purchase` (checkout pixel) |

Bloomreach tags must still resolve variables (currency, product id, order id). Do **not** delete Elevar GTM entities until each validates.

### 5. Retire Elevar embed (only after step 4)

Disable Elevar app embed. Soak 24–48h. Watch ad platforms + Bloomreach.

---

## Ops URLs

| URL | Auth |
|---|---|
| `/health` | None |
| `/event` | Public (CORS + rate limit) |
| `/` (admin UI) | Optional |
| `/ops/dashboard` | `X-Synapse-Token` |
| `/launch/readiness` | `X-Synapse-Token` |

---

## Phase 2 (when you need server purchase dedupe)

Point Shopify webhooks `orders/paid` → persistent Node host (Render) or extend Worker + KV:

- `GTM_SERVER_URL` → sGTM collect URL
- `SHOPIFY_WEBHOOK_SECRET`
- `GTM_FORWARD_SHARED_SECRET`

Until then, **checkout pixel + browser purchase** covers most client-side tags.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| No `gcw_synapse_event` in Preview | Theme Synapse embed off or wrong endpoint |
| Double events | Elevar + Synapse both on — disable one |
| `403` on `/event` | Add storefront origin to `PUBLIC_EVENT_ALLOWED_ORIGINS` in `wrangler.toml`, redeploy |
| Tags fire but variables empty | Repoint GTM variables to Synapse runtime DLVs (incremental) |

---

## Commands

```bash
npm run lean:verify          # health + critical /event probes
npm run lean:deploy          # build + Cloudflare deploy
npm test                     # 119 tests
```

Full cutover tooling (`gtm:*:takeover`) remains for later — not required for lean go-live.
