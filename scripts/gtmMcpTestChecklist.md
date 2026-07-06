# GTM MCP smoke test (paste into new Cloud Agent with user-gtm connected)

Run these in order after Team MCP is wired and a **new** cloud agent starts.

## 0. Confirm MCP is live

Ask the agent:

> List my GTM accounts and containers. Confirm you see GTM-TKW58K8 and GTM-N45F3JCC.

**Pass:** Both public IDs returned with account IDs `4131312986` and `6348717123`.

## 1. Web container — read

> In GTM-TKW58K8 (account 4131312986, container 9938197), list workspaces and tags. Report whether a tag named "GCW Synapse" or trigger on `gcw_synapse_event` exists.

**Pass:** Workspace list returns; Synapse runtime companion tag/trigger found OR clearly missing (then import).

## 2. Web container — Synapse import check

> Read `docs/gtm/GTM-TKW58K8_synapse_runtime_companion_import.json` and compare entity names to what exists in the default workspace. List any missing tags, triggers, or variables.

**Pass:** Diff is empty or only expected deltas documented.

## 3. Server container — read

> In GTM-N45F3JCC (account 6348717123, container 248775717), list workspaces and open workspace 40. List tags with "Commerce Shield" or "Edge Bot" in the name.

**Pass:** Workspace 40 accessible; forwarder tag identifiable.

## 4. gcw-dev path (no publish)

> Do NOT publish. Confirm lean Worker is healthy: run `npm run lean:verify:dev` and summarize. Note what must happen on gcw-dev Shopify theme before GTM Preview will see events.

**Pass:** lean:verify:dev green; theme embed called out as manual step.

## 5. Optional write test (dev workspace only)

> In GTM-TKW58K8, create or update a workspace named "Synapse Preview" if missing. Do not publish to live.

**Pass:** Workspace created/confirmed without version publish.

---

Container registry: `gtm-mcp-server/containers.json`
