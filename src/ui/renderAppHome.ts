export type AppHomeContext = {
  shop: string;
  host: string;
  clientId: string;
  runtimeMode: string;
  appUrl: string;
};

export function renderAppHome(ctx: AppHomeContext): string {
  const shop = escapeHtml(ctx.shop || "gcw-dev.myshopify.com");
  const host = escapeHtml(ctx.host);
  const clientId = escapeHtml(ctx.clientId || "—");
  const runtimeMode = escapeHtml(ctx.runtimeMode);
  const appUrl = escapeHtml(ctx.appUrl);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Synapse — First-party analytics</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --ink: #07131f;
      --ink-2: #102033;
      --mist: #d7e6ef;
      --paper: #f3f7fa;
      --signal: #0fbe8f;
      --signal-deep: #087a5c;
      --warn: #d97706;
      --hold: #c2410c;
      --line: rgba(7, 19, 31, 0.12);
      --glow: rgba(15, 190, 143, 0.35);
      --display: "Fraunces", Georgia, serif;
      --sans: "Outfit", "Segoe UI", sans-serif;
    }

    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--ink);
      font-family: var(--sans);
      background:
        radial-gradient(1200px 600px at 12% -10%, rgba(15, 190, 143, 0.18), transparent 55%),
        radial-gradient(900px 500px at 100% 0%, rgba(16, 32, 51, 0.12), transparent 50%),
        linear-gradient(165deg, #eef5f8 0%, var(--paper) 42%, #e7f0f5 100%);
      overflow-x: hidden;
    }

    body::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      opacity: 0.35;
      background-image:
        linear-gradient(rgba(7, 19, 31, 0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(7, 19, 31, 0.04) 1px, transparent 1px);
      background-size: 48px 48px;
      mask-image: radial-gradient(circle at 50% 20%, black 20%, transparent 75%);
      animation: gridDrift 28s linear infinite;
    }

    @keyframes gridDrift {
      from { transform: translateY(0); }
      to { transform: translateY(48px); }
    }

    @keyframes riseIn {
      from { opacity: 0; transform: translateY(18px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes pulseRing {
      0% { transform: scale(0.85); opacity: 0.7; }
      70% { transform: scale(1.35); opacity: 0; }
      100% { opacity: 0; }
    }

    @keyframes shimmer {
      0% { background-position: 0% 50%; }
      100% { background-position: 200% 50%; }
    }

    .shell {
      position: relative;
      width: min(1120px, calc(100% - 32px));
      margin: 0 auto;
      padding: 28px 0 72px;
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      animation: riseIn 0.7s ease both;
    }

    .brand-mark {
      display: inline-flex;
      align-items: baseline;
      gap: 10px;
      font-family: var(--display);
      font-weight: 700;
      font-size: 1.15rem;
      letter-spacing: -0.03em;
    }

    .brand-mark span {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--signal);
      box-shadow: 0 0 0 6px rgba(15, 190, 143, 0.15);
    }

    .shop-chip {
      font-size: 0.85rem;
      color: rgba(7, 19, 31, 0.65);
      border-bottom: 1px solid var(--line);
      padding-bottom: 2px;
    }

    .hero {
      margin-top: 56px;
      min-height: min(72vh, 640px);
      display: grid;
      align-content: center;
      gap: 22px;
      animation: riseIn 0.85s 0.08s ease both;
    }

    .hero h1 {
      margin: 0;
      font-family: var(--display);
      font-weight: 700;
      font-size: clamp(3.4rem, 9vw, 6.4rem);
      line-height: 0.92;
      letter-spacing: -0.045em;
      max-width: 11ch;
    }

    .hero h1 em {
      font-style: normal;
      background: linear-gradient(110deg, var(--ink) 20%, var(--signal-deep) 45%, var(--signal) 62%, var(--ink) 85%);
      background-size: 200% auto;
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      animation: shimmer 7s linear infinite;
    }

    .hero-copy {
      margin: 0;
      max-width: 34rem;
      font-size: 1.15rem;
      line-height: 1.55;
      color: rgba(7, 19, 31, 0.72);
    }

    .cta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 8px;
    }

    .btn {
      appearance: none;
      border: 0;
      cursor: pointer;
      font: inherit;
      font-weight: 600;
      font-size: 0.95rem;
      padding: 0.85rem 1.2rem;
      border-radius: 999px;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
    }

    .btn:hover { transform: translateY(-1px); }

    .btn-primary {
      color: #042218;
      background: var(--signal);
      box-shadow: 0 10px 30px var(--glow);
    }

    .btn-ghost {
      color: var(--ink);
      background: transparent;
      border: 1px solid var(--line);
    }

    .live {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      margin-top: 8px;
      font-size: 0.9rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }

    .live-dot {
      position: relative;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--signal);
    }

    .live-dot::after {
      content: "";
      position: absolute;
      inset: -4px;
      border-radius: 50%;
      border: 1.5px solid var(--signal);
      animation: pulseRing 1.8s ease-out infinite;
    }

    .signal-stage {
      margin-top: 48px;
      padding-top: 36px;
      border-top: 1px solid var(--line);
      animation: riseIn 0.9s 0.16s ease both;
    }

    .section-kicker {
      margin: 0 0 10px;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: rgba(7, 19, 31, 0.5);
    }

    .section-title {
      margin: 0 0 22px;
      font-family: var(--display);
      font-size: clamp(1.8rem, 3.5vw, 2.5rem);
      letter-spacing: -0.03em;
      line-height: 1.1;
      max-width: 16ch;
    }

    .metrics {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
    }

    @media (max-width: 860px) {
      .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    @media (max-width: 520px) {
      .metrics { grid-template-columns: 1fr; }
      .hero { margin-top: 36px; min-height: auto; }
    }

    .metric {
      padding: 18px 18px 16px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.55);
      border: 1px solid rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(10px);
      box-shadow: 0 1px 0 rgba(255, 255, 255, 0.8) inset;
      transition: transform 0.25s ease, border-color 0.25s ease;
    }

    .metric:hover {
      transform: translateY(-2px);
      border-color: rgba(15, 190, 143, 0.45);
    }

    .metric .label {
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgba(7, 19, 31, 0.5);
    }

    .metric .value {
      margin-top: 10px;
      font-family: var(--display);
      font-size: clamp(1.7rem, 3vw, 2.2rem);
      letter-spacing: -0.03em;
      line-height: 1;
    }

    .metric .hint {
      margin-top: 8px;
      font-size: 0.85rem;
      color: rgba(7, 19, 31, 0.55);
    }

    .gate {
      margin-top: 42px;
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 28px;
      align-items: stretch;
    }

    @media (max-width: 900px) {
      .gate { grid-template-columns: 1fr; }
    }

    .gate-panel {
      position: relative;
      overflow: hidden;
      border-radius: 28px;
      padding: 28px;
      color: #e8f7f2;
      background:
        radial-gradient(600px 280px at 80% 0%, rgba(15, 190, 143, 0.35), transparent 55%),
        linear-gradient(145deg, var(--ink) 0%, var(--ink-2) 100%);
    }

    .gate-panel h3 {
      margin: 0;
      font-family: var(--display);
      font-size: 2rem;
      letter-spacing: -0.03em;
    }

    .gate-status {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      margin-top: 18px;
      font-size: 0.95rem;
      font-weight: 600;
    }

    .gate-status[data-state="go"] { color: #7dffc9; }
    .gate-status[data-state="hold"] { color: #fdba74; }
    .gate-status[data-state="loading"] { color: var(--mist); }

    .checks {
      margin-top: 22px;
      display: grid;
      gap: 10px;
    }

    .check {
      display: grid;
      grid-template-columns: 18px 1fr auto;
      gap: 10px;
      align-items: start;
      padding: 10px 0;
      border-top: 1px solid rgba(215, 230, 239, 0.12);
      font-size: 0.92rem;
    }

    .check .ok { color: #7dffc9; }
    .check .bad { color: #fdba74; }
    .check .meta { color: rgba(215, 230, 239, 0.55); font-size: 0.8rem; }

    .contrast {
      border-radius: 28px;
      padding: 28px;
      background: rgba(255, 255, 255, 0.62);
      border: 1px solid rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(10px);
    }

    .contrast h3 {
      margin: 0 0 12px;
      font-family: var(--display);
      font-size: 1.7rem;
      letter-spacing: -0.03em;
    }

    .contrast p {
      margin: 0 0 16px;
      color: rgba(7, 19, 31, 0.68);
      line-height: 1.55;
    }

    .vs {
      display: grid;
      gap: 12px;
    }

    .vs-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .vs-item {
      padding: 14px;
      border-radius: 14px;
      border: 1px solid var(--line);
      background: rgba(243, 247, 250, 0.8);
    }

    .vs-item strong {
      display: block;
      font-size: 0.78rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 6px;
    }

    .vs-item.elevar strong { color: rgba(7, 19, 31, 0.45); }
    .vs-item.synapse strong { color: var(--signal-deep); }
    .vs-item span { font-size: 0.95rem; line-height: 1.4; }

    .footer {
      margin-top: 48px;
      padding-top: 18px;
      border-top: 1px solid var(--line);
      display: flex;
      flex-wrap: wrap;
      gap: 12px 24px;
      justify-content: space-between;
      color: rgba(7, 19, 31, 0.5);
      font-size: 0.85rem;
    }

    .skeleton {
      background: linear-gradient(90deg, rgba(7,19,31,0.06), rgba(7,19,31,0.12), rgba(7,19,31,0.06));
      background-size: 200% 100%;
      animation: shimmer 1.4s linear infinite;
      border-radius: 8px;
      color: transparent !important;
    }
  </style>
</head>
<body>
  <div class="shell"
    data-shop="${shop}"
    data-host="${host}"
    data-client-id="${clientId}"
    data-runtime-mode="${runtimeMode}"
    data-app-url="${appUrl}">
    <header class="topbar">
      <div class="brand-mark"><span aria-hidden="true"></span>Synapse</div>
      <div class="shop-chip">${shop}</div>
    </header>

    <section class="hero" aria-label="Synapse hero">
      <div class="live"><span class="live-dot" aria-hidden="true"></span> Live on first-party rails</div>
      <h1>Own the <em>signal</em>.</h1>
      <p class="hero-copy">
        Synapse replaces Elevar’s black box with your Shopify webhooks, your Server GTM, and a launch gate you can trust before cutover.
      </p>
      <div class="cta-row">
        <a class="btn btn-primary" href="#readiness">Check launch gate</a>
        <a class="btn btn-ghost" href="/health" target="_blank" rel="noreferrer">Health endpoint</a>
      </div>
    </section>

    <section class="signal-stage" id="readiness" aria-label="Live readiness">
      <p class="section-kicker">Mission control</p>
      <h2 class="section-title">Launch readiness in plain sight</h2>

      <div class="metrics" id="metrics">
        <article class="metric">
          <div class="label">Runtime</div>
          <div class="value skeleton" id="m-runtime">shadow</div>
          <div class="hint" id="m-runtime-hint">Loading…</div>
        </article>
        <article class="metric">
          <div class="label">Paired events</div>
          <div class="value skeleton" id="m-paired">000</div>
          <div class="hint" id="m-paired-hint">Loading…</div>
        </article>
        <article class="metric">
          <div class="label">Mismatch rate</div>
          <div class="value skeleton" id="m-mismatch">0%</div>
          <div class="hint" id="m-mismatch-hint">Loading…</div>
        </article>
        <article class="metric">
          <div class="label">Webhook health</div>
          <div class="value skeleton" id="m-webhook">0%</div>
          <div class="hint" id="m-webhook-hint">Loading…</div>
        </article>
      </div>

      <div class="gate">
        <div class="gate-panel">
          <h3>Cutover gate</h3>
          <div class="gate-status" id="gate-status" data-state="loading">Reading validation phase…</div>
          <div class="checks" id="checks"></div>
        </div>

        <div class="contrast">
          <h3>Why Synapse wins</h3>
          <p>Elevar rents you opacity. Synapse gives Gerber a first-party pipe you can inspect, shadow-compare, and flip with confidence.</p>
          <div class="vs">
            <div class="vs-row">
              <div class="vs-item elevar"><strong>Elevar</strong><span>Template lock-in, opaque mapping, vendor-shaped truth.</span></div>
              <div class="vs-item synapse"><strong>Synapse</strong><span>HMAC-verified Shopify orders → your sGTM, with parity you can prove.</span></div>
            </div>
            <div class="vs-row">
              <div class="vs-item elevar"><strong>Their clock</strong><span>Wait on support and mystery diffs.</span></div>
              <div class="vs-item synapse"><strong>Your gate</strong><span>Shadow mode, mismatch alerts, go/hold before forward.</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <footer class="footer">
      <div>Client <code>${clientId}</code></div>
      <div>App <code>${appUrl}</code></div>
    </footer>
  </div>

  <script>
    (function () {
      const root = document.querySelector(".shell");
      const fmt = new Intl.NumberFormat("en-US");

      function setText(id, text, skeleton) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = text;
        el.classList.toggle("skeleton", !!skeleton);
      }

      function renderChecks(checks) {
        const wrap = document.getElementById("checks");
        if (!wrap) return;
        if (!checks || !checks.length) {
          wrap.innerHTML = "<div class='check'><span>·</span><div>No checks yet — waiting for shadow traffic.</div><span class='meta'></span></div>";
          return;
        }
        wrap.innerHTML = checks.map(function (c) {
          const cls = c.status === "pass" ? "ok" : "bad";
          const mark = c.status === "pass" ? "✓" : "!";
          return "<div class='check'><span class='" + cls + "'>" + mark + "</span><div>" +
            c.title + "<div class='meta'>" + c.recommendation + "</div></div><span class='meta'>" +
            c.value + " / " + c.target + "</span></div>";
        }).join("");
      }

      async function refresh() {
        try {
          const res = await fetch("/app/summary", { headers: { "Accept": "application/json" } });
          if (!res.ok) throw new Error("summary " + res.status);
          const data = await res.json();
          const parity = data.parity || {};
          const counts = (data.parity_counts) || {};
          const report = data.launch_readiness || {};
          const metrics = data.metrics || {};

          setText("m-runtime", data.runtime_mode || "—", false);
          setText("m-runtime-hint", data.runtime_mode === "shadow_compare" ? "Validating beside Elevar" : "Forwarding to sGTM", false);

          setText("m-paired", fmt.format(counts.paired_events || 0), false);
          setText("m-paired-hint", "Target ≥ " + (data.thresholds && data.thresholds.min_paired_events || 100), false);

          const mismatch = typeof parity.mismatch_rate_pct === "number" ? parity.mismatch_rate_pct.toFixed(2) + "%" : "—";
          setText("m-mismatch", mismatch, false);
          setText("m-mismatch-hint", parity.status === "alert" ? "Above alert threshold" : "Within threshold", false);

          const failRate = typeof metrics.webhook_failure_rate_pct === "number" ? metrics.webhook_failure_rate_pct.toFixed(2) + "%" : "0.00%";
          setText("m-webhook", failRate, false);
          setText("m-webhook-hint", fmt.format(metrics.webhooks_received || 0) + " received", false);

          const gate = document.getElementById("gate-status");
          if (gate) {
            const status = report.status || "hold";
            gate.dataset.state = status;
            gate.textContent = status === "go"
              ? "GO — validation checks are green"
              : "HOLD — keep shadowing until the gate clears";
          }

          renderChecks(report.checks || []);
        } catch (err) {
          setText("m-runtime", root.dataset.runtimeMode || "—", false);
          setText("m-runtime-hint", "Live summary unavailable", false);
          setText("m-paired", "—", false);
          setText("m-paired-hint", "Retrying…", false);
          setText("m-mismatch", "—", false);
          setText("m-mismatch-hint", "Retrying…", false);
          setText("m-webhook", "—", false);
          setText("m-webhook-hint", "Retrying…", false);
          const gate = document.getElementById("gate-status");
          if (gate) {
            gate.dataset.state = "loading";
            gate.textContent = "Couldn’t reach /app/summary yet";
          }
        }
      }

      refresh();
      setInterval(refresh, 15000);
    })();
  </script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
