import { useEffect, useMemo, useState } from "react";
import {
  getAdvisorAlerts,
  ApiRequestError,
  getCompareUiModel,
  getEventSchemas,
  getPlatformMatrix,
  getQaChecklist,
  getRuntimeStatus,
  getShadowComparisons,
  getShadowStats,
  getShopifyInstallStatus,
  getWebhookLog,
  probeEndpoint,
  runQaSmokeTests,
  sendAdvisorMessage,
  type AdvisorAlertItem,
  type AdvisorChatMessage,
  type EndpointProbeResult,
  type EventSchema,
  type PlatformMatrix,
  type QaChecklistItem,
  type RuntimeStatus,
  type ShadowStats,
  type ShopifyInstallStatus,
  type SmokeRunResult,
  type UiModel
} from "./api";
import { PlatformsDashboard } from "./PlatformsDashboard";
import { getShopifyEmbedContext, type ShopifyEmbedContext } from "./shopifyEmbed";

type NavTab = "platforms" | "runtime" | "advisor" | "events" | "webhooks" | "shadow" | "qa" | "edge";

type LoadState = {
  loading: boolean;
  error: string | null;
};

const NAV_ITEMS: Array<{ id: NavTab; label: string; subtitle: string }> = [
  { id: "platforms", label: "Platforms", subtitle: "Dedupe, causes, browser vs server" },
  { id: "runtime", label: "Runtime Status", subtitle: "System health and adapter status" },
  { id: "advisor", label: "Synapse Advisor", subtitle: "Local AI chat and proactive alerts" },
  { id: "events", label: "Event Schemas", subtitle: "Elevar replacement contracts" },
  { id: "webhooks", label: "Webhook Log", subtitle: "Ingestion and payload trace" },
  { id: "shadow", label: "Shadow Compare", subtitle: "Elevar vs Synapse parity" },
  { id: "qa", label: "QA Smoke Tests", subtitle: "Cutover validation checklist" },
  { id: "edge", label: "Edge Ops", subtitle: "Toggles and route health checks" }
];

const SIMPLE_NAV_IDS: NavTab[] = ["platforms", "runtime", "qa", "edge"];

type FriendlyError = {
  title: string;
  why: string;
  steps: string[];
};

function getFriendlyError(error: unknown): FriendlyError {
  if (error instanceof ApiRequestError) {
    if (error.status === 501) {
      return {
        title: "This route is intentionally disabled",
        why: "The app is running in edge-only mode and this endpoint is blocked on purpose.",
        steps: [
          "Use the Edge Ops tab and keep guardrail checks enabled.",
          "Ignore this if the check expected status is 501.",
          "If you need this route, switch to a backend-supported mode first."
        ]
      };
    }

    if (error.status === 400) {
      return {
        title: "The request format was invalid",
        why: "One of the fields sent to the API is missing or malformed.",
        steps: [
          "Go to Edge Ops and run checks again.",
          "Turn on Include Write Checks only after base checks are green.",
          "Reload the page if this keeps happening."
        ]
      };
    }

    if (error.status >= 500) {
      return {
        title: "The server had a temporary issue",
        why: "Cloudflare edge endpoint returned a server error.",
        steps: [
          "Wait 10 seconds and click Try Again.",
          "Run Edge Ops checks to see which endpoint failed.",
          "If many endpoints fail, redeploy the worker."
        ]
      };
    }
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  if (message.toLowerCase().includes("failed to fetch")) {
    return {
      title: "Could not reach the app",
      why: "Your browser could not connect to the Cloudflare worker.",
      steps: [
        "Check your internet connection.",
        "Refresh this page.",
        "Open Edge Ops and run checks once the page loads."
      ]
    };
  }

  return {
    title: "Something went wrong",
    why: message,
    steps: ["Click Try Again.", "Open Edge Ops and run checks.", "If issue remains, redeploy the app."]
  };
}

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
    label: "Auth Install Redirect",
    path: "/auth/shopify/install?shop=gcw-dev.myshopify.com",
    method: "GET",
    expectedStatuses: [302],
    group: "guardrails"
  },
  { id: "compare-platforms", label: "Compare Platforms", path: "/compare/platforms", method: "GET", expectedStatuses: [200], group: "runtime" },
  {
    id: "compare-browser",
    label: "Compare Browser Dual-run",
    path: "/compare/browser",
    method: "GET",
    expectedStatuses: [200],
    group: "runtime"
  },
  {
    id: "compare-ui-model",
    label: "Compare UI Model",
    path: "/compare/ui-model",
    method: "GET",
    expectedStatuses: [200],
    group: "runtime"
  },
  {
    id: "ops-connection",
    label: "Ops Connection",
    path: "/ops/connection",
    method: "GET",
    expectedStatuses: [200],
    group: "webhooks"
  },
  {
    id: "ops-wire",
    label: "Ops Wire (gcw-dev)",
    path: "/ops/wire?shop=gcw-dev.myshopify.com",
    method: "GET",
    expectedStatuses: [200],
    group: "webhooks"
  },
  {
    id: "compat-ids",
    label: "Compatibility IDs",
    path: "/compatibility/ids",
    method: "GET",
    expectedStatuses: [200],
    group: "guardrails"
  },
  {
    id: "guard-compat",
    label: "Compatibility GA4",
    path: "/compatibility/ga4-id",
    method: "GET",
    expectedStatuses: [200],
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

function QuickStartPanel({
  onGoRuntime,
  onGoEdge,
  onGoQa,
  simpleMode,
  onToggleSimpleMode
}: {
  onGoRuntime: () => void;
  onGoEdge: () => void;
  onGoQa: () => void;
  simpleMode: boolean;
  onToggleSimpleMode: (checked: boolean) => void;
}) {
  return (
    <section className="panel panel-quickstart">
      <div className="quickstart-header">
        <div>
          <h2>Start Here</h2>
          <p>Three steps. Follow them in order.</p>
        </div>
        <label className="simple-mode-toggle">
          <input type="checkbox" checked={simpleMode} onChange={(event) => onToggleSimpleMode(event.target.checked)} />
          <span>Simple Mode</span>
        </label>
      </div>

      <div className="quickstart-steps">
        <button type="button" className="quick-step" onClick={onGoRuntime}>
          <strong>1. Check Runtime</strong>
          <span>Look for Connected database and Installed Shopify status.</span>
        </button>
        <button type="button" className="quick-step" onClick={onGoEdge}>
          <strong>2. Run Health Checks</strong>
          <span>Click Run Health Checks and confirm all pass.</span>
        </button>
        <button type="button" className="quick-step" onClick={onGoQa}>
          <strong>3. Run QA Smoke</strong>
          <span>Use Run All Smoke Tests before launch changes.</span>
        </button>
      </div>
    </section>
  );
}

function ErrorHelpPanel({
  error,
  onRetry,
  onOpenEdge
}: {
  error: unknown;
  onRetry: () => void;
  onOpenEdge: () => void;
}) {
  const friendly = getFriendlyError(error);

  return (
    <section className="error-banner error-help-panel">
      <h3>{friendly.title}</h3>
      <p>{friendly.why}</p>
      <ol>
        {friendly.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <div className="error-help-actions">
        <button type="button" className="primary" onClick={onRetry}>
          Try Again
        </button>
        <button type="button" className="secondary" onClick={onOpenEdge}>
          Open Edge Ops
        </button>
      </div>
    </section>
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

      <div className="edge-help-notes">
        <p>
          <strong>Pass</strong> means the endpoint returned the expected HTTP code.
        </p>
        <p>
          <strong>501 Guardrail</strong> checks are expected to pass with 501 in edge-only mode.
        </p>
        <p>
          Turn off <strong>Include Write Checks</strong> if you only want read-only checks.
        </p>
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

function AdvisorSection({
  alerts,
  messages,
  draft,
  onDraftChange,
  onSend,
  sending
}: {
  alerts: AdvisorAlertItem[];
  messages: AdvisorChatMessage[];
  draft: string;
  onDraftChange: (next: string) => void;
  onSend: () => void;
  sending: boolean;
}) {
  return (
    <section className="panel">
      <PanelHeader
        title="Synapse Advisor"
        subtitle="Local AI with MCP-style context tools for Shopify, Elevar replacement, GTM, and business analytics ops"
      />

      <article className="panel-block">
        <div className="block-header">
          <h3>Proactive Alerts</h3>
          <Badge tone={alerts.some((item) => item.severity === "critical") ? "danger" : "warning"}>
            {`${alerts.length} alerts`}
          </Badge>
        </div>

        {alerts.length === 0 ? <p className="muted">No advisor alerts right now.</p> : null}
        {alerts.length > 0 ? (
          <div className="advisor-alert-list">
            {alerts.map((alert, index) => (
              <article key={`${alert.title}-${index}`} className="advisor-alert-item">
                <div className="advisor-alert-header">
                  <strong>{alert.title}</strong>
                  <Badge tone={alert.severity === "critical" ? "danger" : "warning"}>{alert.severity}</Badge>
                </div>
                <p>{alert.message}</p>
                <p className="muted">Action: {alert.action}</p>
              </article>
            ))}
          </div>
        ) : null}
      </article>

      <article className="panel-block">
        <div className="block-header">
          <h3>Ask Synapse Advisor</h3>
          <Badge tone="neutral">Local model</Badge>
        </div>

        <div className="advisor-chat-window">
          {messages.length === 0 ? (
            <p className="muted">Ask questions like: "Why are Meta purchase events warning?" or "Are we ready to cut over from Elevar?"</p>
          ) : (
            messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`advisor-message advisor-message-${message.role}`}>
                <strong>{message.role === "assistant" ? "Advisor" : "You"}</strong>
                <pre>{message.content}</pre>
              </div>
            ))
          )}
        </div>

        <div className="advisor-input-row">
          <textarea
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="Ask about Shopify analytics health, GTM mapping, Elevar parity, theme events, revenue impact..."
            rows={3}
          />
          <button type="button" className="primary" onClick={onSend} disabled={sending || draft.trim().length === 0}>
            {sending ? "Sending..." : "Ask Advisor"}
          </button>
        </div>
      </article>
    </section>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>("platforms");
  const [state, setState] = useState<LoadState>({ loading: true, error: null });
  const [lastError, setLastError] = useState<unknown>(null);
  const [simpleMode, setSimpleMode] = useState(true);
  const [embed] = useState<ShopifyEmbedContext>(() => getShopifyEmbedContext());

  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null);
  const [schemas, setSchemas] = useState<EventSchema[]>([]);
  const [webhooks, setWebhooks] = useState<unknown[]>([]);
  const [shadowStats, setShadowStats] = useState<ShadowStats | null>(null);
  const [comparisons, setComparisons] = useState<unknown[]>([]);
  const [checklist, setChecklist] = useState<QaChecklistItem[]>([]);
  const [smokeResult, setSmokeResult] = useState<SmokeRunResult | null>(null);
  const [shopifyStatus, setShopifyStatus] = useState<ShopifyInstallStatus | null>(null);
  const [uiModel, setUiModel] = useState<UiModel | null>(null);
  const [platformMatrix, setPlatformMatrix] = useState<PlatformMatrix | null>(null);
  const [platformsLoading, setPlatformsLoading] = useState(false);
  const [advisorAlerts, setAdvisorAlerts] = useState<AdvisorAlertItem[]>([]);
  const [advisorMessages, setAdvisorMessages] = useState<AdvisorChatMessage[]>([]);
  const [advisorDraft, setAdvisorDraft] = useState("");
  const [advisorSending, setAdvisorSending] = useState(false);
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

  const visibleNavItems = useMemo(
    () => (simpleMode ? NAV_ITEMS.filter((item) => SIMPLE_NAV_IDS.includes(item.id)) : NAV_ITEMS),
    [simpleMode]
  );

  useEffect(() => {
    if (!visibleNavItems.some((item) => item.id === activeTab)) {
      setActiveTab("platforms");
    }
  }, [visibleNavItems, activeTab]);

  function loadPlatformsData(): void {
    setPlatformsLoading(true);
    Promise.all([getCompareUiModel(100), getPlatformMatrix()])
      .then(([model, matrix]) => {
        setUiModel(model);
        setPlatformMatrix(matrix);
      })
      .catch((error: unknown) => {
        const friendly = getFriendlyError(error);
        setState((prev) => ({ ...prev, error: friendly.title }));
        setLastError(error);
      })
      .finally(() => {
        setPlatformsLoading(false);
      });
  }

  function loadControlPanelData(): void {
    setState({ loading: true, error: null });
    setLastError(null);

    // Advisor is Node-only; soft-fail so platforms still load on the edge Worker.
    const advisorPromise = getAdvisorAlerts().catch(() => [] as AdvisorAlertItem[]);

    Promise.all([
      getRuntimeStatus(),
      getEventSchemas(),
      getWebhookLog(50),
      getShadowStats(),
      getShadowComparisons(50),
      getQaChecklist(),
      getShopifyInstallStatus(),
      advisorPromise,
      getCompareUiModel(100),
      getPlatformMatrix()
    ])
      .then(
        ([
          runtimeData,
          schemaData,
          webhookData,
          shadowData,
          comparisonData,
          checklistData,
          shopifyData,
          advisorData,
          model,
          matrix
        ]) => {
        setRuntime(runtimeData);
        setSchemas(schemaData);
        setWebhooks(webhookData);
        setShadowStats(shadowData);
        setComparisons(comparisonData);
        setChecklist(checklistData);
        setShopifyStatus(shopifyData);
        setAdvisorAlerts(advisorData);
        setUiModel(model);
        setPlatformMatrix(matrix);
        setState({ loading: false, error: null });
        setLastError(null);
      })
      .catch((error: unknown) => {
        const friendly = getFriendlyError(error);
        setState({
          loading: false,
          error: friendly.title
        });
        setLastError(error);
      });
  }

  useEffect(() => {
    loadControlPanelData();
  }, []);

  const activeItem = useMemo(
    () => visibleNavItems.find((item) => item.id === activeTab) ?? visibleNavItems[0],
    [activeTab, visibleNavItems]
  );

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
      const friendly = getFriendlyError(error);
      setState((prev) => ({
        ...prev,
        error: friendly.title
      }));
      setLastError(error);
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
        const friendly = getFriendlyError(error);
        setState((prev) => ({
          loading: prev.loading,
          error: friendly.title
        }));
        setLastError(error);
      })
      .finally(() => {
        setRunningSmoke(false);
      });
  }

  function handleSendAdvisorMessage(): void {
    const message = advisorDraft.trim();
    if (!message) {
      return;
    }

    const nextHistory: AdvisorChatMessage[] = [...advisorMessages, { role: "user", content: message }];
    setAdvisorMessages(nextHistory);
    setAdvisorDraft("");
    setAdvisorSending(true);

    sendAdvisorMessage({
      message,
      history: nextHistory
    })
      .then((result) => {
        setAdvisorMessages((prev) => [...prev, { role: "assistant", content: result.answer }]);
        setAdvisorAlerts(result.alerts);
      })
      .catch((error: unknown) => {
        const friendly = getFriendlyError(error);
        setAdvisorMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Advisor error: ${friendly.title}\n${friendly.why}`
          }
        ]);
      })
      .finally(() => {
        setAdvisorSending(false);
      });
  }

  return (
    <div className={`shell ${simpleMode ? "shell-simple" : ""} ${embed.embedded ? "shell-embedded" : ""}`}>
      <aside className="sidebar">
        <div className="brand">
          <h1>SYNAPSE</h1>
          <p>{embed.shopHandle ? embed.shopHandle : "gcw control panel"}</p>
        </div>

        <nav>
          {visibleNavItems.map((item) => (
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

        <div className="sidebar-footer">
          {embed.embedded ? "Embedded in Shopify admin" : "Standalone Worker admin"}
          {embed.adminAppUrl ? (
            <>
              <br />
              <a className="sidebar-link" href={embed.adminAppUrl} target="_top" rel="noreferrer">
                Open in Shopify
              </a>
            </>
          ) : (
            <>
              <br />
              <a className="sidebar-link" href={embed.installUrl}>
                Install on shop
              </a>
            </>
          )}
        </div>
      </aside>

      <main className="content">
        {embed.shop ? (
          <div className="embed-banner">
            <div>
              <strong>Live on {embed.shop}</strong>
              <p className="muted tiny">
                Platforms, dedupe, and destination causes are the GCW Synapse app home.
              </p>
            </div>
            <div className="embed-banner-actions">
              {embed.adminAppUrl ? (
                <a className="btn-mini" href={embed.adminAppUrl} target="_top" rel="noreferrer">
                  Shopify app
                </a>
              ) : null}
              <a className="btn-mini" href={embed.installUrl}>
                Reinstall / scopes
              </a>
              <a
                className="btn-mini"
                href={
                  embed.shopHandle
                    ? `https://${embed.shop}/admin/themes/current/editor?context=apps&activateAppId=7d011b70562512bd84b85bd3f9a6e68d/gcw-synapse-app-block`
                    : "/install"
                }
                target="_blank"
                rel="noreferrer"
              >
                Theme embed
              </a>
            </div>
          </div>
        ) : (
          <div className="embed-banner">
            <div>
              <strong>Open this app inside Shopify to go live on a shop</strong>
              <p className="muted tiny">
                Install on gcw-dev, then launch GCW Synapse from Apps — this platforms UI is the app home.
              </p>
            </div>
            <div className="embed-banner-actions">
              <a className="btn-mini primary" href="/install?shop=gcw-dev.myshopify.com">
                Install gcw-dev
              </a>
              <a
                className="btn-mini"
                href="https://admin.shopify.com/store/gcw-dev/apps/7d011b70562512bd84b85bd3f9a6e68d"
                target="_top"
                rel="noreferrer"
              >
                Open Shopify app
              </a>
            </div>
          </div>
        )}

        {activeTab !== "platforms" ? (
          <QuickStartPanel
            onGoRuntime={() => setActiveTab("platforms")}
            onGoEdge={() => setActiveTab("edge")}
            onGoQa={() => setActiveTab("qa")}
            simpleMode={simpleMode}
            onToggleSimpleMode={(checked) => setSimpleMode(checked)}
          />
        ) : null}

        {activeTab !== "platforms" ? (
          <header className="page-header">
            <h1>GCW Synapse</h1>
            <p>{activeItem.subtitle}</p>
          </header>
        ) : null}

        {state.error && lastError ? (
          <ErrorHelpPanel
            error={lastError}
            onRetry={loadControlPanelData}
            onOpenEdge={() => setActiveTab("edge")}
          />
        ) : null}
        {state.loading ? <div className="loading">Loading control panel...</div> : null}

        {!state.loading ? (
          <>
            {activeTab === "platforms" ? (
              <PlatformsDashboard
                uiModel={uiModel}
                matrix={platformMatrix}
                loading={platformsLoading}
                onRefresh={loadPlatformsData}
              />
            ) : null}
            {activeTab === "runtime" ? <RuntimeSection runtime={runtime} shopifyStatus={shopifyStatus} /> : null}
            {activeTab === "advisor" ? (
              <AdvisorSection
                alerts={advisorAlerts}
                messages={advisorMessages}
                draft={advisorDraft}
                onDraftChange={setAdvisorDraft}
                onSend={handleSendAdvisorMessage}
                sending={advisorSending}
              />
            ) : null}
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
