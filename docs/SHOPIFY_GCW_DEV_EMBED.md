# Enable GCW Synapse on gcw-dev

**Active app (already installed):** Partners client `7d011b70562512bd84b85bd3f9a6e68d`  
Worker secrets restored to match. Ignore Dev Dashboard app `ad45451a…` for now.

## Open app

https://admin.shopify.com/store/gcw-dev/apps/7d011b70562512bd84b85bd3f9a6e68d

## App embeds

1. **Online Store → Themes → Customize → App embeds**
2. **GCW Synapse** ON → Save  
3. Script URL: `https://gcw-synapse-super.gcwsynapse.workers.dev/gcw-synapse.js?v=1.3.0`  
4. Beacon: `https://gcw-synapse-super.gcwsynapse.workers.dev/browser/beacon`  
5. Beacon sample rate: **100%** (dual-run)  
6. Keep **Elevar** app embed ON for side-by-side (`docs/GCW_DEV_DUAL_RUN.md`)

Deep link:

```
https://gcw-dev.myshopify.com/admin/themes/current/editor?context=apps&activateAppId=7d011b70562512bd84b85bd3f9a6e68d/gcw-synapse-app-block
```

## Verify

Password-unlocked storefront → product page → console:

```js
window.Synapse?.version
window.dataLayer?.filter(e => String(e.event||'').startsWith('dl_')).slice(-5)
```

https://gcw-synapse-super.gcwsynapse.workers.dev/compare/browser

## Ops wire (pixel + webhooks)

```bash
curl -X POST 'https://gcw-synapse-super.gcwsynapse.workers.dev/ops/wire?shop=gcw-dev.myshopify.com'
```

Uses Shopify client-credentials to ensure the app web pixel + order/refund webhooks point at the Worker.