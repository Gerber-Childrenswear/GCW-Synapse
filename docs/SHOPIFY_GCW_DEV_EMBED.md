# Enable GCW Synapse on gcw-dev

**Symptom:** App is installed on `gcw-dev.myshopify.com` but there is no **GCW Synapse** toggle under App embeds.

**Most common cause:** OAuth app install ≠ theme extension deployed. The storefront pixel lives in a **theme app extension** (`extensions/theme-app-extension/`). Until that extension is released to the store via `shopify app deploy`, App embeds stays empty.

---

## Where the toggle lives (not the Apps list)

1. **gcw-dev admin** → **Online Store** → **Themes**
2. On the **live** theme (or the theme you test with), click **Customize**
3. In the theme editor left sidebar, open **App embeds** (puzzle-piece icon — **not** “Apps” blocks in the page body)
4. Find **GCW Synapse** and turn it **ON**
5. Set **Browser beacon URL** to:
   `https://gcw-synapse-super.gcwsynapse.workers.dev/browser/beacon`
6. Leave **Legacy /event endpoint** as:
   `https://gcw-synapse-super.gcwsynapse.workers.dev/event` (optional transitional)
7. Leave **Ingress token** blank
8. Click **Save** (top right)

If **GCW Synapse** is missing from the App embeds list, the theme extension was not deployed to this shop — see **Deploy extension** below.

---

## Deep link (fastest path when extension is deployed)

Replace `YOUR_CLIENT_ID` with the app **Client ID** from Partners → App setup → Client credentials (`7d011b70562512bd84b85bd3f9a6e68d` for GCW Synapse):

```
https://gcw-dev.myshopify.com/admin/themes/current/editor?context=apps&activateAppId=7d011b70562512bd84b85bd3f9a6e68d/gcw-synapse-app-block
```

That opens the theme editor with the embed pre-selected; click **Save**.

Block handle = liquid filename without `.liquid`: `gcw-synapse-app-block`.

---

## Deploy extension (if embed is missing)

From repo root, with Shopify CLI logged into the Partners org:

```bash
shopify app config link    # pick existing GCW Synapse app
shopify app deploy         # releases theme extension to installed shops
```

Repo files:

- `shopify.app.toml` — app shell (set `client_id` or use `config link`)
- `extensions/theme-app-extension/shopify.extension.toml`
- `extensions/theme-app-extension/blocks/gcw-synapse-app-block.liquid` (`"target": "body"` = app embed)

After deploy, repeat **App embeds** steps above.

---

## Verify it is working

### Admin (theme editor)

With embed ON, open **Preview** in theme editor → browser DevTools → Console:

```js
window.SynapseConfig
window.dataLayer?.filter(e => String(e.event||'').startsWith('dl_')).slice(-5)
```

`SynapseConfig.beaconUrl` should be `https://gcw-synapse-super.gcwsynapse.workers.dev/browser/beacon`, and you should see `dl_user_data` / `dl_view_item` (etc.) in `dataLayer`.

### Storefront

**Note:** `gcw-dev.myshopify.com` is currently **password-protected**. GTM Preview and anonymous curls hit the password page, not the theme. Either:

- Use theme editor **Preview**, or
- Temporarily disable the storefront password for dev testing

### Worker (no theme required)

```bash
npm run lean:verify:dev
```

Confirms the Worker accepts gcw-dev-origin events; does **not** prove the theme embed is on.

---

## Conflicts on gcw-dev

If **Elevar** or **Triple Whale** app embeds are ON on the same theme, disable one while validating Synapse to avoid double-firing (`docs/gtm/THEME_TRACKING_AUDIT.md`).

---

## Customer-events pixel (checkout — separate from theme embed)

Checkout events use `extensions/customer-events-pixel/` (web pixel extension). That is configured under **Settings → Customer events → Custom pixels**, not App embeds. Theme embed covers `user_data`, `view_item`, `add_to_cart`, etc. on the storefront.
