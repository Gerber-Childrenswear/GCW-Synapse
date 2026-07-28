# GCW-Synapse — third-party engineering handoff

**Date:** 2026-07-28  
**Product:** GCW-Synapse (Elevar replacement for Gerber Childrenswear)  
**Repo:** `https://github.com/Gerber-Childrenswear/GCW-Synapse`  
**Branch to start from:** `main`  
**Goal:** Make Synapse the sole Shopify → GTM tracking pipe; turn Elevar off without losing destination tags.

**Ready-to-send partner message:** [HANDOFF_MESSAGE.md](HANDOFF_MESSAGE.md)

This brief is written so an external team can investigate, operate, and finish production cutover without prior context.

> **Security:** Treat everything in §2 as confidential. Rotate admin / storefront credentials after handoff. Do not commit new secrets. Prefer Cloudflare **secrets** over `wrangler.toml` `[vars]`.

---

## 1. What this system is

```
Shopify storefront (theme embed + web pixel)
        │  dl_* dataLayer + POST /browser/beacon
        ▼
Cloudflare Worker  gcw-synapse-super
  https://gcw-synapse-super.gcwsynapse.workers.dev
        │
        ├──► GTM Web (destinations: Meta, GA4, Ads, TikTok, …)
        └──► sGTM / GTM-N45F3JCC  (server purchases, CAPI, Commerce Shield forwarder)
```

- **Synapse owns:** client `dl_*` events, checkout web pixel, session/UTM cookies, purchase/refund webhooks → sGTM, dual-run parity vs Elevar, admin/ops.
- **GTM owns:** all destination tags (API secrets stay in GTM, not in the Worker).
- **Elevar:** still on for dual-run on gcw-dev; must stay on until parity gates pass, then uninstall.

Related (separate repo / stack): **Commerce Shield** bot protection + sGTM forwarder. sGTM container `GTM-N45F3JCC` is shared. Do **not** edit prod web GTM `GTM-TKW58K8` until the dedicated prod cutover window.

---

## 2. Credentials & access (give the team these)

### 2.1 Passwords known to GCW (confirm with Nicholas Cassidy)

| Use | Value | Notes |
|---|---|---|
| **Admin / Shopify embed unlock** (`ADMIN_UI_PASSWORD`) | `Sugi2.0` | Unlocks Worker admin UI + authorizes `X-Synapse-Token` / HTTP Basic for `/ops/*`, `/launch/readiness`, `/compare/*`. Currently also present as plaintext in `wrangler.toml` `[vars]` (temporary after a lockout). **Move to Cloudflare secret and rotate.** |
| **gcw-dev storefront password** | `Move2Sugi` | Shopify password page only. Pass via `GCW_DEV_STOREFRONT_PASSWORD` for scripts — **do not commit.** |

Auth header examples:

```bash
export ADMIN_UI_PASSWORD='Sugi2.0'
curl -sS -H "X-Synapse-Token: $ADMIN_UI_PASSWORD" \
  -A 'Mozilla/5.0' \
  'https://gcw-synapse-super.gcwsynapse.workers.dev/ops/connection' | jq
# or: -u "admin:$ADMIN_UI_PASSWORD"
```

### 2.2 Access the team must receive from GCW (not in repo)

| System | Why | Who grants |
|---|---|---|
| **GitHub** `Gerber-Childrenswear/GCW-Synapse` | Code, Actions, PRs | Org admin |
| **Cloudflare** account with Worker `gcw-synapse-super` | Deploy, secrets, Workers Builds, KV | CF admin |
| **Shopify Partners** app client `7d011b70562512bd84b85bd3f9a6e68d` | App install, theme extension deploy, scopes | Partners admin |
| **Shopify admin** `gcw-dev` | Theme embeds, apps, password storefront | Store staff |
| **Shopify admin** `gerberchildrenswear` (prod) | Prod install + theme (when ready) | Store owner |
| **GTM** accounts below | Preview, tags, sGTM | GTM admin Google account |
| **GitHub Actions secret** `CLOUDFLARE_API_TOKEN` | Fallback Deploy Worker workflow | Repo secrets admin |

Worker secrets that already exist in Cloudflare (values **not** in git — rotate/view in CF dashboard):

| Secret / env | Purpose | Status (2026-07-28) |
|---|---|---|
| `SHOPIFY_API_KEY` | OAuth / client id | Set (`client_id_hint` `7d011b70562512bd84b85bd3f9a6e68d`) |
| `SHOPIFY_API_SECRET` | OAuth + may back webhook HMAC | Set |
| `SHOPIFY_WEBHOOK_SECRET` | Shopify webhook HMAC (fail-closed if missing) | Set |
| `ADMIN_UI_PASSWORD` | Admin gate | Set (also duplicated in `wrangler.toml` var — clean up) |
| `GTM_SERVER_URL` | sGTM collect URL for purchase forward | Set (`RUNTIME_MODE=forward`) |
| `GTM_FORWARD_SHARED_SECRET` | Optional signed forward to sGTM | Confirm in CF |
| `SESSION_HMAC_SECRET` | Admin session cookie signing | Optional; defaults derived from password |
| `SYNAPSE_INGRESS_TOKEN` | Optional alternate admin/ingress token | Optional |
| `SLACK_WEBHOOK_URL` / alert webhooks | Ops alerts | Optional |

Public IDs in `wrangler.toml` (not secrets): Facebook, GA4, TikTok, Pinterest, Reddit, Google Ads, Bloomreach account — used by `/compatibility/*`.

---

## 3. Environments & URLs

| Env | Shop | Storefront | Notes |
|---|---|---|---|
| **Dev** | `gcw-dev.myshopify.com` | `https://gcw-dev.myshopify.com` | Password-gated (`Move2Sugi`). Synapse **installed**. Dual-run with Elevar. |
| **Prod** | `gerberchildrenswear.myshopify.com` | `https://www.gerberchildrenswear.com` | Synapse **not installed** yet (`app_not_installed`). |

| Surface | URL |
|---|---|
| Worker (live) | `https://gcw-synapse-super.gcwsynapse.workers.dev` |
| Health | `/health` (public) |
| Admin UI | `/` (password gate) |
| Login | `/login` |
| CDN script | `/gcw-synapse.js?v=1.4.1` |
| Browser beacon | `/browser/beacon` |
| Compatibility IDs | `/compatibility/*` (public) |
| Install / OAuth | `/install?shop=…`, `/auth/shopify/callback` |
| Ops connection | `/ops/connection` |
| Install probe | `/ops/shopify-install-status` |
| Wire pixel+webhooks | `POST /ops/wire?shop=…` (CSRF: Origin allowlist) |
| Dual-run flag | `/ops/dual-run` |
| Browser parity | `/compare/browser` |
| Launch gate | `/launch/readiness` |
| Dashboard | `/ops/dashboard` |

Shopify admin deep links:

- gcw-dev app: `https://admin.shopify.com/store/gcw-dev/apps/7d011b70562512bd84b85bd3f9a6e68d`
- Embed editor: `https://gcw-dev.myshopify.com/admin/themes/current/editor?context=apps&activateAppId=7d011b70562512bd84b85bd3f9a6e68d/gcw-synapse-app-block`
- Prod install: `https://gcw-synapse-super.gcwsynapse.workers.dev/install?shop=gerberchildrenswear.myshopify.com`

---

## 4. GTM containers (critical)

| Public ID | Role | Account | Container | Policy |
|---|---|---|---|---|
| **GTM-TKW58K8** | Prod web / pixel | `4131312986` | `9938197` | **Do not edit until prod cutover window** |
| **GTM-N45F3JCC** | Server GTM (sGTM) | `6348717123` | `248775717` | Live CS workspace **40** |
| **GTM-WH3W368X** | Dev Preview preference for Synapse-only proof | — | — | Prefer for gcw-dev Preview; storefront may still inject TKW58K8 today |

MCP (optional): hosted `user-gtm` at `https://mcp.gtmeditor.com/authorize` — see `docs/GTM_ALL_CHATS_SETUP.md`, `gtm-mcp-server/`.

Import artifacts: `docs/gtm/` (companion import, side-by-side preview bundle, placeholder checklist).

Observed sGTM collect host (also wired as Worker `GTM_SERVER_URL`):

`https://server-side-tagging-he5lc7bj4a-uc.a.run.app/g/collect`

---

## 5. Repo map (where to look)

| Path | What |
|---|---|
| `cloudflare/worker.ts` | Production edge Worker (source of truth for live) |
| `cloudflare/adminAuth.ts` | Admin password / session gate |
| `cloudflare/launchReadinessEdge.ts` | Launch GO/HOLD/WAITING logic |
| `cloudflare/securityHelpers.ts` | CORS, CSRF, redaction |
| `wrangler.toml` | Worker name, vars, KV binding `SYNAPSE_STATE` |
| `extensions/theme-app-extension/` | Theme App Embed (CDN JS + Liquid config) |
| `extensions/customer-events-pixel/` | Checkout web pixel |
| `src/services/browserEvents.ts` | Dual-run beacon store + synthetic exclusion |
| `src/services/edgeWebhook.ts` | Purchase webhook HMAC + forward |
| `apps/admin/` | Admin SPA (served as Worker assets) |
| `scripts/proveGcwDevDualRun.ts` | **Real** Playwright dual-run proof |
| `scripts/simulateGcwDevDualRun.ts` | Synthetic wiring smoke (does **not** count for launch GO) |
| `scripts/leanVerify.ts` | Lean endpoint checks |
| `scripts/cutoverStatus.ts` | Cutover checklist CLI |
| `docs/LEAN_GO_LIVE.md` | Primary go-live path |
| `docs/PROD_ELEVAR_CUTOVER_PLAYBOOK.md` | Prod Elevar off sequence |
| `docs/PROD_READY_HARDENING.md` | Secret rotation + launch honesty |
| `docs/SHOPIFY_GCW_DEV_EMBED.md` | Embed enablement |
| `docs/GCW_DEV_GTM_WIRING.md` | What GTM the storefront actually loads |
| `.github/workflows/deploy-worker.yml` | Fallback deploy (often soft-fails on bad CF token) |

**Deploy path that actually ships prod today:** Cloudflare **Workers Builds** on push to `main` (see check “Workers Builds: gcw-synapse-super”).  
Command locally: `npm run cf:deploy` (uses root `wrangler.toml`). Do **not** confuse with any stub asset worker.

KV: binding `SYNAPSE_STATE`, id `ab156619a930418c834e53588103970b`.

---

## 6. Current live state (as of 2026-07-28)

| Check | Result |
|---|---|
| Worker `/health` | OK — `gcw-synapse-super-edge` |
| `/ops/connection` | **green** (Shopify keys, webhook secret, admin password, GTM forward configured) |
| `RUNTIME_MODE` | `forward` |
| gcw-dev app installed | **Yes** |
| Prod app installed | **No** (`app_not_installed`) |
| Synapse dual-run enabled | **Yes** (`/ops/dual-run` → `synapse_enabled: true`) |
| `/launch/readiness` | **GO** on **real** beacons (synthetic demo/sim excluded). Example: ~84 Synapse / ~58 Elevar real; ~172 synthetic excluded; ~93% volume coverage |
| Real dual-run proof | Playwright `prove:dual-run:dev` succeeded (PDP→ATC→cart; Synapse + Elevar-mirror beacons) |
| GTM Preview sign-off | **Still human** — team must run Preview on gcw-dev |
| Elevar | Still ON (required until cutover) |

### Recent hardening already on `main`

- Admin gate, CORS allowlist, CSRF on cookie mutations, login rate limit, PII redaction, session HMAC  
- Webhooks **fail-closed** without HMAC secret (any mode)  
- Launch GO excludes `synthetic` / `demo_` / `sim_` beacons  
- Honest install probe; dual-run seed no longer fakes GO  
- Prove script + storefront verify tooling  

### Known debt / watch-outs

1. **`ADMIN_UI_PASSWORD` still in `wrangler.toml`** — move to `wrangler secret put ADMIN_UI_PASSWORD`, remove plaintext var, redeploy. Deploying without the secret **locks admin** (happened after PR #14).  
2. Launch may show `browser_status=alert` while still **GO** if volume match ≥ 80% (by design). Investigate `/compare/browser` if mismatch stays high.  
3. Channel health in `/ops/dashboard` can look “critical” when destination pulses are stale — destinations live in GTM.  
4. Theme HTML may link **prod** product handles that 404 on gcw-dev; use `products.json` (e.g. `3-white-long-sleeve-onesies-bodysuits`).  
5. GitHub **Deploy Worker** workflow soft-fails if `CLOUDFLARE_API_TOKEN` is missing/malformed; rely on Workers Builds or fix the token.  
6. Optional Node/Express control-plane in `src/server.ts` is **not** the live edge path — Worker is source of truth.

---

## 7. Day-1 investigation checklist

```bash
git clone git@github.com:Gerber-Childrenswear/GCW-Synapse.git
cd GCW-Synapse && git checkout main && npm ci

export ADMIN_UI_PASSWORD='Sugi2.0'
export GCW_DEV_STOREFRONT_PASSWORD='Move2Sugi'

# Live health
curl -sS https://gcw-synapse-super.gcwsynapse.workers.dev/health
curl -sS -A 'Mozilla/5.0' -H "X-Synapse-Token: $ADMIN_UI_PASSWORD" \
  https://gcw-synapse-super.gcwsynapse.workers.dev/ops/connection | jq
curl -sS -A 'Mozilla/5.0' -H "X-Synapse-Token: $ADMIN_UI_PASSWORD" \
  https://gcw-synapse-super.gcwsynapse.workers.dev/ops/shopify-install-status | jq
curl -sS -A 'Mozilla/5.0' -H "X-Synapse-Token: $ADMIN_UI_PASSWORD" \
  https://gcw-synapse-super.gcwsynapse.workers.dev/launch/readiness | jq '.report'

npm test
npm run lean:verify:dev
npm run verify:storefront:dev
npx playwright install chromium
npm run prove:dual-run:dev -- --rounds 5 --product 3-white-long-sleeve-onesies-bodysuits
npm run cutover:status
```

Admin UI: open Worker `/`, unlock with `Sugi2.0`.

---

## 8. Production-ready work remaining (ordered)

### A. Security / ops hygiene (do first)

1. `wrangler secret put ADMIN_UI_PASSWORD` (rotate off `Sugi2.0` if policy requires).  
2. Remove `ADMIN_UI_PASSWORD` from `wrangler.toml` `[vars]`.  
3. Confirm `SESSION_HMAC_SECRET`, `GTM_FORWARD_SHARED_SECRET`, webhook secret in CF.  
4. Fix GitHub `CLOUDFLARE_API_TOKEN` or document “Workers Builds only”.  
5. Rotate storefront password if it was shared broadly.

### B. gcw-dev sign-off (before touching prod)

1. Confirm theme embed **GCW Synapse** ON + **Elevar** ON (`docs/SHOPIFY_GCW_DEV_EMBED.md`).  
2. GTM Preview — prefer `GTM-WH3W368X`; note storefront may still load `GTM-TKW58K8` (`docs/GCW_DEV_GTM_WIRING.md`).  
3. Human browse funnel + `npm run prove:dual-run:dev` until `/launch/readiness` stays **GO** on real traffic.  
4. Validate destinations in Preview (Meta, GA4, etc.).  
5. Bloomreach / placeholder audit as needed (`docs/gtm/GTM-TKW58K8_synapse_placeholder_checklist.md`).

### C. Prod install + dual-run

1. `shopify app deploy` (theme + pixel extensions) as needed.  
2. Install on `gerberchildrenswear.myshopify.com` via `/install?shop=…`.  
3. `POST /ops/wire?shop=gerberchildrenswear.myshopify.com` (with admin token + allowed Origin).  
4. Enable theme embed + web pixel on **prod** theme; keep Elevar ON.  
5. Dual-run; watch `/compare/browser` and `/launch/readiness`.  
6. Channel sheet: `docs/ELEVAR_CHANNEL_CUTOVER_SHEET.md`.

### D. Elevar off (only after C is green)

Follow `docs/PROD_ELEVAR_CUTOVER_PLAYBOOK.md`:

1. Disable Elevar theme/app on prod.  
2. Re-check volumes 24–48h.  
3. Rollback = re-enable Elevar + set `RUNTIME_MODE=shadow_compare` if needed.

**Do not** wholesale rewrite prod `GTM-TKW58K8` outside the cutover window.

---

## 9. Commands cheat sheet

| Command | Purpose |
|---|---|
| `npm run cf:deploy` | Build + deploy Worker |
| `npm run lean:verify:dev` | Dev lean checks |
| `npm run lean:verify:prod` | Prod origin checks |
| `npm run prove:dual-run:dev` | Real browser dual-run (counts for GO) |
| `npm run simulate:dual-run:dev` | Synthetic smoke (**does not** count for GO) |
| `npm run verify:storefront:dev` | Unlock + embed HTML wiring |
| `npm run cutover:status` / `:full` | Cutover checklist |
| `npm test` | Unit/contract tests |

---

## 10. Architecture constraints (do not violate)

1. **Edge Worker is production** — not the optional Node Express server.  
2. **Destinations stay in GTM** — do not move Meta/TikTok API tokens into Worker.  
3. **Fail-closed webhooks** — never accept unsigned Shopify webhooks.  
4. **Launch GO = real traffic only** — demo-seed / simulate are synthetic.  
5. **Same Worker serves both shops** — CORS allowlist in `wrangler.toml` must include both storefronts.  
6. **Admin mutations** need allowlisted `Origin` (CSRF).  
7. Prefer **Workers Builds** for prod deploys; verify admin still works after every deploy that touches `ADMIN_UI_PASSWORD`.

---

## 11. Contacts / ownership

| Role | Person / team | Notes |
|---|---|---|
| GCW product / analytics owner | Nicholas Cassidy (`ncassidy@gerberchildrenswear.com`) | Passwords, Shopify/GTM admin, CF access |
| 3rd-party eng lead | **Tashiq** (`tashiq@golim.com`) | Full implementer — needs Cloudflare + GitHub + Shopify/GTM access (same footprint as gcw-presets) |
| Shopify Partners app | Client id `7d011b…e68d` | Ignore unrelated Dev Dashboard app `ad45451a…` for now |

### Access to grant Tashiq (GCW admin — do in dashboards)

Cloudflare and GitHub invites cannot be sent from the cloud agent token. GCW owner should:

**Cloudflare (account — covers Worker `gcw-synapse-super`)**  
1. https://dash.cloudflare.com → account `23988106841274c6bbb2e7c027233e13`  
2. **Manage account → Members → Invite**  
3. Email: `tashiq@golim.com`  
4. Role: **Administrator** (or Workers Admin + ability to manage secrets/KV/Builds)  
5. Send invite  

**GitHub**  
1. https://github.com/orgs/Gerber-Childrenswear/people  
2. Invite `tashiq@golim.com` (or their GitHub user) to org **or** add as collaborator on `GCW-Synapse` with **Write** (Admin preferred for Actions secrets)  

**Also grant (same as presets footprint)**  
- Shopify Partners / store staff on `gcw-dev` (+ prod when cutover)  
- GTM admin on accounts `4131312986` (`GTM-TKW58K8`) and `6348717123` (`GTM-N45F3JCC`)

---

## 12. Definition of done (production-ready)

- [ ] Admin password only in Cloudflare secret (rotated); no plaintext in git  
- [ ] gcw-dev GTM Preview signed off; `/launch/readiness` GO on real dual-run  
- [ ] Prod app installed + wired (pixel + webhooks + theme embed)  
- [ ] Prod dual-run green vs Elevar  
- [ ] Destination channels validated (sheet)  
- [ ] Elevar disabled on prod; 24–48h volume OK  
- [ ] Rollback path documented and tested once  
- [ ] Alerts optional but recommended (`SLACK_WEBHOOK_URL`)

---

## 13. Appendix — quick ops curls

```bash
TOKEN=Sugi2.0
BASE=https://gcw-synapse-super.gcwsynapse.workers.dev
H=(-H "X-Synapse-Token: $TOKEN" -A 'Mozilla/5.0')

curl -sS "${H[@]}" "$BASE/ops/dual-run" | jq
curl -sS "${H[@]}" "$BASE/compare/browser?limit=20" | jq '.parity'
curl -sS "${H[@]}" "$BASE/launch/readiness" | jq '.report.status,.report.checks'
curl -sS -X POST "${H[@]}" -H "Origin: $BASE" \
  "$BASE/ops/wire?shop=gcw-dev.myshopify.com" | jq
```

Primary narrative docs to read next: `docs/LEAN_GO_LIVE.md` → `docs/PROD_READY_HARDENING.md` → `docs/PROD_ELEVAR_CUTOVER_PLAYBOOK.md`.
