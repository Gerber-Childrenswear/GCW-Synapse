# Synapse Side-by-Side Preview Import

## Goal

Import cloned active tags that are rewired to gcw_synapse_event so validation can happen in controlled batches before full cutover.

## Artifacts

- GTM-TKW58K8_synapse_side_by_side_preview_bundle.json
- GTM-TKW58K8_synapse_side_by_side_preview_report.md

## Generate

From repository root:

- npm run gtm:bundle:elevar
- npm run gtm:validate:elevar
- npm run gtm:bundle:synapse-preview
- npm run gtm:validate:synapse-preview
- npm run gtm:smoke:synapse-preview

## Import Steps

1. Open GTM container TKW58K8 and create a workspace named Synapse Preview.
2. Import GTM-TKW58K8_synapse_side_by_side_preview_bundle.json.
3. Use merge mode and keep existing entities unchanged when prompted.
4. Confirm folder GCW Synapse Side-by-Side Preview appears.
5. Confirm all imported tags with prefix Synapse Preview - are paused.

## Controlled Validation

1. Unpause only 1 to 3 preview tags in a single event family.
2. Trigger storefront actions and confirm preview tag firing in GTM Preview.
3. Compare payload parity between original and Synapse Preview tags.
4. Re-pause validated preview tags or keep only approved preview tags enabled.
5. Repeat by event family until all required tags pass.

## Rollback

1. Re-pause all Synapse Preview tags.
2. If needed, remove only folder GCW Synapse Side-by-Side Preview entities.
3. Keep original Elevar active tags untouched throughout preview stage.

## Notes

- Preview tags are generated with paused=true by default.
- Preview triggers are rewritten to CUSTOM_EVENT with gcw_synapse_event and event_name mapping when available.
- Some variable references intentionally resolve from the existing container, so preview smoke test allows external variable refs.
