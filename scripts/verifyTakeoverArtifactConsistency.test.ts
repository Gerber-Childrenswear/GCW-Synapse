import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  checkProvenanceConsistency,
  checkVerdictConsistency,
  checkTimestampSanity,
  checkSourceFilesExist,
  buildConsistencySummary
} from "./verifyTakeoverArtifactConsistency";
import type {
  Provenance,
  CutoverStatus,
  TakeoverVerification,
  TakeoverConfidence,
  TakeoverRunbook,
  ManifestVerifySummary,
  ReleaseSignal
} from "./verifyTakeoverArtifactConsistency";

function buildProvenance(overrides: Partial<Provenance> = {}): Provenance {
  return {
    source: "github_actions",
    gitSha: "abc123",
    gitRef: "refs/heads/main",
    workflowName: "Takeover Readiness",
    workflowRunId: "999",
    workflowAttempt: "1",
    actor: "octocat",
    ...overrides
  };
}

function buildReleaseSignal(overrides: Partial<ReleaseSignal> = {}): ReleaseSignal {
  return {
    generated_at: new Date().toISOString(),
    verdict: "go",
    summary: {
      gateStatus: "go",
      contractStatus: "pass",
      confidenceVerdict: "ready",
      runbookVerdict: "go",
      manifestStatus: "pass"
    },
    provenance: buildProvenance(),
    sourceFiles: {
      cutoverStatusPath: "/tmp/cutover-gate-status.json",
      takeoverVerifyPath: "/tmp/takeover-verify-latest.json",
      confidencePath: "/tmp/takeover-confidence-latest.json",
      runbookPath: "/tmp/takeover-runbook-latest.json",
      manifestVerifyPath: "/tmp/takeover-artifact-manifest-verify-latest.json"
    },
    ...overrides
  };
}

function buildManifestVerify(overrides: Partial<ManifestVerifySummary> = {}): ManifestVerifySummary {
  return {
    generated_at: new Date().toISOString(),
    provenance: buildProvenance(),
    status: "pass",
    ...overrides
  };
}

function buildCutover(overrides: Partial<CutoverStatus> = {}): CutoverStatus {
  return { generated_at: new Date().toISOString(), status: "go", ...overrides };
}

function buildVerification(overrides: Partial<TakeoverVerification> = {}): TakeoverVerification {
  return { generated_at: new Date().toISOString(), summary: { status: "pass" }, ...overrides };
}

function buildConfidence(overrides: Partial<TakeoverConfidence> = {}): TakeoverConfidence {
  return { generated_at: new Date().toISOString(), verdict: "ready", ...overrides };
}

function buildRunbook(overrides: Partial<TakeoverRunbook> = {}): TakeoverRunbook {
  return { generated_at: new Date().toISOString(), verdict: "go", ...overrides };
}

test("happy path: coherent artifacts produce an all-pass consistency summary", () => {
  const manifestVerify = buildManifestVerify();
  const releaseSignal = buildReleaseSignal({ provenance: manifestVerify.provenance });

  const provenanceChecks = checkProvenanceConsistency(manifestVerify, releaseSignal);
  const verdictChecks = checkVerdictConsistency({
    cutover: buildCutover(),
    verification: buildVerification(),
    confidence: buildConfidence(),
    runbook: buildRunbook(),
    manifestVerify,
    releaseSignal
  });
  const timestampChecks = checkTimestampSanity(
    [{ name: "release_signal", generatedAt: releaseSignal.generated_at }],
    { now: new Date(), maxAgeMinutes: 1440, futureToleranceMinutes: 5 }
  );

  const summary = buildConsistencySummary({
    now: new Date(),
    maxAgeMinutes: 1440,
    futureToleranceMinutes: 5,
    provenance: releaseSignal.provenance,
    checks: [...provenanceChecks, ...verdictChecks, ...timestampChecks]
  });

  assert.equal(summary.status, "pass");
  assert.equal(summary.checksFailed, 0);
  assert.ok(summary.checks.every((check) => check.status === "pass"));
});

test("provenance mismatch between manifest verification and release signal fails", () => {
  const manifestVerify = buildManifestVerify({ provenance: buildProvenance({ gitSha: "abc123" }) });
  const releaseSignal = buildReleaseSignal({ provenance: buildProvenance({ gitSha: "def456" }) });

  const checks = checkProvenanceConsistency(manifestVerify, releaseSignal);
  const gitShaCheck = checks.find((check) => check.name === "provenance:gitSha");

  assert.ok(gitShaCheck);
  assert.equal(gitShaCheck?.status, "fail");
  assert.match(gitShaCheck?.details ?? "", /abc123/);
  assert.match(gitShaCheck?.details ?? "", /def456/);
});

test("verdict mismatch between a source artifact and the release signal summary fails", () => {
  const manifestVerify = buildManifestVerify();
  const releaseSignal = buildReleaseSignal({ provenance: manifestVerify.provenance });

  const checks = checkVerdictConsistency({
    cutover: buildCutover({ status: "hold" }),
    verification: buildVerification(),
    confidence: buildConfidence(),
    runbook: buildRunbook(),
    manifestVerify,
    releaseSignal
  });

  const gateCheck = checks.find((check) => check.name === "verdict:gate");
  assert.ok(gateCheck);
  assert.equal(gateCheck?.status, "fail");

  const summary = buildConsistencySummary({
    now: new Date(),
    maxAgeMinutes: 1440,
    futureToleranceMinutes: 5,
    provenance: releaseSignal.provenance,
    checks
  });
  assert.equal(summary.status, "fail");
});

test("release signal overall verdict inconsistent with its own component summary fails", () => {
  const manifestVerify = buildManifestVerify();
  const releaseSignal = buildReleaseSignal({
    provenance: manifestVerify.provenance,
    verdict: "go",
    summary: {
      gateStatus: "hold",
      contractStatus: "pass",
      confidenceVerdict: "ready",
      runbookVerdict: "go",
      manifestStatus: "pass"
    }
  });

  const checks = checkVerdictConsistency({
    cutover: buildCutover({ status: "hold" }),
    verification: buildVerification(),
    confidence: buildConfidence(),
    runbook: buildRunbook(),
    manifestVerify,
    releaseSignal
  });

  const overallCheck = checks.find((check) => check.name === "verdict:release_signal_overall");
  assert.ok(overallCheck);
  assert.equal(overallCheck?.status, "fail");
});

test("stale timestamp beyond max age window fails", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const staleGeneratedAt = new Date(now.getTime() - 2 * 24 * 60 * 60_000).toISOString();

  const checks = checkTimestampSanity([{ name: "release_signal", generatedAt: staleGeneratedAt }], {
    now,
    maxAgeMinutes: 1440,
    futureToleranceMinutes: 5
  });

  assert.equal(checks.length, 1);
  assert.equal(checks[0]?.status, "fail");
  assert.match(checks[0]?.details ?? "", /exceeds max age/);
});

test("timestamp generated in the future beyond tolerance fails", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const futureGeneratedAt = new Date(now.getTime() + 60 * 60_000).toISOString();

  const checks = checkTimestampSanity([{ name: "release_signal", generatedAt: futureGeneratedAt }], {
    now,
    maxAgeMinutes: 1440,
    futureToleranceMinutes: 5
  });

  assert.equal(checks[0]?.status, "fail");
  assert.match(checks[0]?.details ?? "", /future/);
});

test("timestamp within max age window and future tolerance passes", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const recentGeneratedAt = new Date(now.getTime() - 60_000).toISOString();

  const checks = checkTimestampSanity([{ name: "release_signal", generatedAt: recentGeneratedAt }], {
    now,
    maxAgeMinutes: 1440,
    futureToleranceMinutes: 5
  });

  assert.equal(checks[0]?.status, "pass");
});

test("checkSourceFilesExist flags missing referenced source files", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "synapse-consistency-"));
  const existingPath = path.join(tempDir, "takeover-verify-latest.json");
  fs.writeFileSync(existingPath, "{}", "utf8");
  const missingPath = path.join(tempDir, "does-not-exist.json");

  const checks = await checkSourceFilesExist({
    cutoverStatusPath: missingPath,
    takeoverVerifyPath: existingPath,
    confidencePath: missingPath,
    runbookPath: existingPath,
    manifestVerifyPath: existingPath
  });

  const cutoverCheck = checks.find((check) => check.name === "source_file:cutoverStatusPath");
  const verifyCheck = checks.find((check) => check.name === "source_file:takeoverVerifyPath");

  assert.equal(cutoverCheck?.status, "fail");
  assert.equal(verifyCheck?.status, "pass");
});
