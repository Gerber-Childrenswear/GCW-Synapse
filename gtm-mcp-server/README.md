# GTM MCP — edit all GCW containers

This folder documents the **three GTM surfaces** GCW works against and how to wire
the hosted `user-gtm` MCP server so you can list, edit, and publish tags.

## Containers (see `containers.json`)

| # | Public ID | Role | Account | Container |
|---|-----------|------|---------|-----------|
| 1 | **GTM-TKW58K8** | Web / pixel — Synapse bridge, Elevar placeholders, Bloomreach | `4131312986` | `9938197` |
| 2 | **GTM-N45F3JCC** | Server GTM — Reddit CAPI, GA4 server, Commerce Shield forwarder | `6348717123` | `248775717` |
| 3 | **GTM-TKW58K8** (workspace) | gcw-dev validation — same container, **Synapse Preview** workspace | `4131312986` | `9938197` |

Entry 3 is not a separate GTM account; it is the dev/preview workspace inside the web
container. All three are reachable once `user-gtm` is connected.

## Quick setup (recommended — hosted MCP, full read/write)

### Local editor

If your MCP client already lists GTM authenticated with the admin Google account,
skip OAuth — edit containers directly.

Example client config: `gtm-mcp-server/mcp.client.example.json`.

### Shared / remote runners

Personal MCP settings often do not apply to shared runners. Register Team/shared MCP:

1. URL: `https://mcp.gtmeditor.com/authorize`
2. Re-run or start a new session after saving

### First-time local connect

1. Point your editor MCP client at `https://mcp.gtmeditor.com/authorize` (see `mcp.client.example.json`).
2. Confirm the server name is **`user-gtm`**.
3. Connect / authorize with the Google account that has GTM **Administrator** on
   accounts `4131312986` and `6348717123`.
4. Verify: *"List my GTM containers"* — expect `GTM-TKW58K8` and `GTM-N45F3JCC`.

## Edit policies (do not skip)

- **GTM-TKW58K8:** Synapse imports live in `docs/gtm/`. Incremental cutover only —
  do not delete Elevar GTM entities until Bloomreach placeholder gates pass.
- **GTM-N45F3JCC:** Commerce Shield / sGTM automation only. Live CS workspace is **40**.
- **Synapse Preview workspace:** Import preview bundles here first; publish to prod web
  only after gcw-dev GTM Preview is green (`docs/LEAN_GO_LIVE.md`).

## Optional: service account (local self-hosted)

For headless/CI or when OAuth is unavailable, use a service account with GTM admin on
both accounts:

1. Create a service account in Google Cloud; enable **Tag Manager API**.
2. In GTM → Admin → User Management, add the SA email as **Account Administrator** on
   accounts `4131312986` and `6348717123`.
3. Download JSON key; set `GTM_SA_KEY_PATH` in `gtm-mcp-server/.env` (copy from
   `.env.example`).
4. Self-host [paolobietolini/gtm-mcp-server](https://github.com/paolobietolini/gtm-mcp-server)
   and point your MCP client at that instance with `SERVICE_ACCOUNT_API_KEY`.

**Never commit** `credentials.json`, service-account keys, or `gtm-config.json`.

## Related repo commands

```bash
npm run gtm:bundle:elevar          # rebuild Elevar-active bundle from workspace export
npm run gtm:bundle:synapse-preview # side-by-side preview import
npm run gtm:report:placeholders    # Bloomreach / Elevar placeholder checklist
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `user-gtm` not in tool list | Restart the editor; confirm MCP client config; shared runners: add team MCP |
| OAuth fails | Use Google account with GTM admin on both accounts |
| Container missing | Grant account access in tagmanager.google.com |
| Publish blocked | Hosted MCP asks confirmation; approve publish in the session |
