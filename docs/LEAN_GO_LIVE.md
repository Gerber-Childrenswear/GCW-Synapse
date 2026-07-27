# Lean Synapse Go-Live

**Goal:** Own your Shopify → GTM analytics pipe without Elevar — accurate client events, optional server purchases later.

**Validate on gcw-dev first**, then promote to production. Same Worker serves both shops.

Worker URL: `https://gcw-synapse-super.gcwsynapse.workers.dev`

---

## Phase 0 — Map on gcw-dev (do this first)

The Shopify app / theme extension is only installed on **gcw-dev** today. Use it as the staging ground.

| Setting | gcw-dev value |
|---|---|
| Shop | `gcw-dev.myshopify.com` |
| Storefront origin | `https://gcw-dev.myshopify.com` |
| Synapse beacon | `https://gcw-synapse-super.gcwsynapse.workers.dev/browser/beacon` |

### Verify Worker accepts gcw-dev traffic

```bash
npm run lean:verify:dev
npm run simulate:dual-run:dev      # wiring smoke (Synapse + Elevar-mirror beacons)
npm run cutover:status:full        # automated checklist + dual-run sim
```

### Shopify gcw-dev admin

See **[SHOPIFY_GCW_DEV_EMBED.md](SHOPIFY_GCW_DEV_EMBED.md)** if the app is installed but **GCW Synapse** does not appear under App embeds.

1. **Online Store → Themes → Customize → App embeds** (puzzle icon — not page “Apps” blocks)
2. Enable **GCW Synapse**
3. Script: `https://gcw-synapse-super.gcwsynapse.workers.dev/gcw-synapse.js?v=1.4.1`
4. Beacon: `https://gcw-synapse-super.gcwsynapse.workers.dev/browser/beacon` (sample rate 100%)
5. Ingress token: **leave blank**
6. If the embed is missing entirely, run `shopify app deploy` (theme extension not released to the store)
7. Keep Elevar **ON** for dual-run until Preview is green

### GTM Preview on gcw-dev

Prefer **`GTM-WH3W368X`** for Synapse-only validation (see `docs/GCW_DEV_GTM_WH3W368X_VALIDATION.md`). Do not edit prod web `GTM-TKW58K8` until the prod cutover window.

1. Import companion tags if needed (`docs/gtm/GTM-TKW58K8_synapse_runtime_companion_import.json` for prod later)
2. GTM Preview → connect to `https://gcw-dev.myshopify.com`
3. Confirm: `dl_user_data`, `dl_view_item`, `dl_add_to_cart`, `dl_purchase`

### Promote to production

When gcw-dev Preview is green:

```bash
npm run lean:verify:prod
```

Repeat theme embed on production theme with the same endpoint. See **Phase 1** below.

---

## Phase 1 — Production (after gcw-dev is green)

### Architecture

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
# Optional: override admin unlock password (default / wrangler var is Sugi2.0)
# export ADMIN_UI_PASSWORD="Sugi2.0"
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
| **GCW Synapse** | **ON** — endpoint: `https://gcw-synapse-super.gcwsynapse.workers.dev/event` |
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
| `/event`, `/browser/beacon` | Public (CORS allowlist + rate limit) |
| `/gcw-synapse.js` | None (storefront CDN) |
| `/compatibility/*` | None (public pixel/measurement IDs for GTM) |
| `/login` | None (form); unlock with admin password |
| `/` (admin UI) + `/ops/*` + `/launch/readiness` | Session cookie, `X-Synapse-Token`, or Basic — default password `Sugi2.0` (override via `ADMIN_UI_PASSWORD`) |

**Deploy note:** Cloudflare **Workers Builds** is the reliable prod path today. GitHub **Deploy Worker** needs a valid raw `CLOUDFLARE_API_TOKEN` secret (no `Bearer ` prefix / newlines) or it fails while Builds still ship.

---

## Phase 2 (server purchase → sGTM)

Edge Worker already accepts Shopify purchase/refund webhooks and can forward when secrets are set:

- `SHOPIFY_WEBHOOK_SECRET` (required in `RUNTIME_MODE=forward`)
- `GTM_SERVER_URL` → sGTM collect URL (`GTM-N45F3JCC`)
- `GTM_FORWARD_SHARED_SECRET`

Until webhooks are live on the shop, **checkout pixel + browser purchase** covers most client-side tags.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| No `gcw_synapse_event` in Preview | Theme Synapse embed off or wrong endpoint |
| Double events | Elevar + Synapse both on — disable one |
| `403` on `/event` or `/browser/beacon` | Add storefront origin to `PUBLIC_EVENT_ALLOWED_ORIGINS` in `wrangler.toml`, redeploy |
| `/compatibility/ids` returns `401` | Redeploy main (password gate must keep compatibility public) |
| Tags fire but variables empty | Repoint GTM variables to Synapse runtime DLVs (incremental) |
| Admin UI locked | Unlock at `/login` with `Sugi2.0` or send `X-Synapse-Token` |

---

## Commands

```bash
npm run lean:verify:dev        # gcw-dev storefront origin (default)
npm run lean:verify:prod       # gerberchildrenswear.com origins
npm run lean:verify            # same as lean:verify:dev
npm run lean:deploy            # build + Cloudflare deploy
npm test                       # unit tests
```

Full cutover tooling (`gtm:*:takeover`) remains for later — not required for lean go-live. Manual workflow: **Takeover Readiness**.
