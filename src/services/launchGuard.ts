import fs from "node:fs";
import path from "node:path";
import type { DeadLetterSummary } from "./deadLetter";

export type LaunchGuardInput = {
  strictEnabled: boolean;
  deadLetter: DeadLetterSummary;
  maxDeadLetterRecords: number;
  blockOnThemeConflicts: boolean;
  themeAuditPath: string;
};

function readThemeAuditFindings(themeAuditPath: string): string[] {
  const absolutePath = path.resolve(themeAuditPath);
  if (!fs.existsSync(absolutePath)) {
    return [`Theme tracking audit report not found at ${absolutePath}`];
  }

  const content = fs.readFileSync(absolutePath, "utf8");
  const findingsSection = content.split("## Findings")[1] ?? "";
  const rawLines = findingsSection
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());

  return rawLines.filter((line) => line.length > 0 && !line.startsWith("No high-risk overlap"));
}

export function evaluateLaunchGuard(input: LaunchGuardInput): { allowed: boolean; blockers: string[] } {
  if (!input.strictEnabled) {
    return { allowed: true, blockers: [] };
  }

  const blockers: string[] = [];

  if (input.deadLetter.total_records > input.maxDeadLetterRecords) {
    blockers.push(
      `Dead-letter backlog ${input.deadLetter.total_records} exceeds allowed ${input.maxDeadLetterRecords}.`
    );
  }

  if (input.blockOnThemeConflicts) {
    const findings = readThemeAuditFindings(input.themeAuditPath);
    for (const finding of findings) {
      blockers.push(`Theme tracking conflict: ${finding}`);
    }
  }

  return {
    allowed: blockers.length === 0,
    blockers
  };
}
