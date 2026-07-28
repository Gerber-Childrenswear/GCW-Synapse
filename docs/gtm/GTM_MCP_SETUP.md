# GTM MCP setup

## Already connected?

If your editor’s MCP client already shows `user-gtm` authenticated with the admin Google account, you are set for local work. You do **not** need to connect again on that machine.

Shared/remote runners often do **not** inherit personal MCP config. If `user-gtm` is missing from the tool list there, register the same server in team/shared integrations (below).

## One-time connect (local)

1. Use the example client config: `gtm-mcp-server/mcp.client.example.json`  
   Server name **`user-gtm`** → `https://mcp.gtmeditor.com/authorize`
2. Connect / authorize with the Google account that has GTM admin on both GCW accounts.
3. Verify: *"List workspaces in GTM-TKW58K8"* and *"List tags in GTM-N45F3JCC workspace 40"*.

Full container IDs and edit policies: [`gtm-mcp-server/README.md`](../../gtm-mcp-server/README.md).

## Shared runners / team MCP

Personal MCP settings usually do not flow to shared runners. Add the same GTM server in team integrations:

1. Add MCP URL: `https://mcp.gtmeditor.com/authorize`
2. Optionally publish it to your team marketplace so teammates can install it
3. Start a fresh session after saving

Until that is configured, shared runners only have whatever other MCP servers you registered — not GTM.

## What you can do after connect

- Import / update Synapse runtime companion tags in **GTM-TKW58K8**
- Audit Bloomreach placeholder variables before Elevar retirement
- Adjust Commerce Shield forwarder tag in **GTM-N45F3JCC** workspace 40
- Create versions and publish (with MCP confirmation prompts)

## Without MCP (fallback)

Manual import paths remain unchanged:

- Web: `GTM-TKW58K8_synapse_runtime_companion_import.json`
- Preview: `GTM-TKW58K8_synapse_side_by_side_preview_bundle.json`
- sGTM: apply deltas from Commerce Shield repo when available
