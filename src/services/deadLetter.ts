import fs from "node:fs";
import path from "node:path";

export type DeadLetterSummary = {
  configured: boolean;
  path?: string;
  exists: boolean;
  total_records: number;
  malformed_records: number;
  last_recorded_at?: string;
};

export function getDeadLetterSummary(deadLetterPath?: string): DeadLetterSummary {
  if (!deadLetterPath) {
    return {
      configured: false,
      exists: false,
      total_records: 0,
      malformed_records: 0
    };
  }

  const absolutePath = path.resolve(deadLetterPath);
  if (!fs.existsSync(absolutePath)) {
    return {
      configured: true,
      path: absolutePath,
      exists: false,
      total_records: 0,
      malformed_records: 0
    };
  }

  const raw = fs.readFileSync(absolutePath, "utf8");
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  let malformed = 0;
  let lastRecordedAt: string | undefined;

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as { at?: string };
      if (typeof parsed.at === "string" && parsed.at.length > 0) {
        lastRecordedAt = parsed.at;
      }
    } catch {
      malformed += 1;
    }
  }

  const summary: DeadLetterSummary = {
    configured: true,
    path: absolutePath,
    exists: true,
    total_records: lines.length,
    malformed_records: malformed
  };

  if (lastRecordedAt) {
    summary.last_recorded_at = lastRecordedAt;
  }

  return summary;
}
