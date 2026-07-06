import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type GateCheck = {
  id: string;
  title: string;
  status: "pass" | "fail";
  value: string;
  target: string;
  recommendation: string;
};

type GateReport = {
  status: "go" | "hold";
  readinessScorePct: number;
  summary: {
    checksPassed: number;
    checksFailed: number;
  };
  checks: GateCheck[];
  compatibility: {
    totalHelpers: number;
    availableHelpers: number;
    nonAvailableHelpers: number;
    coveragePct: number;
    topFailingHelpers: Array<{
      legacyVariable: string;
      endpointPath: string;
      status: string;
      errorHits: number;
      failureRatePct: number;
      reason: string;
    }>;
  };
  parity: {
    mismatchRatePct: number;
    pairedEvents: number;
    synapseOnly: number;
    elevarOnly: number;
  };
  channels: {
    critical: number;
    warning: number;
  };
};

type ApiResponse = {
  ok: boolean;
  generated_at: string;
  thresholds: Record<string, number>;
  report: GateReport;
};

type LatestStatusSnapshot = {
  generated_at: string;
  status: "go" | "hold";
  readinessScorePct: number;
  checksPassed: number;
  checksFailed: number;
  endpoint: string;
};

function parseArgMap(argv: string[]): Record<string, string> {
  const map: Record<string, string> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      map[key] = "true";
      continue;
    }

    map[key] = value;
    index += 1;
  }

  return map;
}

function timestampParts(date = new Date()): { iso: string; compact: string } {
  const iso = date.toISOString();
  const compact = iso.replace(/[:T]/g, "-").replace(/\..+$/, "");
  return { iso, compact };
}

function buildQuery(args: Record<string, string>): string {
  const keys = [
    "min_coverage_pct",
    "max_non_available_helpers",
    "min_paired_events",
    "max_mismatch_rate_pct",
    "max_critical_channels",
    "max_warning_channels",
    "max_compat_failure_rate_pct",
    "max_compat_error_hits"
  ];

  const params = new URLSearchParams();
  for (const key of keys) {
    const value = args[key];
    if (value) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query.length > 0 ? `?${query}` : "";
}

function renderMarkdown(payload: ApiResponse, endpoint: string): string {
  const failedChecks = payload.report.checks.filter((check) => check.status === "fail");
  const topFailures = payload.report.compatibility.topFailingHelpers;

  const lines: string[] = [];
  lines.push("# Synapse Cutover Report");
  lines.push("");
  lines.push(`- Generated At: ${payload.generated_at}`);
  lines.push(`- Source Endpoint: ${endpoint}`);
  lines.push(`- Status: ${payload.report.status.toUpperCase()}`);
  lines.push(`- Readiness Score: ${payload.report.readinessScorePct}%`);
  lines.push(
    `- Checks: ${payload.report.summary.checksPassed} pass / ${payload.report.summary.checksFailed} fail`
  );
  lines.push("");

  lines.push("## Gate Checks");
  lines.push("");
  lines.push("| Check | Status | Value | Target | Recommendation |");
  lines.push("|---|---|---:|---:|---|");
  for (const check of payload.report.checks) {
    lines.push(
      `| ${check.title} | ${check.status.toUpperCase()} | ${check.value} | ${check.target} | ${check.recommendation} |`
    );
  }
  lines.push("");

  lines.push("## Compatibility Summary");
  lines.push("");
  lines.push(`- Total Helpers: ${payload.report.compatibility.totalHelpers}`);
  lines.push(`- Available Helpers: ${payload.report.compatibility.availableHelpers}`);
  lines.push(`- Non-Available Helpers: ${payload.report.compatibility.nonAvailableHelpers}`);
  lines.push(`- Coverage: ${payload.report.compatibility.coveragePct}%`);
  lines.push("");

  lines.push("## Top Compatibility Failures");
  lines.push("");
  if (topFailures.length === 0) {
    lines.push("- None");
  } else {
    for (const item of topFailures) {
      lines.push(
        `- ${item.legacyVariable} (${item.endpointPath}) - ${item.failureRatePct}% failure, ${item.errorHits} errors, ${item.reason}`
      );
    }
  }
  lines.push("");

  lines.push("## Parity and Channel Snapshot");
  lines.push("");
  lines.push(`- Parity Mismatch Rate: ${payload.report.parity.mismatchRatePct}%`);
  lines.push(`- Paired Events: ${payload.report.parity.pairedEvents}`);
  lines.push(`- Synapse-Only Events: ${payload.report.parity.synapseOnly}`);
  lines.push(`- Elevar-Only Events: ${payload.report.parity.elevarOnly}`);
  lines.push(`- Critical Channels: ${payload.report.channels.critical}`);
  lines.push(`- Warning Channels: ${payload.report.channels.warning}`);
  lines.push("");

  lines.push("## Decision");
  lines.push("");
  if (payload.report.status === "go") {
    lines.push("- Gate verdict is GO. Conditions currently meet cutover thresholds.");
  } else {
    lines.push("- Gate verdict is HOLD. Address failed checks before replacing Elevar.");
  }

  if (failedChecks.length > 0) {
    lines.push("");
    lines.push("### Failed Checks");
    lines.push("");
    for (const check of failedChecks) {
      lines.push(`- ${check.title}: ${check.value} (target ${check.target})`);
    }
  }

  lines.push("");
  lines.push("## Thresholds Used");
  lines.push("");
  for (const [key, value] of Object.entries(payload.thresholds)) {
    lines.push(`- ${key}: ${value}`);
  }

  return lines.join("\n");
}

async function main(): Promise<void> {
  const args = parseArgMap(process.argv.slice(2));
  const failOnHold = args.fail_on_hold === "true";

  const baseUrl = args.base_url ?? process.env.SYNAPSE_BASE_URL ?? "http://127.0.0.1:3000";
  const ingressToken = args.token ?? process.env.SYNAPSE_INGRESS_TOKEN ?? process.env.INGRESS_SHARED_TOKEN;

  if (!ingressToken) {
    throw new Error(
      "Missing ingress token. Set SYNAPSE_INGRESS_TOKEN (or INGRESS_SHARED_TOKEN), or pass --token <value>."
    );
  }

  const outDir = args.out_dir ?? path.resolve("docs", "reports", "cutover");
  const query = buildQuery(args);
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/api/gtm/go-live-gate${query}`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      "X-Synapse-Token": ingressToken
    }
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`Gate endpoint failed (${response.status}): ${bodyText}`);
  }

  const payload = (await response.json()) as ApiResponse;
  if (!payload.ok || !payload.report) {
    throw new Error("Unexpected go-live gate response payload.");
  }

  const stamp = timestampParts();
  const basename = `cutover-gate-${stamp.compact}`;
  const jsonPath = path.resolve(outDir, `${basename}.json`);
  const mdPath = path.resolve(outDir, `${basename}.md`);
  const latestJsonPath = path.resolve(outDir, "cutover-gate-latest.json");
  const latestMdPath = path.resolve(outDir, "cutover-gate-latest.md");
  const latestStatusPath = path.resolve(outDir, "cutover-gate-status.json");
  const markdown = renderMarkdown(payload, endpoint);

  const latestStatus: LatestStatusSnapshot = {
    generated_at: payload.generated_at,
    status: payload.report.status,
    readinessScorePct: payload.report.readinessScorePct,
    checksPassed: payload.report.summary.checksPassed,
    checksFailed: payload.report.summary.checksFailed,
    endpoint
  };

  await mkdir(outDir, { recursive: true });
  await writeFile(jsonPath, JSON.stringify(payload, null, 2), "utf8");
  await writeFile(mdPath, markdown, "utf8");
  await writeFile(latestJsonPath, JSON.stringify(payload, null, 2), "utf8");
  await writeFile(latestMdPath, markdown, "utf8");
  await writeFile(latestStatusPath, JSON.stringify(latestStatus, null, 2), "utf8");

  console.log(`Cutover report generated:`);
  console.log(`- JSON: ${jsonPath}`);
  console.log(`- Markdown: ${mdPath}`);
  console.log(`- Latest JSON: ${latestJsonPath}`);
  console.log(`- Latest Markdown: ${latestMdPath}`);
  console.log(`- Latest Status JSON: ${latestStatusPath}`);
  console.log(`- Status: ${payload.report.status.toUpperCase()}`);
  console.log(`- Readiness Score: ${payload.report.readinessScorePct}%`);

  if (failOnHold && payload.report.status === "hold") {
    throw new Error("Cutover gate returned HOLD and --fail_on_hold was enabled.");
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Failed to generate cutover report: ${message}`);
  process.exitCode = 1;
});
