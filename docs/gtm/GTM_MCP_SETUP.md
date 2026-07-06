# GTM MCP setup for Cursor

Use this when agents need to **edit** GTM (not just import JSON from `docs/gtm/`).

## One-time connect

1. Repo ships `.cursor/mcp.json` with server name **`user-gtm`** →
   `https://mcp.gtmeditor.com/authorize`
2. Cursor **Settings → Tools & MCP** → connect `user-gtm` with your Google account.
3. Verify: *"List workspaces in GTM-TKW58K8"* and *"List tags in GTM-N45F3JCC workspace 40"*.

Full container IDs and edit policies: [`gtm-mcp-server/README.md`](../../gtm-mcp-server/README.md).

## What agents can do after connect

- Import / update Synapse runtime companion tags in **GTM-TKW58K8**
- Audit Bloomreach placeholder variables before Elevar retirement
- Adjust Commerce Shield forwarder tag in **GTM-N45F3JCC** workspace 40
- Create versions and publish (with MCP confirmation prompts)

## Cloud Agents

If the cloud run does not show `user-gtm`, add the same MCP URL in **Cursor Dashboard →
Integrations & MCP** for your team, then start a new agent on this repo.

## Without MCP (fallback)

Manual import paths remain unchanged:

- Web: `GTM-TKW58K8_synapse_runtime_companion_import.json`
- Preview: `GTM-TKW58K8_synapse_side_by_side_preview_bundle.json`
- sGTM: apply deltas from Commerce Shield repo when available
