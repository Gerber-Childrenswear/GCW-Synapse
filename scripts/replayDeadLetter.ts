import fs from "node:fs";
import path from "node:path";
import { env } from "../src/config/env";
import { forwardToGtmServer } from "../src/services/gtmForwarder";

type DeadLetterRecord = {
  at?: string;
  status?: number;
  attempt?: number;
  error?: string;
  event_name?: string;
  event_id?: string;
  transaction_id?: string;
  payload?: Record<string, unknown>;
};

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) {
    return process.argv[idx + 1];
  }
  return undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function readJsonl(filePath: string): DeadLetterRecord[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const out: DeadLetterRecord[] = [];

  for (const line of lines) {
    try {
      out.push(JSON.parse(line) as DeadLetterRecord);
    } catch {
      // Keep malformed lines as unresolved sentinel records.
      out.push({ error: `malformed_jsonl_line:${line.slice(0, 60)}` });
    }
  }

  return out;
}

function writeJsonl(filePath: string, records: DeadLetterRecord[]): void {
  const body = records.map((r) => JSON.stringify(r)).join("\n");
  fs.writeFileSync(filePath, body.length > 0 ? `${body}\n` : "", "utf8");
}

async function main(): Promise<void> {
  const fileFromArg = getArg("--path");
  const filePath = path.resolve(fileFromArg ?? env.GTM_DEAD_LETTER_PATH ?? "./data/gtm-dead-letter.jsonl");
  const dryRun = hasFlag("--dry-run");
  const limitRaw = getArg("--limit");
  const limit = limitRaw ? Math.max(1, Number.parseInt(limitRaw, 10) || 1) : Number.POSITIVE_INFINITY;

  const records = readJsonl(filePath);
  if (records.length === 0) {
    console.log(`dead-letter replay: no records at ${filePath}`);
    return;
  }

  const backupPath = `${filePath}.bak.${Date.now()}`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.copyFileSync(filePath, backupPath);

  let attempted = 0;
  let replayed = 0;
  const unresolved: DeadLetterRecord[] = [];

  for (const record of records) {
    if (attempted >= limit) {
      unresolved.push(record);
      continue;
    }

    if (!record.payload || typeof record.payload !== "object") {
      unresolved.push(record);
      continue;
    }

    attempted += 1;

    if (dryRun) {
      replayed += 1;
      continue;
    }

    try {
      await forwardToGtmServer(record.payload);
      replayed += 1;
    } catch {
      unresolved.push(record);
    }
  }

  if (dryRun) {
    console.log(`dead-letter replay dry-run: file=${filePath}, backup=${backupPath}, attempted=${attempted}, replayable=${replayed}, unresolved=${records.length - replayed}`);
    return;
  }

  writeJsonl(filePath, unresolved);

  console.log(`dead-letter replay complete: file=${filePath}, backup=${backupPath}, attempted=${attempted}, replayed=${replayed}, remaining=${unresolved.length}`);
}

main().catch((error) => {
  console.error("dead-letter replay failed", error instanceof Error ? error.message : error);
  process.exit(1);
});
