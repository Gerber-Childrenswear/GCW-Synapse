# Enable GCW Synapse on gcw-dev

**Active app (already installed):** Partners client `7d011b70562512bd84b85bd3f9a6e68d`  
Worker secrets restored to match. Ignore Dev Dashboard app `ad45451a…` for now.

## Open app

https://admin.shopify.com/store/gcw-dev/apps/7d011b70562512bd84b85bd3f9a6e68d

## App embeds

1. **Online Store → Themes → Customize → App embeds**
2. **GCW Synapse** ON → Save  
3. Script URL: `https://gcw-synapse-super.gcwsynapse.workers.dev/gcw-synapse.js?v=1.1.0`  
4. Beacon: `https://gcw-synapse-super.gcwsynapse.workers.dev/browser/beacon`

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
