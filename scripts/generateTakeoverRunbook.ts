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
  base_url: string;
  gate: {
    status: "go" | "hold";
    readinessScorePct: number;
    checksPassed: number;
    checksFailed: number;
  };
  summary: {
    checksPassed: number;
    checksFailed: number;
    status: "pass" | "fail";
  };
  checks: Array<{
    name: string;
    status: "pass" | "fail";
    details: string;
  }>;
};

type TakeoverConfidence = {
  generated_at: string;
  scorePct: number;
  thresholdPct: number;
  verdict: "ready" | "not_ready";
  components: {
    gateReadinessPct: number;
    contractPassPct: number;
    gateStatus: "go" | "hold";
    contractStatus: "pass" | "fail";
  };
};

type DecisionPacket = {
  generated_at: string;
  verdict: "go" | "hold";
  confidencePct: number;
  confidenceThresholdPct: number;
  executiveSummary: string;
  highlights: string[];
  blockers: string[];
  nextActions: string[];
  sources: {
    cutoverStatusPath: string;
    takeoverVerifyPath: string;
    confidencePath: string;
    manifestPath: string;
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
    const text = await readFile(filePath, "utf8");
    return JSON.parse(text) as T;
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "ENOENT") {
      throw new Error(
        `Missing required artifact: ${filePath}. Run cutover, takeover verification, and confidence generation first.`
      );
    }

    throw error;
  }
}

function timestampSlug(date = new Date()): string {
  return date.toISOString().replace(/[:T]/g, "-").replace(/\..+$/, "");
}

function buildDecisionPacket(input: {
  cutover: CutoverStatus;
  verification: TakeoverVerification;
  confidence: TakeoverConfidence;
  sourcePaths: {
    cutoverStatusPath: string;
    takeoverVerifyPath: string;
    confidencePath: string;
  };
}): DecisionPacket {
  const blockers: string[] = [];

  if (input.cutover.status !== "go") {
    blockers.push("Cutover gate status is HOLD.");
  }

  if (input.verification.summary.status !== "pass") {
    blockers.push(
      `Contract verification has ${input.verification.summary.checksFailed} failing checks (${input.verification.summary.checksPassed} pass / ${input.verification.summary.checksFailed} fail).`
    );
  }

  if (input.confidence.verdict !== "ready") {
    blockers.push(
      `Confidence index is below threshold (${input.confidence.scorePct}% vs ${input.confidence.thresholdPct}%).`
    );
  }

  const verdict: "go" | "hold" = blockers.length === 0 ? "go" : "hold";

  const highlights = [
    `Gate readiness score: ${input.cutover.readinessScorePct}% (${input.cutover.checksPassed} pass / ${input.cutover.checksFailed} fail).`,
    `Contract checks: ${input.verification.summary.checksPassed} pass / ${input.verification.summary.checksFailed} fail.`,
    `Confidence score: ${input.confidence.scorePct}% (threshold ${input.confidence.thresholdPct}%).`
  ];

  const nextActions =
    verdict === "go"
      ? [
          "Proceed with phased Elevar disablement and confirm destination telemetry stability post-cutover.",
          "Continue scheduled readiness automation as a post-cutover safeguard.",
          "Archive this decision packet with release documentation."
        ]
      : [
          "Review the latest strict readiness workflow artifacts and failed checks.",
          "Resolve gate/contract failures and rerun strict readiness workflow.",
          "Require confidence index to meet threshold before attempting production cutover again."
        ];

  const manifestPath = path.resolve(path.dirname(input.sourcePaths.cutoverStatusPath), "takeover-artifact-manifest-latest.json");
  const sourcePaths = {
    ...input.sourcePaths,
    manifestPath
  };

  const executiveSummary =
    verdict === "go"
      ? "All automated readiness controls are green. Synapse is approved to take over Elevar under the configured thresholds."
      : "Readiness controls indicate unresolved risk. Synapse should not replace Elevar until blockers are resolved.";

  return {
    generated_at: new Date().toISOString(),
    verdict,
    confidencePct: input.confidence.scorePct,
    confidenceThresholdPct: input.confidence.thresholdPct,
    executiveSummary,
    highlights,
    blockers,
    nextActions,
    sources: sourcePaths
  };
}

function renderRunbookMarkdown(packet: DecisionPacket): string {
  const lines: string[] = [];
  lines.push("# Synapse Takeover Decision Packet");
  lines.push("");
  lines.push(`- Generated At: ${packet.generated_at}`);
  lines.push(`- Verdict: ${packet.verdict.toUpperCase()}`);
  lines.push(`- Confidence: ${packet.confidencePct}% (threshold ${packet.confidenceThresholdPct}%)`);
  lines.push("");
  lines.push("## Executive Summary");
  lines.push("");
  lines.push(packet.executiveSummary);
  lines.push("");
  lines.push("## Highlights");
  lines.push("");
  for (const item of packet.highlights) {
    lines.push(`- ${item}`);
  }
  lines.push("");
  lines.push("## Blockers");
  lines.push("");
  if (packet.blockers.length === 0) {
    lines.push("- None");
  } else {
    for (const blocker of packet.blockers) {
      lines.push(`- ${blocker}`);
    }
  }
  lines.push("");
  lines.push("## Next Actions");
  lines.push("");
  for (const action of packet.nextActions) {
    lines.push(`- ${action}`);
  }
  lines.push("");
  lines.push("## Source Artifacts");
  lines.push("");
  lines.push(`- Cutover Status: ${packet.sources.cutoverStatusPath}`);
  lines.push(`- Takeover Verification: ${packet.sources.takeoverVerifyPath}`);
  lines.push(`- Confidence Snapshot: ${packet.sources.confidencePath}`);
  lines.push(`- Artifact Manifest: ${packet.sources.manifestPath}`);

  return lines.join("\n");
}

async function main(): Promise<void> {
  const args = parseArgMap(process.argv.slice(2));
  const outDir = args.out_dir ?? path.resolve("docs", "reports", "cutover");
  const failOnHold = args.fail_on_hold === "true";

  const cutoverStatusPath = path.resolve(outDir, "cutover-gate-status.json");
  const takeoverVerifyPath = path.resolve(outDir, "takeover-verify-latest.json");
  const confidencePath = path.resolve(outDir, "takeover-confidence-latest.json");

  const cutover = await readJson<CutoverStatus>(cutoverStatusPath);
  const verification = await readJson<TakeoverVerification>(takeoverVerifyPath);
  const confidence = await readJson<TakeoverConfidence>(confidencePath);

  const packet = buildDecisionPacket({
    cutover,
    verification,
    confidence,
    sourcePaths: {
      cutoverStatusPath,
      takeoverVerifyPath,
      confidencePath
    }
  });

  const ts = timestampSlug();
  const jsonPath = path.resolve(outDir, `takeover-runbook-${ts}.json`);
  const mdPath = path.resolve(outDir, `takeover-runbook-${ts}.md`);
  const latestJsonPath = path.resolve(outDir, "takeover-runbook-latest.json");
  const latestMdPath = path.resolve(outDir, "takeover-runbook-latest.md");

  const markdown = renderRunbookMarkdown(packet);

  await writeFile(jsonPath, JSON.stringify(packet, null, 2), "utf8");
  await writeFile(mdPath, markdown, "utf8");
  await writeFile(latestJsonPath, JSON.stringify(packet, null, 2), "utf8");
  await writeFile(latestMdPath, markdown, "utf8");

  console.log("Takeover runbook generated:");
  console.log(`- JSON: ${jsonPath}`);
  console.log(`- Markdown: ${mdPath}`);
  console.log(`- Latest JSON: ${latestJsonPath}`);
  console.log(`- Latest Markdown: ${latestMdPath}`);
  console.log(`- Verdict: ${packet.verdict.toUpperCase()}`);

  if (failOnHold && packet.verdict === "hold") {
    throw new Error("Runbook verdict is HOLD and fail_on_hold was enabled.");
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Failed to generate takeover runbook: ${message}`);
  process.exitCode = 1;
});
