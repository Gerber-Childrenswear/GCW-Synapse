# Triple Whale — out of scope

Date: 2026-07-23  
Status: **Do not use** for GCW Synapse / Elevar replacement.

## Decision

Triple Whale (attribution product and its own pixel monitor) is **not** part of the Synapse stack.

- Synapse owns storefront/checkout `dl_*`, purchase webhooks, dual-run parity, and launch GO/HOLD.
- GTM web + sGTM (`GTM-N45F3JCC`) own destination tags (Meta, GA4, Ads, etc.).
- Platforms dashboard / channel health no longer track Triple Whale.

If a Triple Whale app embed appears on a theme, disable it to avoid double-firing with Synapse/GTM.

Historical notes below this line are obsolete for routing decisions.
