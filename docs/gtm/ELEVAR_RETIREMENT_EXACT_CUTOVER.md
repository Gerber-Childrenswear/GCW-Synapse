# Elevar Retirement Exact Cutover (Bloomreach-Safe)

## Objective

Remove Elevar-owned plumbing without breaking Bloomreach GTM behavior.

Triple Whale is not a drop-in replacement for all Elevar data plumbing. The safe target state is:

- Triple Whale handles its own channel attribution needs.
- GCW-Synapse provides the compatibility data layer contract previously sourced from Elevar.
- Bloomreach tags continue to receive the same variable shapes and event timing.

## Non-Negotiable Rule

Do not remove Elevar entities until all Bloomreach-dependent placeholders are sourced from Synapse-compatible variables and validated in preview + server logs.

## Bloomreach-Critical Event Contract

### add_to_cart

Required placeholders (minimum):

- BloomReach - Add To Cart tag still fires on expected trigger.
- Product identity fields remain stable (SKU/variant/product fallback logic).
- Value and quantity fields are numeric and non-empty.

Primary compatibility dependencies:

- dlv - Add to Cart - Add Array
- dlv - Add to Cart - Quantity
- dlv - Add to Cart - Price
- dlv - Global - Currency Code
- dlv - Customer ID
- dlv - event_id

### view_item

Required placeholders (minimum):

- BloomReach - Product Page (Event) tag still fires.
- Product ID/name/price context still resolves identically.
- User and segmentation variables still resolve (or intentionally blank) with no type drift.

Primary compatibility dependencies:

- dlv - Product View - Details Array
- dlv - Product View - Product ID
- dlv - Product View - Name
- dlv - Product View - Price
- dlv - Global - Currency Code
- dlv - Global - Visitor Type
- dlv - Customer ID
- dlv - event_id

### purchase

Required placeholders (minimum):

- BloomReach - Purchase (Conversion Page) tag still fires on thank-you flow.
- Line-item array shape remains stable.
- Order ID, order revenue, and customer fields remain consistent.

Primary compatibility dependencies:

- js - Thank You Page - BloomReach line items
- dlv - Thank You Page - Order ID
- dlv - Thank You Page - Order Revenue
- dlv - Thank You Page - Customer Email
- dlv - Thank You Page - Customer Phone Number
- dlv - Global - Currency Code

## Exact Cutover Sequence

1. Keep side-by-side mode active.
2. Repoint variables, not tags first:
   - Keep legacy variable names where possible.
   - Swap variable internals to Synapse-compatible sources.
3. Validate per event family in GTM preview:
   - add_to_cart
   - view_item
   - purchase
4. Validate server-side parity:
   - purchase and refund forwarding success
   - dead-letter count at or below launch budget
5. Only then disable Elevar app embed/template ownership.
6. Publish and monitor with launch guard enabled.

## Hard Launch Gates (Fail If Any Are False)

- Zero unresolved placeholders for Bloomreach-critical events in preview checks.
- No double-firing from overlapping app embeds (Elevar + Triple Whale).
- Launch guard reports allowed startup when strict mode is on.
- Dead-letter backlog is within allowed launch threshold.

## Operational Commands

Run before every production publish:

1. `npm run gtm:check-placeholders`
2. `npm run typecheck`
3. `npm test`
4. `npm run launch:readiness`

## Decision Rule

If Bloomreach-critical contract is not fully green, keep Elevar plumbing in place for that scope and continue phased replacement. Do not perform all-at-once removal.
