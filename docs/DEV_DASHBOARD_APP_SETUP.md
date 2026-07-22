# GCW Synapse — Dev Dashboard app (gcw-dev)

Use the **Shopify Dev Dashboard custom app** so you can install on `gcw-dev` yourself — no store-owner “Manage and install apps” ping.

**Client ID:** `ad45451a4c49376bdeae4dae0f3ac26a`

## 1. Configure the app in Dev Dashboard

Open the app → **Versions / Settings** (wording varies) and set:

| Field | Value |
|---|---|
| App URL | `https://gcw-synapse-super.gcwsynapse.workers.dev` |
| Allowed redirection URL(s) | `https://gcw-synapse-super.gcwsynapse.workers.dev/auth/shopify/callback` |
| Scopes | `read_products,read_orders,read_checkouts,read_customers,read_customer_events,write_pixels,read_themes` |

## 2. Put the Client secret on the Worker

Dev Dashboard → **Credentials** → **Client secret** → copy it.

Then either paste it into chat so the agent can set it, or run locally:

```bash
printf '%s' 'PASTE_SECRET_HERE' | npx wrangler secret put SHOPIFY_API_SECRET --config wrangler.toml
printf '%s' 'PASTE_SECRET_HERE' | npx wrangler secret put SHOPIFY_WEBHOOK_SECRET --config wrangler.toml
```

`SHOPIFY_API_KEY` is already set to `ad45451a4c49376bdeae4dae0f3ac26a`.

## 3. Install on gcw-dev

Use the **Install** link Shopify shows for this custom app (the `install_custom_app?client_id=ad45451a…` URL). That is the no-director path.

Fallback OAuth (needs secret configured first):

https://gcw-synapse-super.gcwsynapse.workers.dev/install?shop=gcw-dev.myshopify.com

## 4. Enable embed + verify

1. Theme → **App embeds** → **GCW Synapse** ON → Save  
2. Browse a product (storefront password unlocked)  
3. Check https://gcw-synapse-super.gcwsynapse.workers.dev/compare/browser

## 5. Deploy extensions (theme embed + web pixel)

From this repo (Shopify CLI logged into the org that owns the Dev Dashboard app):

```bash
npx shopify app config link   # pick the ad45451a… app
npx shopify app deploy
```

Until extensions are released to **this** app, App embeds may be empty even after install.

## Note on the other client ID

`7d011b70562512bd84b85bd3f9a6e68d` was the older Partners app. Ignore it for gcw-dev going forward.
