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
  artifacts: ArtifactEntry[];
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
      throw new Error(`Missing required manifest: ${filePath}`);
    }

    throw error;
  }
}

function sha256Of(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

async function main(): Promise<void> {
  const args = parseArgMap(process.argv.slice(2));
  const outDir = args.out_dir ?? path.resolve("docs", "reports", "cutover");
  const manifestPath = path.resolve(outDir, args.manifest ?? "takeover-artifact-manifest-latest.json");
  const failOnMismatch = args.fail_on_mismatch === "true";

  const manifest = await readJson<Manifest>(manifestPath);

  const results = [] as Array<{
    name: string;
    path: string;
    expectedSha256: string;
    actualSha256: string;
    expectedSizeBytes: number;
    actualSizeBytes: number;
    status: "match" | "mismatch";
  }>;

  for (const artifact of manifest.artifacts) {
    const filePath = path.isAbsolute(artifact.path) ? artifact.path : path.resolve(manifest.artifact_dir, artifact.path);
    let actualSha256 = "";
    let actualSizeBytes = 0;
    let status: "match" | "mismatch" = "mismatch";

    try {
      const data = await readFile(filePath);
      actualSha256 = sha256Of(data);
      actualSizeBytes = data.byteLength;
      status = actualSha256 === artifact.sha256 && actualSizeBytes === artifact.sizeBytes ? "match" : "mismatch";
    } catch (error) {
      if (error instanceof Error && "code" in error && (error as { code?: string }).code === "ENOENT") {
        actualSha256 = "missing";
        actualSizeBytes = 0;
        status = "mismatch";
      } else {
        throw error;
      }
    }

    results.push({
      name: artifact.name,
      path: filePath,
      expectedSha256: artifact.sha256,
      actualSha256,
      expectedSizeBytes: artifact.sizeBytes,
      actualSizeBytes,
      status
    });
  }

  const mismatches = results.filter((result) => result.status === "mismatch");
  const summary = {
    generated_at: new Date().toISOString(),
    manifest_path: manifestPath,
    artifact_count: manifest.artifacts.length,
    match_count: results.length - mismatches.length,
    mismatch_count: mismatches.length,
    status: mismatches.length === 0 ? "pass" : "fail",
    results
  };

  const summaryPath = path.resolve(outDir, "takeover-artifact-manifest-verify-latest.json");
  await writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf8");

  console.log("Takeover artifact manifest verification complete:");
  console.log(`- Manifest: ${manifestPath}`);
  console.log(`- Summary: ${summaryPath}`);
  console.log(`- Status: ${summary.status.toUpperCase()}`);
  console.log(`- Artifacts checked: ${summary.artifact_count}`);

  if (failOnMismatch && mismatches.length > 0) {
    const names = mismatches.map((result) => result.name).join(", ");
    throw new Error(`Manifest verification failed for: ${names}`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Failed to verify takeover artifact manifest: ${message}`);
  process.exitCode = 1;
});
