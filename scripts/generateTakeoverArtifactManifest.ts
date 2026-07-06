import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

type ArtifactEntry = {
  name: string;
  path: string;
  sizeBytes: number;
  sha256: string;
};

type Manifest = {
  generated_at: string;
  artifact_dir: string;
  provenance: {
    source: "github_actions" | "local";
    gitSha: string | null;
    gitRef: string | null;
    workflowName: string | null;
    workflowRunId: string | null;
    workflowAttempt: string | null;
    actor: string | null;
  };
  artifacts: ArtifactEntry[];
};

function readProvenance(): Manifest["provenance"] {
  return {
    source: process.env.GITHUB_ACTIONS === "true" ? "github_actions" : "local",
    gitSha: process.env.GITHUB_SHA ?? null,
    gitRef: process.env.GITHUB_REF ?? null,
    workflowName: process.env.GITHUB_WORKFLOW ?? null,
    workflowRunId: process.env.GITHUB_RUN_ID ?? null,
    workflowAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    actor: process.env.GITHUB_ACTOR ?? null
  };
}

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

async function hashFile(filePath: string): Promise<{ sizeBytes: number; sha256: string }> {
  const data = await readFile(filePath);
  const sha256 = createHash("sha256").update(data).digest("hex");
  return { sizeBytes: data.byteLength, sha256 };
}

function artifactPath(outDir: string, fileName: string): string {
  return path.resolve(outDir, fileName);
}

async function main(): Promise<void> {
  const args = parseArgMap(process.argv.slice(2));
  const outDir = args.out_dir ?? path.resolve("docs", "reports", "cutover");

  const files = [
    "cutover-gate-status.json",
    "cutover-gate-latest.json",
    "takeover-verify-latest.json",
    "takeover-confidence-latest.json",
    "takeover-runbook-latest.json",
    "takeover-runbook-latest.md"
  ];

  const artifacts: ArtifactEntry[] = [];

  for (const fileName of files) {
    const filePath = artifactPath(outDir, fileName);
    try {
      const stats = await hashFile(filePath);
      artifacts.push({
        name: fileName,
        path: filePath,
        sizeBytes: stats.sizeBytes,
        sha256: stats.sha256
      });
    } catch (error) {
      if (error instanceof Error && "code" in error && (error as { code?: string }).code === "ENOENT") {
        throw new Error(`Missing required artifact for manifest: ${filePath}`);
      }

      throw error;
    }
  }

  const manifest: Manifest = {
    generated_at: new Date().toISOString(),
    artifact_dir: path.resolve(outDir),
    provenance: readProvenance(),
    artifacts
  };

  const jsonPath = artifactPath(outDir, "takeover-artifact-manifest.json");
  const latestPath = artifactPath(outDir, "takeover-artifact-manifest-latest.json");

  await writeFile(jsonPath, JSON.stringify(manifest, null, 2), "utf8");
  await writeFile(latestPath, JSON.stringify(manifest, null, 2), "utf8");

  console.log("Takeover artifact manifest generated:");
  console.log(`- JSON: ${jsonPath}`);
  console.log(`- Latest: ${latestPath}`);
  console.log(`- Artifacts hashed: ${artifacts.length}`);
  if (manifest.provenance.gitSha) {
    console.log(`- Git SHA: ${manifest.provenance.gitSha}`);
  }
  if (manifest.provenance.workflowRunId) {
    console.log(`- Workflow Run ID: ${manifest.provenance.workflowRunId}`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Failed to generate takeover artifact manifest: ${message}`);
  process.exitCode = 1;
});
