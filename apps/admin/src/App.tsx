import { useEffect, useMemo, useState } from "react";
import {
  getEventSchemas,
  getQaChecklist,
  getRuntimeStatus,
  getShadowComparisons,
  getShadowStats,
  getShopifyInstallStatus,
  getWebhookLog,
  runQaSmokeTests,
  type EventSchema,
  type QaChecklistItem,
  type RuntimeStatus,
  type ShadowStats,
  type ShopifyInstallStatus,
  type SmokeRunResult
} from "./api";
import "./app.css";

type NavTab = "runtime" | "events" | "webhooks" | "shadow" | "qa";

type LoadState = {
  loading: boolean;
  error: string | null;
};

const NAV_ITEMS: Array<{ id: NavTab; label: string; subtitle: string }> = [
  { id: "runtime", label: "Runtime Status", subtitle: "System health and adapter status" },
  { id: "events", label: "Event Schemas", subtitle: "Elevar replacement contracts" },
  { id: "webhooks", label: "Webhook Log", subtitle: "Ingestion and payload trace" },
  { id: "shadow", label: "Shadow Compare", subtitle: "Elevar vs Synapse parity" },
  { id: "qa", label: "QA Smoke Tests", subtitle: "Cutover validation checklist" }
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
          </>
        ) : null}
      </main>
    </div>
  );
}
