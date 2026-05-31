import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { evaluateLaunchGuard } from "./launchGuard";

test("evaluateLaunchGuard allows startup when strict mode disabled", () => {
  const result = evaluateLaunchGuard({
    strictEnabled: false,
    deadLetter: {
      configured: true,
      exists: true,
      total_records: 10,
      malformed_records: 0
    },
    maxDeadLetterRecords: 0,
    blockOnThemeConflicts: true,
    themeAuditPath: "./does-not-matter.md"
  });

  assert.equal(result.allowed, true);
  assert.equal(result.blockers.length, 0);
});

test("evaluateLaunchGuard blocks on dead-letter overflow and theme conflicts", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "synapse-guard-"));
  const auditPath = path.join(tempDir, "THEME_TRACKING_AUDIT.md");
  fs.writeFileSync(
    auditPath,
    [
      "# Theme Tracking Audit",
      "",
      "## Findings",
      "",
      "- Elevar and Triple Whale app embeds are both enabled. This can double-fire client events."
    ].join("\n"),
    "utf8"
  );

  const result = evaluateLaunchGuard({
    strictEnabled: true,
    deadLetter: {
      configured: true,
      exists: true,
      total_records: 2,
      malformed_records: 0
    },
    maxDeadLetterRecords: 0,
    blockOnThemeConflicts: true,
    themeAuditPath: auditPath
  });

  assert.equal(result.allowed, false);
  assert.ok(result.blockers.some((x) => x.includes("Dead-letter backlog")));
  assert.ok(result.blockers.some((x) => x.includes("Theme tracking conflict")));
});
