# Triple Whale Routing Decision (Updated for full Synapse ownership)

Date: 2026-07-17  
Supersedes: 2026-05-14 “No Sonar” note where ownership conflicts.

## Constraint

Gerber does not have Triple Whale Sonar.

## Outcome

**GCW-Synapse owns the Elevar replacement surface:**

- Storefront / checkout `dl_*` data layer (theme embed + web pixel)
- Session/UTM enrichment attached to purchases
- Shopify webhook purchase relay → Server GTM
- Compatibility variables, shadow parity, launch GO/HOLD, alerts

Destinations (Meta, GA4, Ads, Pinterest, Reddit CAPI, etc.) remain in **GTM web + sGTM**.

Use Triple Whale only for standard app-managed client-side pixel coverage that does **not** conflict with Synapse data layer events or existing GTM tags.

## Ownership Matrix

- **GCW-Synapse**
  - Browser data layer (`dl_*`) via theme app embed + web pixel
  - Browser beacon + dual-run browser parity
  - Shopify webhook ingestion / HMAC / idempotency / normalization
  - Compatibility HTTP variables
  - Session marketing attach on purchase payloads
  - Ops UI (readiness, activity, alerts)

- **GTM Web container**
  - Dev: `GTM-WH3W368X`
  - Prod: `GTM-TKW58K8` (do not modify for gcw-dev work)
  - Tags/triggers that consume Synapse `dl_*` events

- **GTM Server container (`GTM-N45F3JCC`)**
  - Server-side vendor tags (Reddit CAPI, etc.)
  - Event routing / bot forwarder integrations

- **Triple Whale (optional, non-custom only)**
  - Basic pixel toggles that do not duplicate Synapse/GTM events

## Practical Rule

If a feature is required to **uninstall Elevar**, it belongs in Synapse + GTM.

If a feature is a generic pixel toggle with no custom mapping needs, Triple Whale may host it—never at the expense of Synapse event ownership.
