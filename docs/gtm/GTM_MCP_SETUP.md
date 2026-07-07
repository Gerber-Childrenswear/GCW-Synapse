# GTM MCP setup for Cursor

## Already connected in Cursor Settings?

If **Settings → Tools & MCP** already shows a GTM server authenticated with the
admin Google account, you are set for **local IDE / desktop Agent** work. You do
**not** need to connect again on your machine.

This cloud agent run does **not** inherit your personal MCP config. Check the tool
list at the top of chat: if there is no `user-gtm` / GTM server, the agent cannot
edit containers until Team MCP is wired (below).

## One-time connect (if not already in Settings)

1. Repo ships `.cursor/mcp.json` with server name **`user-gtm`** →
   `https://mcp.gtmeditor.com/authorize`
2. Cursor **Settings → Tools & MCP** → connect `user-gtm` with your Google account.
3. Verify: *"List workspaces in GTM-TKW58K8"* and *"List tags in GTM-N45F3JCC workspace 40"*.

Full container IDs and edit policies: [`gtm-mcp-server/README.md`](../../gtm-mcp-server/README.md).

## Cloud Agents (required for agents like this one)

Personal Settings MCP **does not** flow to Cloud Agents. Add the same GTM server as
**Team MCP**:

1. **Cursor Dashboard → Integrations & MCP → Team MCP Servers**
2. Add URL: `https://mcp.gtmeditor.com/authorize` (same as your local GTM MCP)
3. Optionally **Add to Team Marketplace** so teammates get it from Customize
4. Start a **new** cloud agent run on this repo after saving

Until Team MCP is configured, cloud agents only have Render/Cloudflare/etc. — not GTM.

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
