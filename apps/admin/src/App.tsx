import { useEffect, useMemo, useState } from "react";
import {
  getEventSchemas,
  getQaChecklist,
  getRuntimeStatus,
  getShadowComparisons,
  getShadowStats,
  getShopifyInstallStatus,
  getWebhookLog,
  probeEndpoint,
  runQaSmokeTests,
  type EndpointProbeResult,
  type EventSchema,
  type QaChecklistItem,
  type RuntimeStatus,
  type ShadowStats,
  type ShopifyInstallStatus,
  type SmokeRunResult
} from "./api";
import "./app.css";

type NavTab = "runtime" | "events" | "webhooks" | "shadow" | "qa" | "edge";

type LoadState = {
  loading: boolean;
  error: string | null;
};

const NAV_ITEMS: Array<{ id: NavTab; label: string; subtitle: string }> = [
  { id: "runtime", label: "Runtime Status", subtitle: "System health and adapter status" },
  { id: "events", label: "Event Schemas", subtitle: "Elevar replacement contracts" },
  { id: "webhooks", label: "Webhook Log", subtitle: "Ingestion and payload trace" },
  { id: "shadow", label: "Shadow Compare", subtitle: "Elevar vs Synapse parity" },
  { id: "qa", label: "QA Smoke Tests", subtitle: "Cutover validation checklist" },
  { id: "edge", label: "Edge Ops", subtitle: "Toggles and route health checks" }
];

type EdgeCheckGroup = "core" | "runtime" | "webhooks" | "guardrails";

type EdgeCheckDefinition = {
  id: string;
  label: string;
  path: string;
  method: "GET" | "POST" | "OPTIONS";
  expectedStatuses: number[];
  group: EdgeCheckGroup;
  body?: string;
  contentType?: string;
  extraHeaders?: Record<string, string>;
};

type EdgeToggleState = {
  includeCore: boolean;
  includeRuntime: boolean;
  includeWebhooks: boolean;
  includeGuardrails: boolean;
  includeWriteChecks: boolean;
  autoRefresh: boolean;
};

type EdgeCheckResult = {
  id: string;
  label: string;
  path: string;
  method: "GET" | "POST" | "OPTIONS";
  expectedStatuses: number[];
  status: number;
  durationMs: number;
  ok: boolean;
  bodyPreview: string;
};

const EDGE_CHECKS: EdgeCheckDefinition[] = [
  { id: "health", label: "Health", path: "/health", method: "GET", expectedStatuses: [200], group: "core" },
  { id: "status", label: "API Status", path: "/api/status", method: "GET", expectedStatuses: [200], group: "core" },
  { id: "schemas", label: "Event Schemas", path: "/api/events/schemas", method: "GET", expectedStatuses: [200], group: "core" },
  { id: "qa-checklist", label: "QA Checklist", path: "/api/qa/checklist", method: "GET", expectedStatuses: [200], group: "core" },
  { id: "runtime-summary", label: "Runtime Summary", path: "/runtime/summary", method: "GET", expectedStatuses: [200], group: "runtime" },
  { id: "runtime-recent", label: "Runtime Recent", path: "/runtime/recent?limit=5", method: "GET", expectedStatuses: [200], group: "runtime" },
  { id: "compare-parity", label: "Compare Parity", path: "/compare/parity", method: "GET", expectedStatuses: [200], group: "runtime" },
  { id: "compare-summary", label: "Compare Summary", path: "/compare/summary", method: "GET", expectedStatuses: [200], group: "runtime" },
  { id: "compare-channels", label: "Compare Channels", path: "/compare/channels", method: "GET", expectedStatuses: [200], group: "runtime" },
  { id: "launch-readiness", label: "Launch Readiness", path: "/launch/readiness", method: "GET", expectedStatuses: [200], group: "runtime" },
  {
    id: "event-options",
    label: "Event OPTIONS",
    path: "/event",
    method: "OPTIONS",
    expectedStatuses: [204],
    group: "webhooks",
    extraHeaders: {
      Origin: "https://www.gerberchildrenswear.com",
      "Access-Control-Request-Method": "POST"
    }
  },
  {
    id: "event-post",
    label: "Event POST",
    path: "/event",
    method: "POST",
    expectedStatuses: [200],
    group: "webhooks",
    body: JSON.stringify({ event: "dl_view_item", shop: "gerberchildrenswear.myshopify.com" }),
    contentType: "application/json"
  },
  {
    id: "webhook-post",
    label: "Webhook POST",
    path: "/webhooks/orders-create",
    method: "POST",
    expectedStatuses: [202],
    group: "webhooks",
    body: JSON.stringify({ order_id: "health-check", event: "purchase" }),
    contentType: "application/json"
  },
  { id: "ops-alerts", label: "Ops Alerts", path: "/ops/alerts", method: "GET", expectedStatuses: [200], group: "webhooks" },
  {
    id: "guard-auth",
    label: "Auth Guardrail",
    path: "/auth/shopify/install?shop=gerberchildrenswear.myshopify.com",
    method: "GET",
    expectedStatuses: [501],
    group: "guardrails"
  },
  {
    id: "guard-compat",
    label: "Compatibility Guardrail",
    path: "/compatibility/ga4-id",
    method: "GET",
    expectedStatuses: [501],
    group: "guardrails"
  }
];

function Badge({ tone, children }: { tone: "success" | "warning" | "danger" | "neutral"; children: string }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function PanelHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="panel-header">
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </header>
  );
}

function RuntimeSection({
  runtime,
  shopifyStatus
}: {
  runtime: RuntimeStatus | null;
  shopifyStatus: ShopifyInstallStatus | null;
}) {
  const adapterCount = runtime?.vendorAdapters.length ?? 0;

  return (
    <section className="panel">
      <PanelHeader title="Runtime Status" subtitle="Real-time system health and throughput metrics" />

      <div className="stats-grid">
        <article className="stat-card">
          <h3>Database</h3>
          <p>{runtime?.dbConnected ? "Connected" : "Disconnected"}</p>
        </article>
        <article className="stat-card">
          <h3>Uptime</h3>
          <p>{runtime ? `${Math.floor(runtime.uptime / 60)}m ${Math.floor(runtime.uptime % 60)}s` : "-"}</p>
        </article>
        <article className="stat-card">
          <h3>Webhooks Received</h3>
          <p>{runtime?.webhooksReceived ?? 0}</p>
        </article>
        <article className="stat-card">
          <h3>Events Generated</h3>
          <p>{runtime?.eventsGenerated ?? 0}</p>
        </article>
      </div>

      <article className="panel-block">
        <div className="block-header">
          <h3>Vendor Adapters</h3>
          <Badge tone="success">{`${adapterCount} Active`}</Badge>
        </div>
        <div className="chips">
          {(runtime?.vendorAdapters ?? []).map((adapter) => (
            <span key={adapter.name} className="chip">
              {adapter.name}
            </span>
          ))}
        </div>
      </article>

      <article className="panel-block">
        <div className="block-header">
          <h3>Shopify App Status</h3>
          <Badge tone={shopifyStatus?.installed_shops.length ? "success" : "warning"}>
            {shopifyStatus?.installed_shops.length ? "Installed" : "Pending"}
          </Badge>
        </div>
        <p className="muted">
          Installed shops: {shopifyStatus?.installed_shops.length ? shopifyStatus.installed_shops.join(", ") : "None"}
        </p>
        <p className="muted">Token store: {shopifyStatus?.store_path ?? "Not configured"}</p>
      </article>
    </section>
  );
}

function EventSchemasSection({ schemas }: { schemas: EventSchema[] }) {
  const [selected, setSelected] = useState<EventSchema | null>(null);

  useEffect(() => {
    if (!selected && schemas.length > 0) {
      setSelected(schemas[0]);
    }
  }, [schemas, selected]);

  return (
    <section className="panel">
      <PanelHeader title="Event Schema Browser" subtitle="Elevar-compatible events and field definitions" />

      <div className="schema-layout">
        <div className="schema-list">
          {schemas.map((schema) => (
            <button
              key={schema.eventName}
              className={`schema-row ${selected?.eventName === schema.eventName ? "selected" : ""}`}
              onClick={() => setSelected(schema)}
              type="button"
            >
              <strong>{schema.eventName}</strong>
              <span>{schema.description}</span>
            </button>
          ))}
        </div>

        <div className="schema-detail">
          {selected ? (
            <>
              <div className="block-header">
                <h3>{selected.eventName}</h3>
                <Badge tone="neutral">{`${selected.fields.length} Fields`}</Badge>
              </div>
              <p className="muted">{selected.description}</p>

              <div className="chips">
                {selected.vendors.map((vendor) => (
                  <span key={vendor} className="chip">
                    {vendor}
                  </span>
                ))}
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Path</th>
                      <th>Type</th>
                      <th>Req</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.fields.map((field) => (
                      <tr key={`${selected.eventName}-${field.path}`}>
                        <td>{field.name}</td>
                        <td>{field.path}</td>
                        <td>{field.type}</td>
                        <td>{field.required ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="muted">Select an event schema.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function WebhookLogSection({ webhooks }: { webhooks: unknown[] }) {
  return (
    <section className="panel">
      <PanelHeader title="Webhook Log" subtitle="Recent webhook ingestion records" />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Payload</th>
            </tr>
          </thead>
          <tbody>
            {webhooks.length === 0 ? (
              <tr>
                <td colSpan={2} className="muted center">
                  No webhook records yet.
                </td>
              </tr>
            ) : (
              webhooks.map((entry, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>
                    <pre>{JSON.stringify(entry, null, 2)}</pre>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ShadowSection({ stats, comparisons }: { stats: ShadowStats | null; comparisons: unknown[] }) {
  return (
    <section className="panel">
      <PanelHeader title="Shadow Compare" subtitle="Elevar vs Synapse payload parity" />

      <div className="stats-grid">
        <article className="stat-card">
          <h3>Total Comparisons</h3>
          <p>{stats?.totalComparisons ?? 0}</p>
        </article>
        <article className="stat-card">
          <h3>Avg Match Score</h3>
          <p>{stats ? `${stats.avgMatchScore.toFixed(2)}%` : "0.00%"}</p>
        </article>
      </div>

      <article className="panel-block">
        <div className="block-header">
          <h3>Recent Comparisons</h3>
          <Badge tone="neutral">{`${comparisons.length} records`}</Badge>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Payload</th>
              </tr>
            </thead>
            <tbody>
              {comparisons.length === 0 ? (
                <tr>
                  <td colSpan={2} className="muted center">
                    No shadow comparisons yet.
                  </td>
                </tr>
              ) : (
                comparisons.map((entry, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>
                      <pre>{JSON.stringify(entry, null, 2)}</pre>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

function QaSection({
  checklist,
  smokeResult,
  onRunTests,
  running
}: {
  checklist: QaChecklistItem[];
  smokeResult: SmokeRunResult | null;
  onRunTests: () => void;
  running: boolean;
}) {
  return (
    <section className="panel">
      <PanelHeader title="QA Smoke Tests" subtitle="Automated and manual verification checklist" />

      <div className="cta-row">
        <button type="button" className="primary" onClick={onRunTests} disabled={running}>
          {running ? "Running..." : "Run All Smoke Tests"}
        </button>
        {smokeResult ? (
          <p className="muted">
            Last run: {new Date(smokeResult.runAt).toLocaleString()} | Pass: {smokeResult.passed} | Fail: {smokeResult.failed} | Total: {smokeResult.total}
          </p>
        ) : null}
      </div>

      {smokeResult ? (
        <article className="panel-block">
          <h3>Smoke Test Results</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Test Case</th>
                  <th>Duration</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {smokeResult.results.map((result) => (
                  <tr key={result.name}>
                    <td>
                      <Badge tone={result.passed ? "success" : "danger"}>{result.passed ? "pass" : "fail"}</Badge>
                    </td>
                    <td>{result.name}</td>
                    <td>{`${result.durationMs}ms`}</td>
                    <td>{result.error ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ) : null}

      <article className="panel-block">
        <h3>Manual Checklist</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Check</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {checklist.map((item) => (
                <tr key={item.id}>
                  <td>{item.category}</td>
                  <td>{item.description}</td>
                  <td>
                    <Badge
                      tone={item.status === "pass" ? "success" : item.status === "fail" ? "danger" : "warning"}
                    >
                      {item.status}
                    </Badge>
                  </td>
                  <td>{item.notes ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

function EdgeOpsSection({
  toggles,
  onToggle,
  onRunChecks,
  running,
  results,
  lastRunAt
}: {
  toggles: EdgeToggleState;
  onToggle: (next: Partial<EdgeToggleState>) => void;
  onRunChecks: () => void;
  running: boolean;
  results: EdgeCheckResult[];
  lastRunAt: string | null;
}) {
  const passing = results.filter((result) => result.ok).length;
  const failing = results.length - passing;

  return (
    <section className="panel">
      <PanelHeader title="Edge Ops" subtitle="Toggle route groups and run Cloudflare health checks" />

      <div className="toggle-grid">
        <label className="toggle-item">
          <input type="checkbox" checked={toggles.includeCore} onChange={(event) => onToggle({ includeCore: event.target.checked })} />
          <span>Core APIs</span>
        </label>
        <label className="toggle-item">
          <input type="checkbox" checked={toggles.includeRuntime} onChange={(event) => onToggle({ includeRuntime: event.target.checked })} />
          <span>Runtime + Compare</span>
        </label>
        <label className="toggle-item">
          <input type="checkbox" checked={toggles.includeWebhooks} onChange={(event) => onToggle({ includeWebhooks: event.target.checked })} />
          <span>Event + Webhook + Ops</span>
        </label>
        <label className="toggle-item">
          <input
            type="checkbox"
            checked={toggles.includeGuardrails}
            onChange={(event) => onToggle({ includeGuardrails: event.target.checked })}
          />
          <span>501 Guardrail Routes</span>
        </label>
        <label className="toggle-item">
          <input
            type="checkbox"
            checked={toggles.includeWriteChecks}
            onChange={(event) => onToggle({ includeWriteChecks: event.target.checked })}
          />
          <span>Include Write Checks</span>
        </label>
        <label className="toggle-item">
          <input type="checkbox" checked={toggles.autoRefresh} onChange={(event) => onToggle({ autoRefresh: event.target.checked })} />
          <span>Auto Refresh (30s)</span>
        </label>
      </div>

      <div className="cta-row">
        <button type="button" className="primary" onClick={onRunChecks} disabled={running}>
          {running ? "Running Checks..." : "Run Health Checks"}
        </button>
        <Badge tone={failing > 0 ? "warning" : "success"}>{`${passing}/${results.length || 0} passing`}</Badge>
        <span className="muted">{lastRunAt ? `Last run: ${new Date(lastRunAt).toLocaleString()}` : "No checks run yet"}</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Check</th>
              <th>Method</th>
              <th>Path</th>
              <th>HTTP</th>
              <th>Latency</th>
              <th>Preview</th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted center">
                  Run checks to populate route health.
                </td>
              </tr>
            ) : (
              results.map((result) => (
                <tr key={result.id}>
                  <td>
                    <Badge tone={result.ok ? "success" : "danger"}>{result.ok ? "pass" : "fail"}</Badge>
                  </td>
                  <td>{result.label}</td>
                  <td>{result.method}</td>
                  <td>{result.path}</td>
                  <td>
                    {result.status} / {result.expectedStatuses.join("|")}
                  </td>
                  <td>{`${result.durationMs}ms`}</td>
                  <td>
                    <pre>{result.bodyPreview}</pre>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>("runtime");
  const [state, setState] = useState<LoadState>({ loading: true, error: null });

  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null);
  const [schemas, setSchemas] = useState<EventSchema[]>([]);
  const [webhooks, setWebhooks] = useState<unknown[]>([]);
  const [shadowStats, setShadowStats] = useState<ShadowStats | null>(null);
  const [comparisons, setComparisons] = useState<unknown[]>([]);
  const [checklist, setChecklist] = useState<QaChecklistItem[]>([]);
  const [smokeResult, setSmokeResult] = useState<SmokeRunResult | null>(null);
  const [shopifyStatus, setShopifyStatus] = useState<ShopifyInstallStatus | null>(null);
  const [runningSmoke, setRunningSmoke] = useState(false);
  const [edgeToggles, setEdgeToggles] = useState<EdgeToggleState>({
    includeCore: true,
    includeRuntime: true,
    includeWebhooks: true,
    includeGuardrails: true,
    includeWriteChecks: true,
    autoRefresh: false
  });
  const [edgeResults, setEdgeResults] = useState<EdgeCheckResult[]>([]);
  const [runningEdgeChecks, setRunningEdgeChecks] = useState(false);
  const [lastEdgeRunAt, setLastEdgeRunAt] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getRuntimeStatus(),
      getEventSchemas(),
      getWebhookLog(50),
      getShadowStats(),
      getShadowComparisons(50),
      getQaChecklist(),
      getShopifyInstallStatus()
    ])
      .then(([runtimeData, schemaData, webhookData, shadowData, comparisonData, checklistData, shopifyData]) => {
        setRuntime(runtimeData);
        setSchemas(schemaData);
        setWebhooks(webhookData);
        setShadowStats(shadowData);
        setComparisons(comparisonData);
        setChecklist(checklistData);
        setShopifyStatus(shopifyData);
        setState({ loading: false, error: null });
      })
      .catch((error: unknown) => {
        setState({
          loading: false,
          error: error instanceof Error ? error.message : "Failed to load Synapse control panel"
        });
      });
  }, []);

  const activeItem = useMemo(() => NAV_ITEMS.find((item) => item.id === activeTab) ?? NAV_ITEMS[0], [activeTab]);

  const selectedEdgeChecks = useMemo(() => {
    const includeGroup = (group: EdgeCheckGroup): boolean => {
      if (group === "core") {
        return edgeToggles.includeCore;
      }
      if (group === "runtime") {
        return edgeToggles.includeRuntime;
      }
      if (group === "webhooks") {
        return edgeToggles.includeWebhooks;
      }
      return edgeToggles.includeGuardrails;
    };

    return EDGE_CHECKS.filter((check) => {
      if (!includeGroup(check.group)) {
        return false;
      }
      if (!edgeToggles.includeWriteChecks && (check.method === "POST" || check.method === "OPTIONS")) {
        return false;
      }
      return true;
    });
  }, [edgeToggles]);

  useEffect(() => {
    if (!edgeToggles.autoRefresh) {
      return;
    }

    const timer = setInterval(() => {
      if (!runningEdgeChecks) {
        void runEdgeHealthChecks();
      }
    }, 30000);

    return () => {
      clearInterval(timer);
    };
  }, [edgeToggles.autoRefresh, runningEdgeChecks, selectedEdgeChecks]);

  async function runEdgeHealthChecks(): Promise<void> {
    setRunningEdgeChecks(true);

    try {
      const checks = selectedEdgeChecks;
      const probes = await Promise.all(
        checks.map(async (check): Promise<EdgeCheckResult> => {
          const response: EndpointProbeResult = await probeEndpoint(check.path, {
            method: check.method,
            body: check.body,
            contentType: check.contentType,
            extraHeaders: check.extraHeaders
          });

          const bodyPreview = response.bodyText.length > 180 ? `${response.bodyText.slice(0, 180)}...` : response.bodyText;
          const ok = check.expectedStatuses.includes(response.status);

          return {
            id: check.id,
            label: check.label,
            path: check.path,
            method: check.method,
            expectedStatuses: check.expectedStatuses,
            status: response.status,
            durationMs: response.durationMs,
            ok,
            bodyPreview
          };
        })
      );

      setEdgeResults(probes);
      setLastEdgeRunAt(new Date().toISOString());
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Edge health checks failed"
      }));
    } finally {
      setRunningEdgeChecks(false);
    }
  }

  function handleRunSmokeTests(): void {
    setRunningSmoke(true);
    runQaSmokeTests()
      .then((result) => {
        setSmokeResult(result);
      })
      .catch((error: unknown) => {
        setState((prev) => ({
          loading: prev.loading,
          error: error instanceof Error ? error.message : "Smoke test execution failed"
        }));
      })
      .finally(() => {
        setRunningSmoke(false);
      });
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <h1>SYNAPSE</h1>
          <p>v0.2.0-merged</p>
        </div>

        <nav>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === activeTab ? "nav-item active" : "nav-item"}
              onClick={() => setActiveTab(item.id)}
            >
              <span>{item.label}</span>
              <small>{item.subtitle}</small>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">Connected to GCW Production</div>
      </aside>

      <main className="content">
        <header className="page-header">
          <h1>GCW Synapse - Elevar Migration Control Panel</h1>
          <p>{activeItem.subtitle}</p>
        </header>

        {state.error ? <div className="error-banner">{state.error}</div> : null}
        {state.loading ? <div className="loading">Loading control panel...</div> : null}

        {!state.loading ? (
          <>
            {activeTab === "runtime" ? <RuntimeSection runtime={runtime} shopifyStatus={shopifyStatus} /> : null}
            {activeTab === "events" ? <EventSchemasSection schemas={schemas} /> : null}
            {activeTab === "webhooks" ? <WebhookLogSection webhooks={webhooks} /> : null}
            {activeTab === "shadow" ? <ShadowSection stats={shadowStats} comparisons={comparisons} /> : null}
            {activeTab === "qa" ? (
              <QaSection
                checklist={checklist}
                smokeResult={smokeResult}
                onRunTests={handleRunSmokeTests}
                running={runningSmoke}
              />
            ) : null}
            {activeTab === "edge" ? (
              <EdgeOpsSection
                toggles={edgeToggles}
                onToggle={(next) => setEdgeToggles((prev) => ({ ...prev, ...next }))}
                onRunChecks={() => {
                  void runEdgeHealthChecks();
                }}
                running={runningEdgeChecks}
                results={edgeResults}
                lastRunAt={lastEdgeRunAt}
              />
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}
