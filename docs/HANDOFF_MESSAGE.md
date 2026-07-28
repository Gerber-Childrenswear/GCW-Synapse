# Message to send — GCW-Synapse handoff

Copy everything below the line into Slack/email.

---

**Subject: GCW-Synapse handoff — Elevar replacement (access, passwords, what to finish)**

Hi team —

We’re handing you **GCW-Synapse**, our Elevar replacement for Gerber Childrenswear. Your job is to fully investigate the system and take it to **production-ready**: keep dual-run healthy on gcw-dev, install/wire on prod, prove parity, then turn Elevar off without losing destination tracking (GTM keeps Meta/GA4/etc.).

### Where everything is

| What | Location |
|---|---|
| **Full handoff brief (start here)** | https://github.com/Gerber-Childrenswear/GCW-Synapse/blob/main/docs/THIRD_PARTY_HANDOFF.md |
| **Repo** | https://github.com/Gerber-Childrenswear/GCW-Synapse (`main`) |
| **Live Worker** | https://gcw-synapse-super.gcwsynapse.workers.dev |
| **Admin UI** | https://gcw-synapse-super.gcwsynapse.workers.dev/ (password gate) |
| **Lean go-live doc** | https://github.com/Gerber-Childrenswear/GCW-Synapse/blob/main/docs/LEAN_GO_LIVE.md |
| **Prod Elevar cutover playbook** | https://github.com/Gerber-Childrenswear/GCW-Synapse/blob/main/docs/PROD_ELEVAR_CUTOVER_PLAYBOOK.md |
| **Security / secret hygiene** | https://github.com/Gerber-Childrenswear/GCW-Synapse/blob/main/docs/PROD_READY_HARDENING.md |
| **gcw-dev embed how-to** | https://github.com/Gerber-Childrenswear/GCW-Synapse/blob/main/docs/SHOPIFY_GCW_DEV_EMBED.md |

### Passwords (confidential — rotate after you have CF access)

| Use | Password |
|---|---|
| Worker admin / ops API (`ADMIN_UI_PASSWORD`) | `Sugi2.0` |
| gcw-dev Shopify storefront password page | `Move2Sugi` |

Ops API auth example:

```bash
curl -sS -A 'Mozilla/5.0' -H 'X-Synapse-Token: Sugi2.0' \
  'https://gcw-synapse-super.gcwsynapse.workers.dev/ops/connection' | jq
```

### Shops & app

| Env | Shop | Synapse app |
|---|---|---|
| Dev | `gcw-dev.myshopify.com` | **Installed** |
| Prod | `gerberchildrenswear.myshopify.com` / `www.gerberchildrenswear.com` | **Not installed yet** |

- Shopify Partners app client id: `7d011b70562512bd84b85bd3f9a6e68d`
- gcw-dev admin app: https://admin.shopify.com/store/gcw-dev/apps/7d011b70562512bd84b85bd3f9a6e68d
- Prod install link (when ready): https://gcw-synapse-super.gcwsynapse.workers.dev/install?shop=gerberchildrenswear.myshopify.com

### GTM (do not freestyle-edit prod web)

| Container | Role |
|---|---|
| `GTM-TKW58K8` | Prod web — **do not edit until cutover window** |
| `GTM-N45F3JCC` (workspace 40) | Server GTM / sGTM |
| `GTM-WH3W368X` | Preferred for gcw-dev Preview |

Destination API secrets stay in GTM — not in the Worker.

### Live status (as of handoff)

- Worker healthy; `/ops/connection` **green**
- Dual-run ON; `/launch/readiness` **GO** on **real** storefront traffic (demo/sim traffic does not count)
- Elevar still ON (required until cutover)
- Prod app install + GTM Preview sign-off + Elevar-off still **your** work

### First commands

```bash
git clone git@github.com:Gerber-Childrenswear/GCW-Synapse.git
cd GCW-Synapse && git checkout main && npm ci

export ADMIN_UI_PASSWORD='Sugi2.0'
export GCW_DEV_STOREFRONT_PASSWORD='Move2Sugi'

npm test
npm run lean:verify:dev
npm run verify:storefront:dev
npx playwright install chromium
npm run prove:dual-run:dev -- --rounds 5 --product 3-white-long-sleeve-onesies-bodysuits
```

Deploy for real via Cloudflare **Workers Builds** on `main` (or `npm run cf:deploy` with a valid CF token). Root `wrangler.toml` → Worker `gcw-synapse-super`.

### Please do first (security)

1. Get Cloudflare access and run: `wrangler secret put ADMIN_UI_PASSWORD`
2. Remove plaintext `ADMIN_UI_PASSWORD` from `wrangler.toml` and redeploy  
   (deploying without the secret locks admin — we already hit this once)
3. Rotate admin + storefront passwords once you’re in

### Definition of done

See §12 in the handoff brief. Short version: secret hygiene → gcw-dev Preview sign-off → prod install/wire/dual-run → channel validation → Elevar off → 24–48h volume check.

GCW contact for access/questions: **Nicholas Cassidy** — ncassidy@gerberchildrenswear.com  
Implementer: **Tashiq** — tashiq@golim.com (invite to Cloudflare account + GitHub org/repo — same access footprint as gcw-presets)

Thanks — the full brief has repo map, secret inventory, curls, and ordered cutover steps.

— GCW
