# Synapse Placeholder Preview Playbook

Use this to understand exactly what legacy Elevar placeholders are doing before swapping dependencies to Triple Whale.

## Goal

- Keep existing Elevar-dependent tags/triggers alive.
- Feed those tags with Synapse-compatible runtime events in GTM Preview.
- Observe variable resolution and payload parity event-by-event.

## Prerequisites

1. Import runtime bridge bundle:
   - `docs/gtm/GTM-TKW58K8_synapse_runtime_companion_import.json`
2. Import side-by-side preview bundle:
   - `docs/gtm/GTM-TKW58K8_synapse_side_by_side_preview_bundle.json`
3. Keep all imported `Synapse Preview - ...` tags paused by default.

## Preview Workflow

1. Open GTM Preview for the target storefront.
2. Unpause only 1 to 3 `Synapse Preview - ...` tags in the same event family.
3. In browser DevTools Console, paste the harness from:
   - `docs/gtm/synapse_preview_console_harness.js`
4. Trigger one event:

```js
GCWSynapsePreview.push("add_to_cart");
```

5. Or run the default suite:

```js
GCWSynapsePreview.runDefaultSuite();
```

6. In GTM Preview, validate all of the following:
   - Event `gcw_synapse_event` appears.
   - Runtime bridge emits `dl_<event_name>`.
   - Target `Synapse Preview - ...` tags fire only on expected events.
   - Legacy variables (for example `dlv - event_id`, `dlv - Global - Currency Code`, `GA4 ID`) resolve to expected values.

## What This Confirms

- Which Elevar placeholder variables are still required by each tag.
- Whether Synapse payload shape satisfies those placeholders.
- Which variables must be rebuilt first before channel-by-channel replacement.

## Safe Rollback

1. Re-pause all `Synapse Preview - ...` tags.
2. Stop using harness events.
3. Leave original Elevar tags unchanged.

## Notes

- The harness only pushes to `window.dataLayer` for GTM Preview inspection.
- It does not mutate production tag logic.
- For server-side parity checks, continue using `/compare/*` endpoints in shadow mode.
