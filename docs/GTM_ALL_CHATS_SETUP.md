# GTM MCP — team setup

Configure the hosted GTM MCP (`user-gtm`) so editors and automation can list, edit, and publish GCW containers.

MCP URL: `https://mcp.gtmeditor.com/authorize`

Authorize with a Google account that has GTM **Administrator** on:

- Account `4131312986` (web `GTM-TKW58K8`)
- Account `6348717123` (server `GTM-N45F3JCC`)

---

## 1. Local editor MCP

Add the server to your editor’s MCP client config (example: `gtm-mcp-server/mcp.client.example.json`):

```json
{
  "mcpServers": {
    "user-gtm": {
      "url": "https://mcp.gtmeditor.com/authorize"
    }
  }
}
```

Connect / OAuth when prompted, then verify tools can list containers.

---

## 2. Shared / remote runners

If local MCP settings do not apply to shared CI or remote runners, register the same URL in your team’s shared MCP / integrations settings so those environments also see `user-gtm`.

---

## 3. This repo

Container IDs and edit policies: `gtm-mcp-server/containers.json`  
Example client config: `gtm-mcp-server/mcp.client.example.json`

---

## Verify

Ask any MCP-connected session:

> List my GTM accounts and containers.

Expect `GTM-TKW58K8` and `GTM-N45F3JCC`.

Smoke checklist: `scripts/gtmMcpTestChecklist.md`

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| MCP works locally, not in shared runners | Register the same MCP URL in team/shared integrations |
| OAuth expired | Reconnect the Google account on the MCP client |
| Container not listed | Grant GTM admin to the OAuth’d Google account |
| Tools missing | Enable `user-gtm` in the client’s tool list |

---

## Read-only alternative (no OAuth UI)

Self-host [brynj-digital/gtm-mcp-server](https://github.com/brynj-digital/gtm-mcp-server) with a service account (`tagmanager.readonly`). Use for audits only — Synapse cutover needs write access via hosted `user-gtm`.
