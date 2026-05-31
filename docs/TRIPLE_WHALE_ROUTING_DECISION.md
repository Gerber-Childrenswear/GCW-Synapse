# Triple Whale Routing Decision (No Sonar)

Date: 2026-05-14

## Constraint

Gerber does not have Triple Whale Sonar.

## Outcome

Use Triple Whale only for standard app-managed client-side pixel coverage where it does not conflict with existing tracking.

Keep all server-side event handling and Elevar-compatibility logic in GCW-Synapse + GTM Server container (GTM-N45F3JCC).

## Ownership Matrix

- Triple Whale (preferred where possible):
  - Basic client-side pixel deployment/management supported by the app.
  - Non-custom, non-Elevar-specific UI configuration tasks.

- GTM Web container (GTM-TKW58K8 workspace 174):
  - Custom data layer wiring.
  - Any Elevar variable compatibility dependencies still used by tags.
  - Tag/trigger sequencing and conditional logic that is custom to GCW.

- GTM Server container (GTM-N45F3JCC workspace 19):
  - Reddit CAPI and other server-side vendor tags.
  - Event routing, event name normalization, server-side enrichment.
  - Worker/bot forwarding and custom HTTP tags.

- GCW-Synapse service:
  - Shopify webhook ingestion and HMAC verification.
  - Idempotency, retries, payload normalization.
  - Compatibility variables (GA4 ID, Currency Code, event_id, upcoming customer/product fields).

## Practical Rule

If a feature requires deterministic IDs, custom payload mapping, dedupe, or server-to-server guarantees, keep it in GTM Server + GCW-Synapse.

If a feature is a standard browser pixel toggle that Triple Whale can manage without reducing signal quality, it may live in Triple Whale.

## Next Implementation Direction

Continue Phase A compatibility implementation in GCW-Synapse:

1. Customer ID
2. Customer Email
3. purchase products array

These are required for Elevar parity and remain independent of Triple Whale Sonar availability.
