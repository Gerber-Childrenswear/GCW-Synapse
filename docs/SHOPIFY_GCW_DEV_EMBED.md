# Enable GCW Synapse on gcw-dev

**Preferred path (no director ping):** Dev Dashboard custom app  
→ see [`docs/DEV_DASHBOARD_APP_SETUP.md`](./DEV_DASHBOARD_APP_SETUP.md)

**Client ID:** `ad45451a4c49376bdeae4dae0f3ac26a`

---

## Install

1. Configure App URL + redirect + scopes in Dev Dashboard (doc above).
2. Set Worker `SHOPIFY_API_SECRET` to the Dev Dashboard **Client secret**.
3. Install via the Dev Dashboard **Install** link for this custom app.
4. Fallback: https://gcw-synapse-super.gcwsynapse.workers.dev/install?shop=gcw-dev.myshopify.com

---

## Where the toggle lives (not the Apps list)

1. **gcw-dev admin** → **Online Store** → **Themes**
2. On the **live** theme, click **Customize**
3. Left sidebar → **App embeds** (puzzle piece)
4. **GCW Synapse** → ON → Save
5. Beacon URL: `https://gcw-synapse-super.gcwsynapse.workers.dev/browser/beacon`
6. Script URL: `https://gcw-synapse-super.gcwsynapse.workers.dev/gcw-synapse.js?v=1.1.0`

Deep link (after extensions are deployed to this app):

```
https://gcw-dev.myshopify.com/admin/themes/current/editor?context=apps&activateAppId=ad45451a4c49376bdeae4dae0f3ac26a/gcw-synapse-app-block
```

If the embed is missing: `npx shopify app deploy` for the Dev Dashboard app (extensions must be released to **this** client ID).

---

## Verify

Storefront password unlocked → product page → console:

```js
window.Synapse?.version
window.dataLayer?.filter(e => String(e.event||'').startsWith('dl_')).slice(-5)
```

Worker: https://gcw-synapse-super.gcwsynapse.workers.dev/compare/browser
