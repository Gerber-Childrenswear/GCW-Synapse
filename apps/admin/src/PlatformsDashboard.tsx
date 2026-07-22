import { useEffect, useMemo, useState } from "react";
import type {
  DiagnosedCause,
  DedupeStats,
  PlatformMatrix,
  PlatformRow,
  RecentChannelEvent,
  UiModel
} from "./api";
import { seedDemoPlatformTraffic } from "./api";

type Props = {
  uiModel: UiModel | null;
  matrix: PlatformMatrix | null;
  loading: boolean;
  onRefresh: () => void;
};

const MONITOR_KEY = "synapse.platform.monitored";

type PlatformGroup = {
  id: string;
  label: string;
  blurb: string;
  platformIds: string[];
};

const GROUPS: PlatformGroup[] = [
  {
    id: "paid-social",
    label: "Paid social",
    blurb: "Pixel + CAPI / Events API with event_id dedupe",
    platformIds: ["meta", "tiktok", "pinterest", "reddit"]
  },
  {
    id: "search-analytics",
    label: "Search & analytics",
    blurb: "GA4 + Google Ads enhanced conversions",
    platformIds: ["ga4", "google_ads"]
  },
  {
    id: "commerce",
    label: "Commerce engines",
    blurb: "CRM, attribution, and affiliate fan-out",
    platformIds: ["bloomreach", "triple_whale", "cj"]
  },
  {
    id: "pipe",
    label: "Server pipe",
    blurb: "sGTM hub + Synapse source of truth",
    platformIds: ["server_gtm", "synapse"]
  }
];

function loadMonitored(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(MONITOR_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
}

function statusClass(status: string): string {
  if (status === "healthy" || status === "firing" || status === "ok" || status === "confirmed" || status === "both") {
    return "ok";
  }
  if (
    status === "warning" ||
    status === "silent" ||
    status === "partial" ||
    status === "browser_only" ||
    status === "server_only"
  ) {
    return "warn";
  }
  if (status === "critical" || status === "error" || status === "alert" || status === "missing") return "bad";
  return "idle";
}

function formatPct(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value.toFixed(1)}%`;
}

function idleDedupe(): DedupeStats {
  return {
    key_field: "event_id",
    status: "idle",
    confirmed: 0,
    browser_only: 0,
    server_only: 0,
    browser_keys: 0,
    server_keys: 0,
    confirmation_pct: null,
    sample_confirmed: [],
    sample_browser_only: [],
    sample_server_only: []
  };
}

function SurfaceCell({ label, pulse }: { label: string; pulse: PlatformRow["browser"] }) {
  return (
    <div className={`surface-cell ${statusClass(pulse.status)}`}>
      <div className="surface-cell-head">
        <strong>{label}</strong>
        <span className={`pill ${statusClass(pulse.status)}`}>{pulse.status}</span>
      </div>
      <div className="surface-metrics">
        <span>{pulse.total_events} events</span>
        <span>{pulse.error_events} errors</span>
        <span>
          {pulse.minutes_since_last_event == null
            ? "no activity"
            : `${pulse.minutes_since_last_event}m ago`}
        </span>
      </div>
      {pulse.last_error_message ? (
        <div className="surface-error" title={pulse.last_error_message}>
          {pulse.last_error_message}
        </div>
      ) : null}
      {pulse.destinations.length > 0 ? (
        <div className="muted tiny">{pulse.destinations.join(" · ")}</div>
      ) : null}
    </div>
  );
}

function DedupeBadge({ dedupe }: { dedupe: DedupeStats }) {
  const label =
    dedupe.status === "confirmed"
      ? "Dedupe confirmed"
      : dedupe.status === "partial"
        ? "Dedupe partial"
        : dedupe.status === "missing"
          ? "Dedupe missing"
          : "Dedupe idle";

  return (
    <div className={`dedupe-badge ${statusClass(dedupe.status)}`}>
      <div className="dedupe-badge-top">
        <strong>{label}</strong>
        <span className="mono tiny">via {dedupe.key_field}</span>
      </div>
      <div className="dedupe-metrics">
        <span>
          <b>{dedupe.confirmed}</b> paired
        </span>
        <span>
          <b>{dedupe.browser_only}</b> browser-only
        </span>
        <span>
          <b>{dedupe.server_only}</b> server-only
        </span>
        <span>
          <b>{formatPct(dedupe.confirmation_pct)}</b> confirm
        </span>
      </div>
      {dedupe.sample_confirmed[0] ? (
        <div className="muted tiny mono">ok · {dedupe.sample_confirmed[0]}</div>
      ) : null}
      {dedupe.sample_browser_only[0] ? (
        <div className="muted tiny mono">browser · {dedupe.sample_browser_only[0]}</div>
      ) : null}
      {dedupe.sample_server_only[0] ? (
        <div className="muted tiny mono">server · {dedupe.sample_server_only[0]}</div>
      ) : null}
    </div>
  );
}

function CauseCard({ cause }: { cause: DiagnosedCause }) {
  return (
    <div className={`cause-card ${cause.severity}`}>
      <div className="cause-card-head">
        <strong>{cause.title}</strong>
        <span className={`pill ${statusClass(cause.severity)}`}>{cause.severity}</span>
      </div>
      <p>
        <span className="cause-label">Cause</span> {cause.cause}
      </p>
      <p>
        <span className="cause-label">Fix</span> {cause.fix}
      </p>
      {cause.evidence ? (
        <p className="mono tiny evidence">Evidence: {cause.evidence}</p>
      ) : null}
      <a href={cause.doc_url} target="_blank" rel="noreferrer">
        {cause.doc_label} ↗
      </a>
    </div>
  );
}

function PlatformCard({
  row,
  monitored,
  onToggle,
  expanded,
  onExpand
}: {
  row: PlatformRow;
  monitored: boolean;
  onToggle: (id: string, next: boolean) => void;
  expanded: boolean;
  onExpand: (id: string | null) => void;
}) {
  const dedupe = row.dedupe ?? idleDedupe();
  const causes = row.causes ?? [];
  const coverage = row.event_coverage ?? [];

  return (
    <article className={`platform-card status-${row.status} ${monitored ? "" : "dimmed"}`}>
      <header className="platform-card-head">
        <div>
          <h3>{row.label}</h3>
          <p className="muted">
            {row.paired_events} deduped · {causes.length} cause{causes.length === 1 ? "" : "s"} ·{" "}
            {formatPct(row.coverage_pct ?? null)} event coverage
          </p>
        </div>
        <div className="platform-card-actions">
          <label className="toggle">
            <input
              type="checkbox"
              checked={monitored}
              onChange={(e) => onToggle(row.id, e.target.checked)}
            />
            <span>Monitor</span>
          </label>
          <span className={`pill ${statusClass(row.status)}`}>{row.status}</span>
        </div>
      </header>

      <div className="platform-grid">
        <SurfaceCell label="Browser" pulse={row.browser} />
        <SurfaceCell label="Server" pulse={row.server} />
      </div>

      <DedupeBadge dedupe={dedupe} />

      <div className="expected-events">
        {(coverage.length > 0
          ? coverage
          : row.expected_events.map((name) => ({
              name,
              browser: 0,
              server: 0,
              status: "missing" as const
            }))
        ).map((event) => (
          <span key={event.name} className={`event-chip ${statusClass(event.status)}`}>
            {event.status === "both" ? "●" : event.status === "missing" ? "○" : "◐"} {event.name}
            {event.status !== "missing" ? (
              <em>
                {event.browser}/{event.server}
              </em>
            ) : null}
          </span>
        ))}
      </div>

      {causes[0] ? (
        <div className="cause-preview">
          <strong>{causes[0].title}</strong>
          <span className="muted tiny">{causes[0].fix}</span>
        </div>
      ) : null}

      <button type="button" className="linkish" onClick={() => onExpand(expanded ? null : row.id)}>
        {expanded ? "Hide diagnostics" : "Open diagnostics + vendor docs"}
      </button>

      {expanded ? (
        <div className="troubleshoot-panel">
          {causes.length > 0 ? (
            causes.map((cause) => <CauseCard key={cause.code} cause={cause} />)
          ) : (
            <p className="muted">No diagnosed causes. Keep dual-run on until dedupe stays confirmed.</p>
          )}
          {row.tips.map((tip) => (
            <p key={tip} className="tip">
              {tip}
            </p>
          ))}
          <div className="doc-links">
            {row.docs.map((href) => (
              <a key={href} href={href} target="_blank" rel="noreferrer">
                {href.replace(/^https?:\/\//, "").split("/")[0]} docs ↗
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function ActivityFeed({ events }: { events: RecentChannelEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="activity-empty">
        No channel events yet. Install the app pixel, enable the theme embed, or load sample traffic.
      </div>
    );
  }

  return (
    <ul className="activity-feed">
      {events.slice(0, 28).map((event, index) => {
        const key = `${event.observed_at ?? "t"}-${event.channel}-${event.event_name}-${index}`;
        const tone = event.status === "error" ? "bad" : "ok";
        return (
          <li key={key} className={`activity-row ${tone}`}>
            <span className={`pill ${tone}`}>{event.surface ?? "—"}</span>
            <strong>{event.channel ?? "unknown"}</strong>
            <span className="mono">{event.event_name ?? "event"}</span>
            <span className="muted tiny">{event.destination ?? ""}</span>
            <time className="muted tiny">
              {event.observed_at ? new Date(event.observed_at).toLocaleTimeString() : "—"}
            </time>
          </li>
        );
      })}
    </ul>
  );
}

export function PlatformsDashboard({ uiModel, matrix, loading, onRefresh }: Props) {
  const [monitored, setMonitored] = useState<Record<string, boolean>>(() => loadMonitored());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showIdle, setShowIdle] = useState(true);
  const [onlyMonitored, setOnlyMonitored] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "healthy" | "warning" | "critical" | "idle">(
    "all"
  );
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(MONITOR_KEY, JSON.stringify(monitored));
  }, [monitored]);

  useEffect(() => {
    if (!data || expandedId) return;
    const firstCritical = data.platforms.find((p) => p.status === "critical");
    if (firstCritical) setExpandedId(firstCritical.id);
  }, [data, expandedId]);

  const data = matrix ?? uiModel?.platforms ?? null;
  const channelSummary = uiModel?.channels;
  const recentEvents = (uiModel?.recent?.channel_events ?? []) as RecentChannelEvent[];
  const allIdle = Boolean(data && data.totals.idle === data.totals.platforms);
  const topCauses = data?.top_causes ?? [];

  const byId = useMemo(() => {
    const map = new Map<string, PlatformRow>();
    for (const row of data?.platforms ?? []) map.set(row.id, row);
    return map;
  }, [data]);

  const grouped = useMemo(() => {
    return GROUPS.map((group) => {
      const rows = group.platformIds
        .map((id) => byId.get(id))
        .filter((row): row is PlatformRow => Boolean(row))
        .filter((row) => {
          if (!showIdle && row.status === "idle") return false;
          if (statusFilter !== "all" && row.status !== statusFilter) return false;
          if (onlyMonitored && monitored[row.id] === false) return false;
          if (onlyMonitored && monitored[row.id] == null && row.status === "idle") return false;
          return true;
        })
        .sort((a, b) => {
          const rank = { critical: 0, warning: 1, healthy: 2, idle: 3 } as const;
          return rank[a.status] - rank[b.status];
        });
      return { ...group, rows };
    }).filter((group) => group.rows.length > 0);
  }, [byId, showIdle, onlyMonitored, monitored, statusFilter]);

  function toggleMonitored(id: string, next: boolean) {
    setMonitored((prev) => ({ ...prev, [id]: next }));
  }

  async function handleSeedDemo(): Promise<void> {
    setSeeding(true);
    setSeedError(null);
    try {
      await seedDemoPlatformTraffic();
      onRefresh();
    } catch (error) {
      setSeedError(error instanceof Error ? error.message : "Failed to seed demo traffic");
    } finally {
      setSeeding(false);
    }
  }

  const launchStatusRaw =
    typeof uiModel?.launch_readiness === "object" &&
    uiModel.launch_readiness &&
    "status" in uiModel.launch_readiness
      ? String((uiModel.launch_readiness as { status?: string }).status ?? "—")
      : "—";
  const launchStatus =
    (data?.totals.critical_causes ?? 0) > 0 || (data?.totals.critical ?? 0) > 0
      ? "HOLD"
      : launchStatusRaw;

  return (
    <section className="platforms-dashboard">
      <div className="platforms-hero">
        <div>
          <p className="eyebrow">Elevar-grade tracking control</p>
          <h2>Platforms, dedupe &amp; causes</h2>
          <p className="muted">
            Browser vs server health, confirmed event_id / transaction_id dedupe, and vendor-doc exact
            error causes — organized the way Synapse replaces Elevar.
          </p>
        </div>
        <div className="platforms-hero-actions">
          <button type="button" className="primary" onClick={onRefresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button type="button" className="secondary" onClick={() => void handleSeedDemo()} disabled={seeding}>
            {seeding ? "Loading sample…" : "Load sample traffic"}
          </button>
          <label className="toggle">
            <input type="checkbox" checked={showIdle} onChange={(e) => setShowIdle(e.target.checked)} />
            <span>Show idle</span>
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={onlyMonitored}
              onChange={(e) => setOnlyMonitored(e.target.checked)}
            />
            <span>Monitored only</span>
          </label>
        </div>
      </div>

      {seedError ? <div className="banner bad">{seedError}</div> : null}

      {allIdle ? (
        <div className="setup-banner">
          <div>
            <strong>No live platform traffic yet</strong>
            <p className="muted">
              After OAuth install + theme embed, events land here. Or click <em>Load sample traffic</em> to
              preview dedupe confirmation and vendor-doc causes.
            </p>
          </div>
          <ol className="setup-steps">
            <li>
              <a href="/install?shop=gcw-dev.myshopify.com">Install GCW Synapse</a>
            </li>
            <li>Enable theme App embed + Customer events app pixel</li>
            <li>Browse the storefront / place a test order</li>
          </ol>
        </div>
      ) : null}

      <div className="summary-strip summary-strip-6">
        <div className="summary-card">
          <span className="label">Dedupe confirmed</span>
          <strong>
            {data?.totals.dedupe_confirmed_platforms ?? 0}
            <small className="inline-den">/{data?.totals.monitored_with_traffic ?? 0}</small>
          </strong>
          <small>platforms with full browser↔server key match</small>
        </div>
        <div className="summary-card">
          <span className="label">Avg dedupe rate</span>
          <strong>{formatPct(data?.totals.avg_dedupe_pct ?? data?.totals.avg_match_pct)}</strong>
          <small>shared event_id / transaction_id</small>
        </div>
        <div className="summary-card">
          <span className="label">Platform health</span>
          <strong>
            {data ? `${data.totals.healthy}/${data.totals.platforms}` : "—"}
          </strong>
          <small>
            {data
              ? `${data.totals.warning} warn · ${data.totals.critical} critical · ${data.totals.idle} idle`
              : "loading"}
          </small>
        </div>
        <div className="summary-card">
          <span className="label">Open causes</span>
          <strong>{data?.totals.open_causes ?? topCauses.length}</strong>
          <small>{data?.totals.critical_causes ?? 0} critical · vendor-doc mapped</small>
        </div>
        <div className="summary-card">
          <span className="label">Channels tracked</span>
          <strong>{channelSummary?.totals?.tracked_integrations ?? channelSummary?.total_channels ?? 0}</strong>
          <small>
            {channelSummary?.totals
              ? `${channelSummary.totals.healthy ?? 0} healthy · ${channelSummary.totals.warning ?? 0} warn`
              : "waiting"}
          </small>
        </div>
        <div className={`summary-card ${(data?.totals.critical_causes ?? 0) > 0 ? "tone-bad" : ""}`}>
          <span className="label">Launch gate</span>
          <strong>{launchStatus}</strong>
          <small>
            {(data?.totals.critical_causes ?? 0) > 0
              ? "Blocked by critical destination causes"
              : "GO / HOLD from readiness checks"}
          </small>
        </div>
      </div>

      <div className="status-filters">
        {(["all", "critical", "warning", "healthy", "idle"] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`filter-chip ${statusFilter === value ? "active" : ""}`}
            onClick={() => setStatusFilter(value)}
          >
            {value}
            {data && value !== "all" ? ` · ${data.totals[value]}` : ""}
          </button>
        ))}
      </div>

      <div className="platforms-layout">
        <div className="platforms-main">
          {!data ? (
            <div className="loading">Loading platform matrix…</div>
          ) : (
            grouped.map((group) => (
              <section key={group.id} className="platform-group">
                <header className="platform-group-head">
                  <div>
                    <h3>{group.label}</h3>
                    <p className="muted">{group.blurb}</p>
                  </div>
                  <span className="pill idle">{group.rows.length}</span>
                </header>
                <div className="platform-list">
                  {group.rows.map((row) => (
                    <PlatformCard
                      key={row.id}
                      row={row}
                      monitored={monitored[row.id] !== false}
                      onToggle={toggleMonitored}
                      expanded={expandedId === row.id}
                      onExpand={setExpandedId}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>

        <aside className="platforms-aside">
          <div className="aside-card">
            <h3>Diagnosed causes</h3>
            <p className="muted tiny">Mapped to each platform’s developer docs</p>
            {topCauses.length === 0 ? (
              <div className="activity-empty">No open causes. Dual-run looks clean.</div>
            ) : (
              <div className="aside-causes">
                {topCauses.slice(0, 6).map((cause) => (
                  <CauseCard key={cause.code} cause={cause} />
                ))}
              </div>
            )}
          </div>

          <div className="aside-card">
            <h3>Live activity</h3>
            <p className="muted tiny">Recent channel / destination pulses</p>
            <ActivityFeed events={recentEvents} />
          </div>
        </aside>
      </div>
    </section>
  );
}
