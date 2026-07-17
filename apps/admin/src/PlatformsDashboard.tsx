import { useEffect, useMemo, useState } from "react";
import type { PlatformMatrix, PlatformRow, UiModel } from "./api";

type Props = {
  uiModel: UiModel | null;
  matrix: PlatformMatrix | null;
  loading: boolean;
  onRefresh: () => void;
};

const MONITOR_KEY = "synapse.platform.monitored";

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

function SurfaceCell({
  label,
  pulse
}: {
  label: string;
  pulse: PlatformRow["browser"];
}) {
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

function MatchMeter({ value }: { value: number | null }) {
  if (value == null) {
    return <div className="match-meter empty">No paired browser/server events yet</div>;
  }
  const tone = value >= 95 ? "ok" : value >= 85 ? "warn" : "bad";
  return (
    <div className={`match-meter ${tone}`}>
      <div className="match-meter-top">
        <strong>{value.toFixed(1)}%</strong>
        <span>browser ↔ server match</span>
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

      <MatchMeter value={row.match_pct} />

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

      <button
        type="button"
        className="linkish"
        onClick={() => onExpand(expanded ? null : row.id)}
      >
        {expanded ? "Hide troubleshooting" : "Troubleshoot with vendor docs"}
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

export function PlatformsDashboard({ uiModel, matrix, loading, onRefresh }: Props) {
  const [monitored, setMonitored] = useState<Record<string, boolean>>(() => loadMonitored());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showIdle, setShowIdle] = useState(true);
  const [onlyMonitored, setOnlyMonitored] = useState(false);

  useEffect(() => {
    localStorage.setItem(MONITOR_KEY, JSON.stringify(monitored));
  }, [monitored]);

  const data = matrix ?? uiModel?.platforms ?? null;
  const parity = uiModel?.parity;
  const browserParity = uiModel?.browser_parity;

  const rows = useMemo(() => {
    if (!data) return [];
    return data.platforms.filter((row) => {
      if (!showIdle && row.status === "idle") return false;
      if (onlyMonitored && monitored[row.id] === false) return false;
      if (onlyMonitored && monitored[row.id] == null && row.status === "idle") return false;
      return true;
    });
  }, [data, showIdle, onlyMonitored, monitored]);

  function toggleMonitored(id: string, next: boolean) {
    setMonitored((prev) => ({ ...prev, [id]: next }));
  }

  return (
    <section className="platforms-dashboard">
      <div className="platforms-hero">
        <div>
          <p className="eyebrow">Elevar-style destination health</p>
          <h2>Browser vs Server by platform</h2>
          <p className="muted">
            Live match rates, firing status, and vendor-doc troubleshooting for every destination Synapse
            feeds through GTM.
          </p>
        </div>
        <div className="platforms-hero-actions">
          <button type="button" className="primary" onClick={onRefresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
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

      <div className="summary-strip">
        <div className="summary-card">
          <span className="label">Purchase shadow match</span>
          <strong>{parity?.matched_rate_pct != null ? `${parity.matched_rate_pct}%` : "—"}</strong>
          <small>{parity?.status ?? "waiting"}</small>
        </div>
        <div className="summary-card">
          <span className="label">Browser data-layer match</span>
          <strong>
            {browserParity?.matched_rate_pct != null ? `${browserParity.matched_rate_pct}%` : "—"}
          </strong>
          <small>{browserParity?.status ?? "waiting"}</small>
        </div>
        <div className="summary-card">
          <span className="label">Avg platform match</span>
          <strong>
            {data?.totals.avg_match_pct != null ? `${data.totals.avg_match_pct}%` : "—"}
          </strong>
          <small>
            {data
              ? `${data.totals.healthy} healthy · ${data.totals.warning} warn · ${data.totals.critical} critical`
              : "loading"}
          </small>
        </div>
        <div className="summary-card">
          <span className="label">Launch gate</span>
          <strong>
            {typeof uiModel?.launch_readiness === "object" &&
            uiModel.launch_readiness &&
            "status" in uiModel.launch_readiness
              ? String((uiModel.launch_readiness as { status?: string }).status ?? "—")
              : "—"}
          </strong>
          <small>GO / HOLD from readiness checks</small>
        </div>
      </div>

      {!data ? (
        <div className="loading">Loading platform matrix…</div>
      ) : (
        <div className="platform-list">
          {rows.map((row) => (
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
      )}

      {data && data.troubleshooting.length > 0 ? (
        <div className="global-issues">
          <h3>Active issues</h3>
          {data.troubleshooting.slice(0, 8).map((issue) => (
            <div key={issue.key} className={`issue ${issue.severity}`}>
              <strong>{issue.title}</strong>
              <p>{issue.details}</p>
              <div className="doc-links">
                {issue.links.slice(0, 2).map((href) => (
                  <a key={href} href={href} target="_blank" rel="noreferrer">
                    Vendor docs ↗
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
