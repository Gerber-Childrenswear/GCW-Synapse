/**
 * Automated cutover checklist — finishes whatever #1/#2 can be verified without
 * Shopify admin / GTM Preview UI.
 *
 *   npm run cutover:status
 *   npm run cutover:status -- --simulate
 */

import { spawnSync } from "node:child_process";
import { resolveAdminToken } from "./leanVerify";

type Check = { name: string; passed: boolean; detail: string; human?: boolean };

function parseArgs(argv: string[]) {
  const get = (key: string): string | undefined => {
    const idx = argv.indexOf(`--${key}`);
    if (idx < 0) return undefined;
    const value = argv[idx + 1];
    return value && !value.startsWith("--") ? value : undefined;
  };
  return {
    baseUrl: (get("base_url") ?? "https://gcw-synapse-super.gcwsynapse.workers.dev").replace(/\/$/, ""),
    token: resolveAdminToken(get("token")),
    simulate: argv.includes("--simulate"),
    skipLean: argv.includes("--skip-lean")
  };
}

async function getJson(url: string, init?: RequestInit): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(url, init);
  const text = await response.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: response.status, json };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const headers = {
    "X-Synapse-Token": args.token,
    Origin: new URL(args.baseUrl).origin,
    "Content-Type": "application/json"
  };
  const checks: Check[] = [];
  console.log(`Cutover status — ${args.baseUrl}\n`);

  // 1) Health + public surfaces
  {
    const health = await getJson(`${args.baseUrl}/health`);
    checks.push({
      name: "worker_health",
      passed: health.status === 200 && health.json.ok === true,
      detail: JSON.stringify(health.json)
    });
  }
  {
    const compat = await getJson(`${args.baseUrl}/compatibility/ids`);
    checks.push({
      name: "compatibility_public",
      passed: compat.status === 200 && compat.json.ok === true,
      detail: `HTTP ${compat.status}`
    });
  }
  {
    const cdn = await fetch(`${args.baseUrl}/gcw-synapse.js`);
    const body = await cdn.text();
    const mirror = body.includes("elevar-datalayer") || body.includes("__synapseElevarMirror");
    checks.push({
      name: "cdn_elevar_mirror",
      passed: cdn.ok && mirror,
      detail: `HTTP ${cdn.status}; mirror=${mirror}`
    });
  }

  // 2) Install / wire
  const install = await getJson(`${args.baseUrl}/ops/shopify-install-status`, { headers });
  const status = (install.json.status ?? {}) as {
    installed_shops?: string[];
    shop_status?: Array<{ shop: string; installed: boolean; detail?: string }>;
  };
  const shops = status.shop_status ?? [];
  const gcwDev = shops.find((s) => s.shop === "gcw-dev.myshopify.com");
  const prod = shops.find((s) => s.shop === "gerberchildrenswear.myshopify.com");
  checks.push({
    name: "gcw_dev_installed",
    passed: gcwDev?.installed === true,
    detail: gcwDev ? `${gcwDev.installed}${gcwDev.detail ? ` (${gcwDev.detail})` : ""}` : "missing shop_status"
  });
  checks.push({
    name: "prod_installed",
    passed: prod?.installed === true,
    detail: prod
      ? `${prod.installed}${prod.detail ? ` (${prod.detail})` : ""}`
      : "missing shop_status",
    human: true
  });

  const wireDev = await getJson(`${args.baseUrl}/ops/wire?shop=gcw-dev.myshopify.com`, {
    method: "POST",
    headers
  });
  checks.push({
    name: "gcw_dev_wire",
    passed: wireDev.status === 200 && wireDev.json.ok === true,
    detail: wireDev.json.ok === true ? "pixel+webhooks ok" : JSON.stringify(wireDev.json).slice(0, 160)
  });

  const wireProd = await getJson(`${args.baseUrl}/ops/wire?shop=gerberchildrenswear.myshopify.com`, {
    method: "POST",
    headers
  });
  checks.push({
    name: "prod_wire",
    passed: wireProd.status === 200 && wireProd.json.ok === true,
    detail: JSON.stringify(wireProd.json).slice(0, 160),
    human: true
  });

  // 3) Dual-run flag
  const dual = await getJson(`${args.baseUrl}/ops/dual-run`, { headers });
  checks.push({
    name: "synapse_dual_run_enabled",
    passed: dual.json.ok === true && dual.json.synapse_enabled !== false,
    detail: `synapse_enabled=${String(dual.json.synapse_enabled)}`
  });

  // 4) Optional simulate
  if (args.simulate) {
    const sim = spawnSync("npm", ["run", "simulate:dual-run:dev", "--", "--rounds", "3"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: process.env
    });
    const out = `${sim.stdout ?? ""}\n${sim.stderr ?? ""}`;
    const ok = sim.status === 0 && out.includes("Dual-run simulation OK");
    checks.push({
      name: "dual_run_simulate",
      passed: ok,
      detail: ok ? "simulate:dual-run:dev passed" : out.slice(-240)
    });
  }

  // 5) Launch readiness + browser parity snapshot
  const launch = await getJson(`${args.baseUrl}/launch/readiness`, { headers });
  const report = (launch.json.report ?? {}) as {
    status?: string;
    browser_parity?: { synapse_events?: number; elevar_events?: number; volume_match_pct?: number };
  };
  const syn = report.browser_parity?.synapse_events ?? 0;
  const elv = report.browser_parity?.elevar_events ?? 0;
  checks.push({
    name: "launch_readiness",
    passed: launch.status === 200 && (report.status === "go" || report.status === "waiting"),
    detail: `status=${report.status}; syn=${syn} elv=${elv} volume=${report.browser_parity?.volume_match_pct ?? "?"}`
  });

  // 6) Lean verify (optional — slower)
  if (!args.skipLean) {
    const lean = spawnSync("npm", ["run", "lean:verify:dev"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: process.env
    });
    const out = `${lean.stdout ?? ""}\n${lean.stderr ?? ""}`;
    checks.push({
      name: "lean_verify_dev",
      passed: lean.status === 0 && out.includes("All lean checks passed"),
      detail: lean.status === 0 ? "all lean checks passed" : out.slice(-240)
    });
  }

  // Human-only remaining
  checks.push({
    name: "gtm_preview_gcw_dev",
    passed: false,
    detail: "Manual: GTM-WH3W368X Preview on password-unlocked gcw-dev (docs/GCW_DEV_GTM_WH3W368X_VALIDATION.md)",
    human: true
  });
  checks.push({
    name: "real_storefront_browse",
    passed: false,
    detail: "Manual: browse PDP→ATC→checkout with Synapse+Elevar embeds on (not only simulate script)",
    human: true
  });

  console.log("Automated");
  for (const check of checks.filter((c) => !c.human)) {
    console.log(`${check.passed ? "PASS" : "FAIL"}  ${check.name}  ${check.detail}`);
  }
  console.log("\nHuman / blocked");
  for (const check of checks.filter((c) => c.human)) {
    console.log(`${check.passed ? "PASS" : "TODO"}  ${check.name}  ${check.detail}`);
  }

  const installUrl = `${args.baseUrl}/install?shop=gerberchildrenswear.myshopify.com`;
  const oauthUrl = `${args.baseUrl}/auth/shopify/install?shop=gerberchildrenswear.myshopify.com`;
  console.log("\nProd install links (when ready)");
  console.log(`  landing: ${installUrl}`);
  console.log(`  oauth:   ${oauthUrl}`);
  console.log(`  wire:    POST ${args.baseUrl}/ops/wire?shop=gerberchildrenswear.myshopify.com`);

  const autoFailed = checks.filter((c) => !c.human && !c.passed);
  const humanTodo = checks.filter((c) => c.human && !c.passed);
  console.log(`\nSummary: auto_fail=${autoFailed.length} human_todo=${humanTodo.length}`);

  if (autoFailed.length > 0) {
    process.exitCode = 1;
    return;
  }
  console.log("All automated cutover checks passed. Finish human TODOs next.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
