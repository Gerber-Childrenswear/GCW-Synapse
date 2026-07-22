import { useEffect, useMemo, useState } from "react";
import type { PlatformMatrix, PlatformRow, RecentChannelEvent, UiModel } from "./api";
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
    blurb: "Browser pixel + CAPI / Events API dedupe",
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
    blurb: "sGTM + Synapse ingest health",
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
  if (status === "healthy" || status === "firing" || status === "ok") return "ok";
  if (status === "warning" || status === "silent") return "warn";
  if (status === "critical" || status === "error" || status === "alert") return "bad";
  return "idle";
}

function formatPct(value: number | null | undefined, pairs: number | null | undefined): string {
  if (pairs == null || pairs <= 0 || value == null) return "—";
  return `${value.toFixed(1)}%`;
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
      {pulse.destinations.length > 0 ? (
        <div className="muted tiny">{pulse.destinations.join(" · ")}</div>
      ) : null}
    </div>
  );
}

function MatchMeter({ value, paired }: { value: number | null; paired: number }) {
  if (value == null || paired <= 0) {
    return <div className="match-meter empty">Waiting for paired browser ↔ server hits</div>;
  }
  const tone = value >= 95 ? "ok" : value >= 85 ? "warn" : "bad";
  return (
    <div className={`match-meter ${tone}`}>
      <div className="match-meter-top">
        <strong>{value.toFixed(1)}%</strong>
        <span>
          match · {paired} pair{paired === 1 ? "" : "s"}
        </span>
      </div>
      <div className="match-track">
        <div className="match-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
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
  const expectedFired = row.expected_events.filter((eventName) => {
    const browserCount = row.browser.event_counts[eventName] ?? 0;
    const serverCount = row.server.event_counts[eventName] ?? 0;
    return browserCount + serverCount > 0;
  });

  return (
    <article className={`platform-card status-${row.status} ${monitored ? "" : "dimmed"}`}>
      <header className="platform-card-head">
        <div>
          <h3>{row.label}</h3>
          <p className="muted">
            {row.paired_events} paired · {row.issues.length} issue{row.issues.length === 1 ? "" : "s"}
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

      <MatchMeter value={row.match_pct} paired={row.paired_events} />

      <div className="expected-events">
        {row.expected_events.map((eventName) => {
          const on = expectedFired.includes(eventName);
          return (
            <span key={eventName} className={`event-chip ${on ? "on" : "off"}`}>
              {on ? "●" : "○"} {eventName}
            </span>
          );
        })}
      </div>

      <button type="button" className="linkish" onClick={() => onExpand(expanded ? null : row.id)}>
        {expanded ? "Hide troubleshooting" : "Troubleshoot"}
      </button>

      {expanded ? (
        <div className="troubleshoot-panel">
          {row.tips.map((tip) => (
            <p key={tip} className="tip">
              {tip}
            </p>
          ))}
          {row.issues.length === 0 ? (
            <p className="muted">No active issues. Keep dual-run on until match % is stable.</p>
          ) : (
            row.issues.map((issue) => (
              <div key={issue.key} className={`issue ${issue.severity}`}>
                <strong>{issue.title}</strong>
                <p>{issue.details}</p>
                <ul>
                  {issue.recommendations.map((rec) => (
                    <li key={rec}>{rec}</li>
                  ))}
                </ul>
              </div>
            ))
          )}
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
      {events.slice(0, 24).map((event, index) => {
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
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(MONITOR_KEY, JSON.stringify(monitored));
  }, [monitored]);

  const data = matrix ?? uiModel?.platforms ?? null;
  const parity = uiModel?.parity;
  const browserParity = uiModel?.browser_parity;
  const channelSummary = uiModel?.channels;
  const recentEvents = (uiModel?.recent?.channel_events ?? []) as RecentChannelEvent[];

  const parityPairs = parity?.total_pairs ?? 0;
  const browserPairs = browserParity?.paired_events ?? 0;
  const allIdle = Boolean(data && data.totals.idle === data.totals.platforms);

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
          if (onlyMonitored && monitored[row.id] === false) return false;
          if (onlyMonitored && monitored[row.id] == null && row.status === "idle") return false;
          return true;
        });
      return { ...group, rows };
    }).filter((group) => group.rows.length > 0);
  }, [byId, showIdle, onlyMonitored, monitored]);

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

  const launchStatus =
    typeof uiModel?.launch_readiness === "object" &&
    uiModel.launch_readiness &&
    "status" in uiModel.launch_readiness
      ? String((uiModel.launch_readiness as { status?: string }).status ?? "—")
      : "—";

  return (
    <section className="platforms-dashboard">
      <div className="platforms-hero">
        <div>
          <p className="eyebrow">Tracking control</p>
          <h2>Platforms &amp; parity</h2>
          <p className="muted">
            Grouped destinations with browser vs server health, match rates, expected events, and a live
            activity feed — the Elevar-style view for Synapse.
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
              preview how grouped monitoring looks with dual-run data.
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

      <div className="summary-strip">
        <div className="summary-card">
          <span className="label">Purchase shadow</span>
          <strong>{formatPct(parity?.matched_rate_pct, parityPairs)}</strong>
          <small>
            {parityPairs > 0 ? `${parityPairs} pairs · ${parity?.status ?? "ok"}` : "no pairs yet"}
          </small>
        </div>
        <div className="summary-card">
          <span className="label">Browser data layer</span>
          <strong>{formatPct(browserParity?.matched_rate_pct, browserPairs)}</strong>
          <small>
            {browserPairs > 0 ? `${browserPairs} pairs · ${browserParity?.status ?? "ok"}` : "no pairs yet"}
          </small>
        </div>
        <div className="summary-card">
          <span className="label">Platform health</span>
          <strong>
            {data
              ? `${data.totals.healthy}/${data.totals.platforms}`
              : "—"}
          </strong>
          <small>
            {data
              ? `${data.totals.warning} warn · ${data.totals.critical} critical · ${data.totals.idle} idle`
              : "loading"}
          </small>
        </div>
        <div className="summary-card">
          <span className="label">Channels tracked</span>
          <strong>{channelSummary?.totals?.tracked_integrations ?? channelSummary?.total_channels ?? 0}</strong>
          <small>
            Launch {launchStatus}
            {channelSummary?.totals
              ? ` · ${channelSummary.totals.healthy ?? 0} healthy`
              : ""}
          </small>
        </div>
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
            <h3>Live activity</h3>
            <p className="muted tiny">Recent channel / destination pulses</p>
            <ActivityFeed events={recentEvents} />
          </div>

          {data && data.troubleshooting.length > 0 ? (
            <div className="aside-card">
              <h3>Active issues</h3>
              {data.troubleshooting.slice(0, 6).map((issue) => (
                <div key={issue.key} className={`issue ${issue.severity}`}>
                  <strong>{issue.title}</strong>
                  <p>{issue.details}</p>
                </div>
              ))}
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
