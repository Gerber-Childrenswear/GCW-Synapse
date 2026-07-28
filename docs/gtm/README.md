# GTM Hardening Artifacts

## GTM MCP (edit containers)

- [GTM_MCP_SETUP.md](GTM_MCP_SETUP.md) — connect `user-gtm` MCP for live edits
- [gtm-mcp-server/README.md](../../gtm-mcp-server/README.md) — container registry (web, sGTM, dev workspace)

## Files

- GTM-TKW58K8_synapse_runtime_companion_import.json
  - Runtime bridge import for gcw_synapse_event.

- GTM-TKW58K8_elevar_active_rebuild_bundle.json
  - Auto-generated rebuild bundle containing active Elevar tags, triggers, and variables from workspace 197 based on gcw_synapse_dependency_matrix.csv.

- GTM-TKW58K8_elevar_active_rebuild_report.md
  - Generation report with counts and any missing entities.

- GTM-TKW58K8_synapse_side_by_side_preview_bundle.json
  - Side-by-side preview import that clones active tags and rewires triggers to gcw_synapse_event.

- GTM-TKW58K8_synapse_side_by_side_preview_report.md
  - Preview generation report and clone counts.

- GTM-TKW58K8_synapse_placeholder_checklist.md
  - Event-by-event placeholder dependency checklist generated from the active rebuild bundle.

- SYNAPSE_PLACEHOLDER_PREVIEW_PLAYBOOK.md
  - Step-by-step GTM Preview process to validate Elevar placeholders against Synapse payloads.

- synapse_preview_console_harness.js
  - Console harness to emit `gcw_synapse_event` samples for placeholder inspection.

## Commands

From repository root:

- npm run gtm:bundle:elevar
  - Generates rebuild JSON and report.

- npm run gtm:validate:elevar
  - Verifies all active matrix tag and variable names are present in rebuild bundle.

- npm run gtm:smoke:elevar
  - Checks bundle integrity: trigger references and variable macro references resolve.

- npm run gtm:bundle:synapse-preview
  - Generates side-by-side preview bundle with cloned tags paused by default.

- npm run gtm:validate:synapse-preview
  - Verifies preview clone integrity: prefixing, paused tags, mapped preview triggers, and required Synapse variable.

- npm run gtm:smoke:synapse-preview
  - Checks trigger references for preview bundle; allows external variable references that resolve in the target container.

- npm run gtm:report:placeholders
  - Generates placeholder dependency checklist grouped by event family and tag.

## Defaults

Generation and validation scripts default to:

- GTM source: D:/Users/ncassidy/Downloads/GTM-TKW58K8_workspace197.json
- Matrix source: D:/Users/ncassidy/Downloads/gcw_synapse_dependency_matrix.csv

Override with flags:

- --gtm <path>
- --matrix <path>
- --out <path>
- --report <path>
- --bundle <path>

Synapse preview generator flags:

- --source-bundle <path>
- --out <path>
- --report <path>
