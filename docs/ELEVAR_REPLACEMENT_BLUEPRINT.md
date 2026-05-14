# Elevar Replacement Blueprint (GCW-Synapse)

## Goal
- Replace Elevar-owned plumbing with first-party GTM + GCW-Synapse equivalents without breaking dependent tags.
- Keep event names stable during transition and swap internals in phases.

## Source Artifacts
- Full entity map: Downloads/GCW-Synapse_Elevar_Dependency_Map_v2.json
- Human-readable map: Downloads/GCW-Synapse_Elevar_Dependency_Map_v2.md
- Full ties matrix (entity-to-entity): Downloads/GCW-Synapse_Elevar_Ties_v2.csv
- Top coupling vars: Downloads/GCW-Synapse_Elevar_Top_Coupling_Variables_v1.csv

## Channel Footprint (Elevar Tag Folders)
- Elevar - GA4 Custom Events: 22 tags
- Elevar 2.0 - GA4: 16 tags
- Elevar 2.0 - FB: 13 tags
- Elevar 2.0 - Google Ads: 11 tags
- Elevar / Pinterest: 9 tags
- Elevar - Monitoring: 2 tags
- Elevar - Video Tagging: 1 tags

## Highest-Risk Coupling Variables (Top 12)
| Variable | Folder | External refs |
|---|---|---:|
| GA4 ID | Elevar 2.0 - GA4 | 39 |
| dlv - Global - Currency Code | Elevar 2.0 - Global | 30 |
| dlv - event_id | Elevar 2.0 - Global | 27 |
| dlv - Customer ID | Elevar 2.0 - Cart and Checkout | 15 |
| dlv - Customer Email | Elevar 2.0 - Global | 13 |
| dlv - Thank You Page - ecommerce.purchase.products | Elevar 2.0 - Cart and Checkout | 13 |
| Facebook - Pixel ID | Elevar 2.0 - FB | 12 |
| Facebook - product identifier | Elevar 2.0 - Product Identifier | 11 |
| GA4 - product identifier | Elevar 2.0 - Product Identifier | 9 |
| dlv - Thank You Page - Order ID | Elevar 2.0 - Cart and Checkout | 9 |
| Pinterest ID | Elevar / Pinterest | 9 |
| dlv - Cart Total | Elevar 2.0 - Cart and Checkout | 9 |

## Replacement Spec (Core Compatibility Layer)
| Elevar variable pattern | Replacement source in new setup | Notes |
|---|---|---|
| GA4 ID | Constant variable managed in GTM env map | Keep same variable name initially for compatibility |
| Facebook - Pixel ID / Pinterest ID | Constant variables per channel | Move IDs into config constants, not template internals |
| dlv - Global - Currency Code | dataLayer.ecommerce.currency or Shopify currencyCode fallback | Required by GA4, Ads, Reddit, Pinterest tags |
| dlv - event_id | Generate deterministic event_id (hash of topic+order/item+timestamp bucket) | Must remain stable for dedupe where expected |
| dlv - Customer Email / Phone / ID | user_data fields from Shopify customer payload | Apply normalization + hashing only where platform requires |
| dlv - Thank You Page - Order ID | ecommerce.transaction_id | Preserve formatting for ad platform matching |
| dlv - Cart Total / purchase value | ecommerce.value | Keep numeric coercion and currency consistency |
| product identifier variables | item_id priority: sku > variant_id > product_id | Must be shared across FB/GA4/Pinterest/Reddit mappings |
| ecommerce.purchase.products / checkout.products / impressions | ecommerce.items arrays by event context | Canonical item schema shared by all tags |
| url - Search - Search Term | URL query param q/search | Preserve current query key behavior to avoid reporting drift |

## Trigger Compatibility Strategy
- Maintain existing event names first (view_item, add_to_cart, begin_checkout, dl_purchase, purchase, etc.).
- Repoint trigger conditions to first-party dataLayer emission from GCW-Synapse/browser code rather than Elevar template side effects.
- Keep exception triggers in place (e.g., thank-you exclusions) until parity checks pass.

## Phased Cutover
1. Phase A: Compatibility layer only
   - Create replacement variables with legacy names and same output shape.
   - Keep existing tags/triggers firing unchanged.
2. Phase B: Channel-by-channel tag swap
   - Swap GA4 tags first, then Google Ads, then FB/Pinterest, then custom events.
   - Validate event counts and value parity before each channel publish.
3. Phase C: Trigger ownership swap
   - Replace Elevar-trigger dependencies with first-party triggers one folder at a time.
4. Phase D: Decommission
   - Remove Elevar monitoring templates/tags and orphaned variables once no ties remain.

## Verification Checklist
- Event volume parity by event_name (pre vs post, 7-day overlap)
- Revenue parity for purchase/add_to_cart
- Product ID parity across GA4 + ad platforms
- Consent behavior parity (Pandectes + GTM consent mode)
- No tag references to Elevar entities in ties matrix after decommission

## Immediate Next Actions
1. Build replacement variables for the Top 12 coupling list first.
2. Export a delta ties report after each phase to confirm dependency reduction.
3. Only remove Elevar entities when ties CSV shows zero inbound references.
