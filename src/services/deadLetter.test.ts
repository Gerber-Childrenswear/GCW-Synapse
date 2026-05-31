import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getDeadLetterSummary } from "./deadLetter";

test("getDeadLetterSummary handles missing configuration", () => {
  const summary = getDeadLetterSummary(undefined);
  assert.equal(summary.configured, false);
  assert.equal(summary.exists, false);
  assert.equal(summary.total_records, 0);
});

test("getDeadLetterSummary parses jsonl file", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "synapse-dlq-"));
  const filePath = path.join(tempDir, "dead-letter.jsonl");

  fs.writeFileSync(
    filePath,
    [
      JSON.stringify({ at: "2026-05-30T00:00:00.000Z", payload: { event_name: "purchase" } }),
      "not-json",
      JSON.stringify({ at: "2026-05-30T01:00:00.000Z", payload: { event_name: "refund" } })
    ].join("\n") + "\n",
    "utf8"
  );

  const summary = getDeadLetterSummary(filePath);
  assert.equal(summary.configured, true);
  assert.equal(summary.exists, true);
  assert.equal(summary.total_records, 3);
  assert.equal(summary.malformed_records, 1);
  assert.equal(summary.last_recorded_at, "2026-05-30T01:00:00.000Z");
});
