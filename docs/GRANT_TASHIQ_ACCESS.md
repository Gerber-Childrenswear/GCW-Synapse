# Grant Tashiq full access (do now)

**Email:** `tashiq@golim.com`  
**Goal:** Same access footprint as gcw-presets — Cloudflare + GitHub (+ Shopify/GTM as needed).

Cloud agent cannot send these invites (no CF API token; GitHub integration lacks member-write).

## 1. Cloudflare (required for Worker)

1. Open https://dash.cloudflare.com  
2. Select account containing Worker **`gcw-synapse-super`**  
   - Account id: `23988106841274c6bbb2e7c027233e13`  
3. **Manage account → Members → Invite**  
4. Email: **`tashiq@golim.com`**  
5. Role: **Administrator** (simplest “everything”)  
   - Or minimum: Workers Admin + secrets/KV/Builds  
6. Send → Tashiq accepts email invite  

Confirm they can open:  
https://dash.cloudflare.com → Workers → **gcw-synapse-super**  
and run `wrangler secret list` / deploy.

## 2. GitHub (required for repo)

1. https://github.com/orgs/Gerber-Childrenswear/people → **Invite member**  
   - Email: `tashiq@golim.com`  
   - Or add their GitHub username once known  
2. Ensure access to **`Gerber-Childrenswear/GCW-Synapse`** (Write or Admin)  
3. Optionally add to **`GCW-Discount-Presets`** if not already  

## 3. Shopify + GTM (for cutover work)

- Shopify Partners app `7d011b70562512bd84b85bd3f9a6e68d` + staff on `gcw-dev` (prod later)  
- GTM: accounts `4131312986` and `6348717123`

## After invites

Share handoff: https://github.com/Gerber-Childrenswear/GCW-Synapse/blob/main/docs/THIRD_PARTY_HANDOFF.md  
Passwords still: admin `Sugi2.0` · storefront `Move2Sugi` (rotate after they’re in).
