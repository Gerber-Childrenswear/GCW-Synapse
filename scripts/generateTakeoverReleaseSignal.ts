import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CutoverStatus = {
  generated_at: string;
  status: "go" | "hold";
  readinessScorePct: number;
  checksPassed: number;
  checksFailed: number;
  endpoint: string;
};

type TakeoverVerification = {
  generated_at: string;
  summary: {
    checksPassed: number;
    checksFailed: number;
    status: "pass" | "fail";
  };
};

type TakeoverConfidence = {
  generated_at: string;
  scorePct: number;
  thresholdPct: number;
  verdict: "ready" | "not_ready";
};

type TakeoverRunbook = {
  generated_at: string;
  verdict: "go" | "hold";
  executiveSummary: string;
};

type ManifestVerifySummary = {
  generated_at: string;
  provenance: {
    source: "github_actions" | "local";
    gitSha: string | null;
    gitRef: string | null;
    workflowName: string | null;
    workflowRunId: string | null;
    workflowAttempt: string | null;
    actor: string | null;
  };
  artifact_count: number;
  mismatch_count: number;
  status: "pass" | "fail";
};

type ReleaseSignal = {
  generated_at: string;
  verdict: "go" | "hold";
  reasons: string[];
  summary: {
    gateStatus: "go" | "hold";
    gateReadinessScorePct: number;
    contractStatus: "pass" | "fail";
    contractChecksPassed: number;
    contractChecksFailed: number;
    confidenceVerdict: "ready" | "not_ready";
    confidenceScorePct: number;
    confidenceThresholdPct: number;
    runbookVerdict: "go" | "hold";
    manifestStatus: "pass" | "fail";
    manifestMismatchCount: number;
  };
  provenance: ManifestVerifySummary["provenance"];
  sourceFiles: {
    cutoverStatusPath: string;
    takeoverVerifyPath: string;
    confidencePath: string;
    runbookPath: string;
    manifestVerifyPath: string;
  };
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

async function readJson<T>(filePath: string): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "ENOENT") {
      throw new Error(`Missing required artifact: ${filePath}`);
    }

    throw error;
  }
}

function timestampSlug(date = new Date()): string {
  return date.toISOString().replace(/[:T]/g, "-").replace(/\..+$/, "");
}

function renderMarkdown(signal: ReleaseSignal): string {
  const lines: string[] = [];
  lines.push("# Synapse Takeover Release Signal");
  lines.push("");
  lines.push(`- Generated At: ${signal.generated_at}`);
  lines.push(`- Verdict: ${signal.verdict.toUpperCase()}`);
  lines.push(`- Gate Status: ${signal.summary.gateStatus.toUpperCase()} (${signal.summary.gateReadinessScorePct}%)`);
  lines.push(`- Contract Status: ${signal.summary.contractStatus.toUpperCase()} (${signal.summary.contractChecksPassed} pass / ${signal.summary.contractChecksFailed} fail)`);
  lines.push(`- Confidence: ${signal.summary.confidenceVerdict.toUpperCase()} (${signal.summary.confidenceScorePct}% / threshold ${signal.summary.confidenceThresholdPct}%)`);
  lines.push(`- Runbook Verdict: ${signal.summary.runbookVerdict.toUpperCase()}`);
  lines.push(`- Manifest Verification: ${signal.summary.manifestStatus.toUpperCase()} (${signal.summary.manifestMismatchCount} mismatches)`);
  lines.push("");
  lines.push("## Reasons");
  lines.push("");
  if (signal.reasons.length === 0) {
    lines.push("- None");
  } else {
    for (const reason of signal.reasons) {
      lines.push(`- ${reason}`);
    }
  }
  lines.push("");
  lines.push("## Provenance");
  lines.push("");
  lines.push(`- Source: ${signal.provenance.source}`);
  lines.push(`- Git SHA: ${signal.provenance.gitSha ?? "n/a"}`);
  lines.push(`- Git Ref: ${signal.provenance.gitRef ?? "n/a"}`);
  lines.push(`- Workflow: ${signal.provenance.workflowName ?? "n/a"}`);
  lines.push(`- Workflow Run ID: ${signal.provenance.workflowRunId ?? "n/a"}`);
  lines.push(`- Workflow Attempt: ${signal.provenance.workflowAttempt ?? "n/a"}`);
  lines.push(`- Actor: ${signal.provenance.actor ?? "n/a"}`);

  return lines.join("\n");
}

async function main(): Promise<void> {
  const args = parseArgMap(process.argv.slice(2));
  const outDir = args.out_dir ?? path.resolve("docs", "reports", "cutover");
  const failOnHold = args.fail_on_hold === "true";

  const cutoverStatusPath = path.resolve(outDir, "cutover-gate-status.json");
  const takeoverVerifyPath = path.resolve(outDir, "takeover-verify-latest.json");
  const confidencePath = path.resolve(outDir, "takeover-confidence-latest.json");
  const runbookPath = path.resolve(outDir, "takeover-runbook-latest.json");
  const manifestVerifyPath = path.resolve(outDir, "takeover-artifact-manifest-verify-latest.json");

  const cutover = await readJson<CutoverStatus>(cutoverStatusPath);
  const verification = await readJson<TakeoverVerification>(takeoverVerifyPath);
  const confidence = await readJson<TakeoverConfidence>(confidencePath);
  const runbook = await readJson<TakeoverRunbook>(runbookPath);
  const manifestVerify = await readJson<ManifestVerifySummary>(manifestVerifyPath);

  const reasons: string[] = [];
  if (cutover.status !== "go") {
    reasons.push("Cutover gate status is HOLD.");
  }
  if (verification.summary.status !== "pass") {
    reasons.push(
      `Contract verification failed (${verification.summary.checksFailed} failing checks).`
    );
  }
  if (confidence.verdict !== "ready") {
    reasons.push(`Confidence is below threshold (${confidence.scorePct}% vs ${confidence.thresholdPct}%).`);
  }
  if (runbook.verdict !== "go") {
    reasons.push("Runbook verdict is HOLD.");
  }
  if (manifestVerify.status !== "pass") {
    reasons.push(`Artifact manifest verification failed (${manifestVerify.mismatch_count} mismatches).`);
  }

  const signal: ReleaseSignal = {
    generated_at: new Date().toISOString(),
    verdict: reasons.length === 0 ? "go" : "hold",
    reasons,
    summary: {
      gateStatus: cutover.status,
      gateReadinessScorePct: cutover.readinessScorePct,
      contractStatus: verification.summary.status,
      contractChecksPassed: verification.summary.checksPassed,
      contractChecksFailed: verification.summary.checksFailed,
      confidenceVerdict: confidence.verdict,
      confidenceScorePct: confidence.scorePct,
      confidenceThresholdPct: confidence.thresholdPct,
      runbookVerdict: runbook.verdict,
      manifestStatus: manifestVerify.status,
      manifestMismatchCount: manifestVerify.mismatch_count
    },
    provenance: manifestVerify.provenance,
    sourceFiles: {
      cutoverStatusPath,
      takeoverVerifyPath,
      confidencePath,
      runbookPath,
      manifestVerifyPath
    }
  };

  const ts = timestampSlug();
  const jsonPath = path.resolve(outDir, `takeover-release-signal-${ts}.json`);
  const mdPath = path.resolve(outDir, `takeover-release-signal-${ts}.md`);
  const latestJsonPath = path.resolve(outDir, "takeover-release-signal-latest.json");
  const latestMdPath = path.resolve(outDir, "takeover-release-signal-latest.md");

  await writeFile(jsonPath, JSON.stringify(signal, null, 2), "utf8");
  await writeFile(mdPath, renderMarkdown(signal), "utf8");
  await writeFile(latestJsonPath, JSON.stringify(signal, null, 2), "utf8");
  await writeFile(latestMdPath, renderMarkdown(signal), "utf8");

  console.log("Takeover release signal generated:");
  console.log(`- JSON: ${jsonPath}`);
  console.log(`- Markdown: ${mdPath}`);
  console.log(`- Latest JSON: ${latestJsonPath}`);
  console.log(`- Latest Markdown: ${latestMdPath}`);
  console.log(`- Verdict: ${signal.verdict.toUpperCase()}`);

  if (failOnHold && signal.verdict === "hold") {
    throw new Error("Release signal verdict is HOLD and fail_on_hold was enabled.");
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Failed to generate takeover release signal: ${message}`);
  process.exitCode = 1;
});
