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

type ConfidenceSnapshot = {
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
  sourceFiles: {
    cutoverStatusPath: string;
    takeoverVerifyPath: string;
  };
};

function parseArgMap(argv: string[]): Record<string, string> {
  const map: Record<string, string> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token?.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      map[key] = "true";
      continue;
    }

    map[key] = value;
    i += 1;
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
        `Missing required artifact: ${filePath}. Run gtm:report:cutover and gtm:verify:takeover before computing confidence.`
      );
    }

    throw error;
  }
}

function toPct(value: number): number {
  return Number.parseFloat(value.toFixed(2));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildTimestamp(): string {
  return new Date().toISOString().replace(/[:T]/g, "-").replace(/\..+$/, "");
}

async function main(): Promise<void> {
  const args = parseArgMap(process.argv.slice(2));

  const outDir = args.out_dir ?? path.resolve("docs", "reports", "cutover");
  const thresholdPctRaw = args.min_confidence_pct ?? "95";
  const parsedThreshold = Number.parseFloat(thresholdPctRaw);
  const thresholdPct = Number.isFinite(parsedThreshold) ? clamp(parsedThreshold, 0, 100) : 95;
  const failOnLowConfidence = args.fail_on_low_confidence === "true";

  const cutoverStatusPath = path.resolve(outDir, "cutover-gate-status.json");
  const takeoverVerifyPath = path.resolve(outDir, "takeover-verify-latest.json");

  const cutover = await readJson<CutoverStatus>(cutoverStatusPath);
  const takeover = await readJson<TakeoverVerification>(takeoverVerifyPath);

  const gateReadinessPct = clamp(cutover.readinessScorePct, 0, 100);
  const totalContractChecks = takeover.summary.checksPassed + takeover.summary.checksFailed;
  const contractPassPct =
    totalContractChecks > 0 ? toPct((takeover.summary.checksPassed / totalContractChecks) * 100) : 0;

  const weightedScore = toPct(gateReadinessPct * 0.7 + contractPassPct * 0.3);

  const gatePenalty = cutover.status === "hold" ? 10 : 0;
  const contractPenalty = takeover.summary.status === "fail" ? 10 : 0;
  const scorePct = clamp(toPct(weightedScore - gatePenalty - contractPenalty), 0, 100);
  const verdict: "ready" | "not_ready" = scorePct >= thresholdPct ? "ready" : "not_ready";

  const snapshot: ConfidenceSnapshot = {
    generated_at: new Date().toISOString(),
    scorePct,
    thresholdPct,
    verdict,
    components: {
      gateReadinessPct,
      contractPassPct,
      gateStatus: cutover.status,
      contractStatus: takeover.summary.status
    },
    sourceFiles: {
      cutoverStatusPath,
      takeoverVerifyPath
    }
  };

  const ts = buildTimestamp();
  const reportPath = path.resolve(outDir, `takeover-confidence-${ts}.json`);
  const latestPath = path.resolve(outDir, "takeover-confidence-latest.json");

  await writeFile(reportPath, JSON.stringify(snapshot, null, 2), "utf8");
  await writeFile(latestPath, JSON.stringify(snapshot, null, 2), "utf8");

  console.log("Takeover confidence computed:");
  console.log(`- Score: ${snapshot.scorePct}%`);
  console.log(`- Threshold: ${snapshot.thresholdPct}%`);
  console.log(`- Verdict: ${snapshot.verdict.toUpperCase()}`);
  console.log(`- Report: ${reportPath}`);
  console.log(`- Latest: ${latestPath}`);

  if (failOnLowConfidence && snapshot.verdict === "not_ready") {
    throw new Error(
      `Takeover confidence ${snapshot.scorePct}% is below threshold ${snapshot.thresholdPct}% (fail_on_low_confidence enabled).`
    );
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Failed to compute takeover confidence: ${message}`);
  process.exitCode = 1;
});
