import { readFile } from "node:fs/promises";
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

async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as T;
}

function statusEmoji(status: "go" | "hold" | "pass" | "fail"): string {
  if (status === "go" || status === "pass") {
    return "SUCCESS";
  }

  return "ATTENTION";
}

async function main(): Promise<void> {
  const args = parseArgMap(process.argv.slice(2));

  const outDir = args.out_dir ?? path.resolve("docs", "reports", "cutover");
  const webhookUrl =
    args.webhook_url ?? process.env.TAKEOVER_NOTIFY_WEBHOOK_URL ?? process.env.SLACK_WEBHOOK_URL ?? process.env.TEAMS_WEBHOOK_URL;

  if (!webhookUrl) {
    throw new Error(
      "Missing webhook URL. Set TAKEOVER_NOTIFY_WEBHOOK_URL (or SLACK_WEBHOOK_URL / TEAMS_WEBHOOK_URL), or pass --webhook_url <value>."
    );
  }

  const cutoverPath = path.resolve(outDir, "cutover-gate-status.json");
  const takeoverPath = path.resolve(outDir, "takeover-verify-latest.json");

  const cutover = await readJsonFile<CutoverStatus>(cutoverPath);
  const takeover = await readJsonFile<TakeoverVerification>(takeoverPath);

  const headline = `${statusEmoji(cutover.status)} Synapse takeover status: ${cutover.status.toUpperCase()}`;
  const bodyLines = [
    `Cutover score: ${cutover.readinessScorePct}% (${cutover.checksPassed} pass / ${cutover.checksFailed} fail)`,
    `Takeover contracts: ${takeover.summary.status.toUpperCase()} (${takeover.summary.checksPassed} pass / ${takeover.summary.checksFailed} fail)`,
    `Endpoint: ${cutover.endpoint}`,
    `Generated: ${cutover.generated_at}`
  ];

  const payload = {
    text: `${headline}\n${bodyLines.join("\n")}`
  };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Webhook notification failed (${response.status}): ${responseText}`);
  }

  console.log("Takeover notification sent.");
  console.log(`- Headline: ${headline}`);
  console.log(`- Cutover file: ${cutoverPath}`);
  console.log(`- Verification file: ${takeoverPath}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Failed to notify takeover status: ${message}`);
  process.exitCode = 1;
});
