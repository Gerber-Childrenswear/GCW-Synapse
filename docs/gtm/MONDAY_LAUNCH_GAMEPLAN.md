# GCW-Synapse — Monday Launch Gameplan

Target go-live: **Monday**. This is the operational runbook for cutting GCW-Synapse
to production safely while protecting Bloomreach (which still reads Elevar-shaped
dataLayer variables via GTM). Pair this with
[ELEVAR_RETIREMENT_EXACT_CUTOVER.md](ELEVAR_RETIREMENT_EXACT_CUTOVER.md) — do **not**
remove Elevar until that contract's gates are green.

---

## 0. Production hardening shipped (already merged)

The server and pixels were hardened end-to-end before launch:

- **Public `/event` boundary fixed.** The browser pixel endpoint is no longer gated
  by the admin ingress token (browsers can't hold a secret). It is now protected by:
  - CORS allowlist + preflight (`OPTIONS`) handling — set
    `PUBLIC_EVENT_ALLOWED_ORIGINS` to storefront origins.
  - Per-IP fixed-window rate limit (`PUBLIC_EVENT_RATE_LIMIT_PER_MINUTE`, default 120),
    returning `429` + `Retry-After`.
  - Downstream strict payload validation + bot/consent suppression (unchanged).
- **Admin routes** (`/diagnostics`, `/ops/*`, `/compatibility/*`, `/compare/*`,
  `/runtime/*`, `/launch/readiness`) keep `requireIngressToken`, now **timing-safe**
  (`crypto.timingSafeEqual`).
- **Security headers** on every response + `x-powered-by` disabled.
- **404 + global error handler** — no stack/leakage, consistent JSON errors.
- **Graceful shutdown** on `SIGTERM`/`SIGINT` (drains in-flight requests, 10s force
  timeout via `SHUTDOWN_TIMEOUT_MS`) — protects in-flight events during deploys.
- **customer-events pixel** fails closed if the endpoint still contains
  `your-domain` and retries once on a transient network failure.
- New metrics: `public_event_origin_rejected`, `public_event_rate_limited`.

Validation: `npm run typecheck` clean, `npm test` = **89/89 passing**.

---

## 1. Pre-launch checklist (run in order)

```powershell
npm ci
npm run typecheck
npm test                       # expect 89/89
npm run theme:audit:tracking   # confirm no conflicting Elevar/theme trackers
```

Then confirm launch readiness through the running service (admin token required):

```powershell
curl -H "X-Synapse-Token: <INGRESS_SHARED_TOKEN>" https://<synapse-host>/launch/readiness
```

Gate: `allowed: true` with zero blockers.

---

## 2. Required production environment

Set before first boot (all validated at import time by `src/config/env.ts`):

| Variable | Value for launch |
| --- | --- |
| `INGRESS_SHARED_TOKEN` | strong secret (≥ 8) — admin/diagnostics only |
| `GTM_FORWARD_SHARED_SECRET` | strong secret (≥ 16) for outbound HMAC signing |
| `PUBLIC_EVENT_ALLOWED_ORIGINS` | `https://www.gerberchildrenswear.com,https://gerberchildrenswear.myshopify.com` |
| `PUBLIC_EVENT_RATE_LIMIT_PER_MINUTE` | `120` (raise only if false 429s appear) |
| `STRICT_LAUNCH_GUARD` | `true` |
| `LAUNCH_MAX_DEAD_LETTER_RECORDS` | `0` |
| `LAUNCH_BLOCK_ON_THEME_CONFLICTS` | `true` |
| `RUNTIME_MODE` | start in **shadow**, flip to **forward** at cutover (see §4) |
| `SHUTDOWN_TIMEOUT_MS` | `10000` |

Also update both pixels' endpoints to the deployed Synapse URL:
- Theme pixel: set `window.GCW_SYNAPSE_ENDPOINT`.
- customer-events pixel: replace the `your-domain` endpoint (it stays inert until you do).

---

## 3. Bloomreach parity gate (do NOT skip)

Bloomreach depends on `add_to_cart`, `view_item`, and `purchase` dataLayer shapes.
Before forwarding live traffic:

1. Run side-by-side preview validation:
   ```powershell
   npm run gtm:validate:synapse-preview
   npm run gtm:smoke:synapse-preview
   npm run gtm:report:placeholders
   ```
2. In GTM Preview, fire each Bloomreach-critical event and confirm the Synapse
   companion variables resolve to non-empty values matching the Elevar contract.
3. Confirm via the running service:
   ```powershell
   curl -H "X-Synapse-Token: <token>" https://<synapse-host>/compare/parity
   ```
   Gate: mismatch rate below alert threshold.

If any Bloomreach placeholder is still sourced from an Elevar-only variable, **stop** —
Elevar stays until that placeholder is repointed to a Synapse companion variable.

---

## 4. Cutover sequence (shadow → forward)

1. Deploy with `RUNTIME_MODE=shadow`. Synapse captures and compares but does not
   replace Elevar's forwarding. Let it run and watch `/compare/parity`.
2. When parity is green and dead-letter is empty, flip `RUNTIME_MODE=forward` and
   redeploy. Synapse now forwards to the GTM server endpoint with HMAC signing.
3. Elevar and Synapse run **side by side** during the soak. Do not remove Elevar yet.
4. After the soak window with stable parity + Bloomreach validation, retire Elevar per
   the cutover contract — one placeholder source at a time.

---

## 5. Monitoring (first hours live)

Poll these (admin token):

```powershell
curl -H "X-Synapse-Token: <token>" https://<synapse-host>/ops/dashboard
curl -H "X-Synapse-Token: <token>" https://<synapse-host>/ops/alerts
curl -H "X-Synapse-Token: <token>" https://<synapse-host>/compare/parity
curl -H "X-Synapse-Token: <token>" https://<synapse-host>/ops/dead-letter
```

Watch for:
- `runtime_events_forwarded` rising; `runtime_events_rejected_invalid_payload` near zero.
- `public_event_origin_rejected` should be ~0 — if not, a real storefront origin is
  missing from `PUBLIC_EVENT_ALLOWED_ORIGINS`.
- `public_event_rate_limited` spikes → bot traffic or limit too low.
- `gtm_dead_letter_written` should stay at 0.

---

## 6. Rollback / recovery

- **Bad forward behavior:** set `RUNTIME_MODE=shadow` and redeploy. Elevar (still live)
  continues to serve Bloomreach — zero data-loss exposure.
- **Failed forwards accumulated:** replay the dead-letter queue:
  ```powershell
  npm run replay:dead-letter:dry   # inspect first
  npm run replay:dead-letter       # then replay
  ```
- **Webhook gaps:** `npm run replay:webhook:create` / `npm run replay:webhook:paid`.
- **Total abort:** keep Elevar enabled; Synapse in shadow is non-disruptive.

---

## 7. Definition of done for Monday

- [ ] `typecheck` + `test` green in CI.
- [ ] `/launch/readiness` returns `allowed: true`.
- [ ] `PUBLIC_EVENT_ALLOWED_ORIGINS` set to real storefront origins; no `403` for them.
- [ ] Both pixel endpoints point at the deployed Synapse URL.
- [ ] Bloomreach parity validated in GTM Preview (§3).
- [ ] Running in `shadow`, parity green, dead-letter empty → flip to `forward`.
- [ ] Elevar left **enabled** for the soak; retire only per the cutover contract.
