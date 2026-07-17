# GCW-Dev Synapse Setup

Dev validation shop: `gcw-dev.myshopify.com`  
Synapse Worker: `https://gcw-synapse.ncassidy.workers.dev`  
Web GTM (testing): `GTM-WH3W368X` — **GCW Dev** (account `6274762117`, container `209456750`)  
Export snapshot: [`gtm/GTM-WH3W368X_workspace12.json`](gtm/GTM-WH3W368X_workspace12.json)

Do **not** use prod web `GTM-TKW58K8` for this work. sGTM for eventual forward remains `GTM-N45F3JCC` when you leave shadow mode.

## Already done

- [x] Synapse live on Cloudflare (`RUNTIME_MODE=shadow_compare`)
- [x] Shopify app `GCW-Synapse` (`client_id` `7d011b70562512bd84b85bd3f9a6e68d`) installed on gcw-dev
- [x] App URL + OAuth callback pointed at Worker
- [x] App webhooks: `orders/create`, `orders/paid` → Worker paths
- [x] Compatibility UI at `/`
- [x] Pixel/measurement IDs from GCW Dev GTM loaded into Worker vars:
  - GA4 `G-YMJ9F7HY6P`
  - Facebook `823006016363458`
  - Pinterest `2612527712746`

## Your checklist (gcw-dev)

### 1. Confirm webhooks firing

1. Place a small test order on **gcw-dev** (or mark a draft paid).
2. Partners → **GCW-Synapse** → webhook deliveries → expect `200` / `shadow_captured_no_forward`.
3. Or replay:

```powershell
$env:REPLAY_BASE_URL="https://gcw-synapse.ncassidy.workers.dev"
$env:SHOPIFY_WEBHOOK_SECRET="YOUR_APP_CLIENT_SECRET"
$env:REPLAY_SHOP_DOMAIN="gcw-dev.myshopify.com"
npm run replay:webhook:create
```

### 2. Confirm GTM-WH3W368X is on the storefront

In **gcw-dev** theme / Customer Events / GTM loader, the web container ID must be **`GTM-WH3W368X`** (not prod `GTM-TKW58K8`).

Preview a thank-you / purchase and confirm Elevar folders still fire in GTM Preview for `GTM-WH3W368X`.

### 3. Enable Synapse browser layer (full Elevar replace)

1. `npm run build:browser` then `shopify app deploy`
2. Theme settings → App embeds → enable **Synapse Data Layer**
3. Activate Synapse web pixel (`beaconUrl` → `https://gcw-synapse.ncassidy.workers.dev/browser/beacon`, `shopDomain=gcw-dev.myshopify.com`)
4. Re-authorize expanded scopes if prompted
5. Dual-run with Elevar; watch browser parity on `/app/summary` and activity table
6. Cutover steps: [`GCW_DEV_GTM_CUTOVER.md`](GCW_DEV_GTM_CUTOVER.md)

### 4. Shadow compare loop

1. Synapse captures Shopify order webhooks automatically (shadow mode = no GTM forward yet).
2. Send Elevar purchase baselines to Synapse:

```http
POST https://gcw-synapse.ncassidy.workers.dev/compare/elevar
Header: X-Synapse-Token: <INGRESS_SHARED_TOKEN>
```

3. Optional: mirror Elevar browser events to `POST /compare/browser/elevar`
4. Watch:
   - App UI → Launch readiness + Real-time activity
   - `GET /app/summary`
   - `GET /compare/parity` and `GET /compare/browser` (with ingress token)

Gate stays **HOLD** until purchase paired events ≥ 100, browser paired ≥ 50, and mismatch rates ≤ 5%.

### 5. When ready to forward (later)

1. Set real `GTM_SERVER_URL` (sGTM collect URL for the server container you want to hit).
2. Flip `RUNTIME_MODE=forward` in `wrangler.jsonc` vars and redeploy.
3. Re-check launch readiness with `phase=cutover`.

## IDs quick reference

| System | Value |
|---|---|
| Shopify app client ID | `7d011b70562512bd84b85bd3f9a6e68d` |
| Synapse URL | `https://gcw-synapse.ncassidy.workers.dev` |
| Dev web GTM | `GTM-WH3W368X` |
| Dev GA4 | `G-YMJ9F7HY6P` |
| Dev Meta Pixel | `823006016363458` |
| Dev Pinterest | `2612527712746` |
| Prod web GTM (do not touch for this) | `GTM-TKW58K8` |
| Prod sGTM | `GTM-N45F3JCC` |
