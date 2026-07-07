# GTM MCP for all Cursor chats

GTM access is **per surface** in Cursor. To use GTM in **every** chat (desktop Agent, Cloud Agents, all repos), configure all three layers below once.

---

## 1. Global (all desktop chats, every repo)

On your Mac/PC, create or edit **`~/.cursor/mcp.json`**:

```json
{
  "mcpServers": {
    "user-gtm": {
      "url": "https://mcp.gtmeditor.com/authorize"
    }
  }
}
```

Then **Settings → Tools & MCP → user-gtm → Connect** with the Google account that has GTM Administrator on:

- Account `4131312986` (web `GTM-TKW58K8`)
- Account `6348717123` (server `GTM-N45F3JCC`)

Restart Cursor. Every local Agent chat can use GTM tools.

---

## 2. Team MCP (all Cloud Agent chats)

Personal Settings **do not** apply to Cloud Agents.

1. Open **[cursor.com/dashboard](https://cursor.com/dashboard)** → **Integrations & MCP** → **Team MCP Servers**
2. **Add server**
   - Name: `user-gtm` (or `GTM`)
   - URL: `https://mcp.gtmeditor.com/authorize`
3. **Add to Team Marketplace** (optional but recommended) so teammates install from Customize
4. Start a **new** Cloud Agent after saving

Every cloud agent run on your team can then use GTM (after OAuth if prompted).

---

## 3. Project (this repo — GCW-Synapse)

`.cursor/mcp.json` at repo root registers the same server for anyone who clones the project:

```json
{
  "mcpServers": {
    "user-gtm": {
      "url": "https://mcp.gtmeditor.com/authorize"
    }
  }
}
```

Container IDs and edit policies: `gtm-mcp-server/containers.json`

---

## Verify GTM is connected

In any chat, check the **tools** list at the top for `user-gtm` / GTM tools, then ask:

> List my GTM accounts and containers.

Expect `GTM-TKW58K8` and `GTM-N45F3JCC`.

Smoke checklist: `scripts/gtmMcpTestChecklist.md`

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| GTM works locally, not in Cloud Agent | Add Team MCP (step 2); start **new** agent |
| OAuth expired | Reconnect in Settings or Cloud Integrations |
| Container not listed | Grant GTM admin to the Google account you OAuth'd with |
| Tools disabled in chat | Customize → enable `user-gtm` tools |

---

## Read-only alternative (no OAuth UI)

Self-host [brynj-digital/gtm-mcp-server](https://github.com/brynj-digital/gtm-mcp-server) with a service account (`tagmanager.readonly`). Use for audits only — Synapse cutover needs write access via hosted `user-gtm`.
