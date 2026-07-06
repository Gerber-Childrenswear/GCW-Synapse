import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Provenance = {
  source: "github_actions" | "local";
  gitSha: string | null;
  gitRef: string | null;
  workflowName: string | null;
  workflowRunId: string | null;
  workflowAttempt: string | null;
  actor: string | null;
};

type CutoverStatus = {
  generated_at: string;
  status: "go" | "hold";
};

type TakeoverVerification = {
  generated_at: string;
  summary: {
    status: "pass" | "fail";
  };
};

type TakeoverConfidence = {
  generated_at: string;
  verdict: "ready" | "not_ready";
};

type TakeoverRunbook = {
  generated_at: string;
  verdict: "go" | "hold";
};

type ManifestVerifySummary = {
  generated_at: string;
  provenance: Provenance;
  status: "pass" | "fail";
};

type ReleaseSignal = {
  generated_at: string;
  verdict: "go" | "hold";
  summary: {
    gateStatus: "go" | "hold";
    contractStatus: "pass" | "fail";
    confidenceVerdict: "ready" | "not_ready";
    runbookVerdict: "go" | "hold";
    manifestStatus: "pass" | "fail";
  };
  provenance: Provenance;
  sourceFiles: {
    cutoverStatusPath: string;
    takeoverVerifyPath: string;
    confidencePath: string;
    runbookPath: string;
    manifestVerifyPath: string;
  };
};

type ConsistencyCheck = {
  name: string;
  status: "pass" | "fail";
  details: string;
};

type ConsistencySummary = {
  generated_at: string;
  max_age_minutes: number;
  future_tolerance_minutes: number;
  provenance: Provenance;
  checks: ConsistencyCheck[];
  checksPassed: number;
  checksFailed: number;
  status: "pass" | "fail";
};

const PROVENANCE_FIELDS = ["gitSha", "gitRef", "workflowRunId"] as const;

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
    const text = await readFile(filePath, "utf8");
    return JSON.parse(text) as T;
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

function checkProvenanceConsistency(
  manifestVerify: ManifestVerifySummary,
  releaseSignal: ReleaseSignal
): ConsistencyCheck[] {
  return PROVENANCE_FIELDS.map((field) => {
    const manifestValue = manifestVerify.provenance[field];
    const releaseValue = releaseSignal.provenance[field];
    const status = manifestValue === releaseValue ? "pass" : "fail";
    return {
      name: `provenance:${field}`,
      status,
      details: `manifest_verify=${manifestValue ?? "null"} release_signal=${releaseValue ?? "null"}`
    };
  });
}

function checkVerdictConsistency(input: {
  cutover: CutoverStatus;
  verification: TakeoverVerification;
  confidence: TakeoverConfidence;
  runbook: TakeoverRunbook;
  manifestVerify: ManifestVerifySummary;
  releaseSignal: ReleaseSignal;
}): ConsistencyCheck[] {
  const checks: ConsistencyCheck[] = [];

  checks.push({
    name: "verdict:gate",
    status: input.cutover.status === input.releaseSignal.summary.gateStatus ? "pass" : "fail",
    details: `gate=${input.cutover.status} release_signal.gateStatus=${input.releaseSignal.summary.gateStatus}`
  });

  checks.push({
    name: "verdict:contract",
    status: input.verification.summary.status === input.releaseSignal.summary.contractStatus ? "pass" : "fail",
    details: `verification=${input.verification.summary.status} release_signal.contractStatus=${input.releaseSignal.summary.contractStatus}`
  });

  checks.push({
    name: "verdict:confidence",
    status: input.confidence.verdict === input.releaseSignal.summary.confidenceVerdict ? "pass" : "fail",
    details: `confidence=${input.confidence.verdict} release_signal.confidenceVerdict=${input.releaseSignal.summary.confidenceVerdict}`
  });

  checks.push({
    name: "verdict:runbook",
    status: input.runbook.verdict === input.releaseSignal.summary.runbookVerdict ? "pass" : "fail",
    details: `runbook=${input.runbook.verdict} release_signal.runbookVerdict=${input.releaseSignal.summary.runbookVerdict}`
  });

  checks.push({
    name: "verdict:manifest",
    status: input.manifestVerify.status === input.releaseSignal.summary.manifestStatus ? "pass" : "fail",
    details: `manifest_verify=${input.manifestVerify.status} release_signal.manifestStatus=${input.releaseSignal.summary.manifestStatus}`
  });

  const expectedOverallVerdict: "go" | "hold" =
    input.releaseSignal.summary.gateStatus === "go" &&
    input.releaseSignal.summary.contractStatus === "pass" &&
    input.releaseSignal.summary.confidenceVerdict === "ready" &&
    input.releaseSignal.summary.runbookVerdict === "go" &&
    input.releaseSignal.summary.manifestStatus === "pass"
      ? "go"
      : "hold";

  checks.push({
    name: "verdict:release_signal_overall",
    status: expectedOverallVerdict === input.releaseSignal.verdict ? "pass" : "fail",
    details: `expected=${expectedOverallVerdict} release_signal.verdict=${input.releaseSignal.verdict}`
  });

  return checks;
}

function checkTimestampSanity(
  artifacts: Array<{ name: string; generatedAt: string }>,
  options: { now: Date; maxAgeMinutes: number; futureToleranceMinutes: number }
): ConsistencyCheck[] {
  const futureToleranceMs = options.futureToleranceMinutes * 60_000;
  const maxAgeMs = options.maxAgeMinutes * 60_000;

  return artifacts.map((artifact) => {
    const parsed = new Date(artifact.generatedAt);
    if (Number.isNaN(parsed.getTime())) {
      return {
        name: `timestamp:${artifact.name}`,
        status: "fail",
        details: `Invalid generated_at value: ${artifact.generatedAt}`
      };
    }

    const ageMs = options.now.getTime() - parsed.getTime();

    if (ageMs < -futureToleranceMs) {
      return {
        name: `timestamp:${artifact.name}`,
        status: "fail",
        details: `Artifact generated_at (${artifact.generatedAt}) is in the future relative to now (${options.now.toISOString()}).`
      };
    }

    if (ageMs > maxAgeMs) {
      return {
        name: `timestamp:${artifact.name}`,
        status: "fail",
        details: `Artifact age ${Math.round(ageMs / 60_000)}m exceeds max age ${options.maxAgeMinutes}m (generated_at=${artifact.generatedAt}).`
      };
    }

    return {
      name: `timestamp:${artifact.name}`,
      status: "pass",
      details: `Artifact age ${Math.round(ageMs / 60_000)}m within max age ${options.maxAgeMinutes}m.`
    };
  });
}

async function checkSourceFilesExist(sourceFiles: ReleaseSignal["sourceFiles"]): Promise<ConsistencyCheck[]> {
  const entries = Object.entries(sourceFiles) as Array<[keyof ReleaseSignal["sourceFiles"], string]>;

  return Promise.all(
    entries.map(async ([key, filePath]) => {
      try {
        await access(filePath);
        return {
          name: `source_file:${key}`,
          status: "pass" as const,
          details: `Found ${filePath}`
        };
      } catch {
        return {
          name: `source_file:${key}`,
          status: "fail" as const,
          details: `Missing referenced source file: ${filePath}`
        };
      }
    })
  );
}

function buildConsistencySummary(input: {
  now: Date;
  maxAgeMinutes: number;
  futureToleranceMinutes: number;
  provenance: Provenance;
  checks: ConsistencyCheck[];
}): ConsistencySummary {
  const checksFailed = input.checks.filter((check) => check.status === "fail").length;

  return {
    generated_at: input.now.toISOString(),
    max_age_minutes: input.maxAgeMinutes,
    future_tolerance_minutes: input.futureToleranceMinutes,
    provenance: input.provenance,
    checks: input.checks,
    checksPassed: input.checks.length - checksFailed,
    checksFailed,
    status: checksFailed === 0 ? "pass" : "fail"
  };
}

function renderMarkdown(summary: ConsistencySummary): string {
  const lines: string[] = [];
  lines.push("# Synapse Takeover Artifact Consistency");
  lines.push("");
  lines.push(`- Generated At: ${summary.generated_at}`);
  lines.push(`- Status: ${summary.status.toUpperCase()}`);
  lines.push(`- Checks Passed: ${summary.checksPassed}`);
  lines.push(`- Checks Failed: ${summary.checksFailed}`);
  lines.push("");
  lines.push("## Checks");
  lines.push("");
  for (const check of summary.checks) {
    lines.push(`- [${check.status.toUpperCase()}] ${check.name}: ${check.details}`);
  }

  return lines.join("\n");
}

async function main(): Promise<void> {
  const args = parseArgMap(process.argv.slice(2));
  const outDir = args.out_dir ?? path.resolve("docs", "reports", "cutover");
  const failOnMismatch = args.fail_on_mismatch === "true";

  const maxAgeMinutesRaw = args.max_age_minutes ?? "1440";
  const parsedMaxAge = Number.parseFloat(maxAgeMinutesRaw);
  const maxAgeMinutes = Number.isFinite(parsedMaxAge) && parsedMaxAge > 0 ? parsedMaxAge : 1440;

  const futureToleranceMinutesRaw = args.future_tolerance_minutes ?? "5";
  const parsedFutureTolerance = Number.parseFloat(futureToleranceMinutesRaw);
  const futureToleranceMinutes =
    Number.isFinite(parsedFutureTolerance) && parsedFutureTolerance >= 0 ? parsedFutureTolerance : 5;

  const cutoverStatusPath = path.resolve(outDir, "cutover-gate-status.json");
  const takeoverVerifyPath = path.resolve(outDir, "takeover-verify-latest.json");
  const confidencePath = path.resolve(outDir, "takeover-confidence-latest.json");
  const runbookPath = path.resolve(outDir, "takeover-runbook-latest.json");
  const manifestVerifyPath = path.resolve(outDir, "takeover-artifact-manifest-verify-latest.json");
  const releaseSignalPath = path.resolve(outDir, "takeover-release-signal-latest.json");

  const cutover = await readJson<CutoverStatus>(cutoverStatusPath);
  const verification = await readJson<TakeoverVerification>(takeoverVerifyPath);
  const confidence = await readJson<TakeoverConfidence>(confidencePath);
  const runbook = await readJson<TakeoverRunbook>(runbookPath);
  const manifestVerify = await readJson<ManifestVerifySummary>(manifestVerifyPath);
  const releaseSignal = await readJson<ReleaseSignal>(releaseSignalPath);

  const now = new Date();

  const checks: ConsistencyCheck[] = [
    ...checkProvenanceConsistency(manifestVerify, releaseSignal),
    ...checkVerdictConsistency({ cutover, verification, confidence, runbook, manifestVerify, releaseSignal }),
    ...checkTimestampSanity(
      [
        { name: "cutover", generatedAt: cutover.generated_at },
        { name: "verification", generatedAt: verification.generated_at },
        { name: "confidence", generatedAt: confidence.generated_at },
        { name: "runbook", generatedAt: runbook.generated_at },
        { name: "manifest_verify", generatedAt: manifestVerify.generated_at },
        { name: "release_signal", generatedAt: releaseSignal.generated_at }
      ],
      { now, maxAgeMinutes, futureToleranceMinutes }
    ),
    ...(await checkSourceFilesExist(releaseSignal.sourceFiles))
  ];

  const summary = buildConsistencySummary({
    now,
    maxAgeMinutes,
    futureToleranceMinutes,
    provenance: releaseSignal.provenance,
    checks
  });

  const ts = timestampSlug(now);
  const jsonPath = path.resolve(outDir, `takeover-artifact-consistency-${ts}.json`);
  const mdPath = path.resolve(outDir, `takeover-artifact-consistency-${ts}.md`);
  const latestJsonPath = path.resolve(outDir, "takeover-artifact-consistency-latest.json");
  const latestMdPath = path.resolve(outDir, "takeover-artifact-consistency-latest.md");

  const markdown = renderMarkdown(summary);

  await writeFile(jsonPath, JSON.stringify(summary, null, 2), "utf8");
  await writeFile(mdPath, markdown, "utf8");
  await writeFile(latestJsonPath, JSON.stringify(summary, null, 2), "utf8");
  await writeFile(latestMdPath, markdown, "utf8");

  console.log("Takeover artifact consistency verification complete:");
  console.log(`- JSON: ${jsonPath}`);
  console.log(`- Markdown: ${mdPath}`);
  console.log(`- Latest JSON: ${latestJsonPath}`);
  console.log(`- Latest Markdown: ${latestMdPath}`);
  console.log(`- Status: ${summary.status.toUpperCase()}`);
  console.log(`- Checks: ${summary.checksPassed} pass / ${summary.checksFailed} fail`);

  if (failOnMismatch && summary.status === "fail") {
    const failingNames = summary.checks
      .filter((check) => check.status === "fail")
      .map((check) => check.name)
      .join(", ");
    throw new Error(`Artifact consistency verification failed for: ${failingNames}`);
  }
}

export {
  checkProvenanceConsistency,
  checkVerdictConsistency,
  checkTimestampSanity,
  checkSourceFilesExist,
  buildConsistencySummary,
  renderMarkdown
};
export type {
  Provenance,
  CutoverStatus,
  TakeoverVerification,
  TakeoverConfidence,
  TakeoverRunbook,
  ManifestVerifySummary,
  ReleaseSignal,
  ConsistencyCheck,
  ConsistencySummary
};

if (require.main === module) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Failed to verify takeover artifact consistency: ${message}`);
    process.exitCode = 1;
  });
}
