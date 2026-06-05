#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    args[key] = value;
    i += 1;
  }
  return args;
}

function parseBool(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function parseMatrix(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return [];
  }
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row = {};
    for (let j = 0; j < headers.length; j += 1) {
      row[headers[j]] = values[j] || "";
    }
    rows.push(row);
  }
  return rows;
}

function mkdirFor(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeJson(filePath, data) {
  mkdirFor(filePath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function writeText(filePath, text) {
  mkdirFor(filePath);
  fs.writeFileSync(filePath, text, "utf8");
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const gtmPath = args.gtm;
  const matrixPath = args.matrix;
  const outPath = args.out;
  const reportPath = args.report;

  if (!gtmPath || !matrixPath || !outPath || !reportPath) {
    throw new Error("Usage: --gtm <file> --matrix <file> --out <file> --report <file>");
  }

  const source = readJson(gtmPath);
  const matrixRows = parseMatrix(fs.readFileSync(matrixPath, "utf8"));
  const activeRows = matrixRows.filter((row) => !parseBool(row.paused));

  const activeTagNames = new Set(activeRows.map((row) => row.tag).filter(Boolean));
  const activeVariableNames = new Set(activeRows.map((row) => row.variable).filter(Boolean));

  const sourceCv = source.containerVersion || {};
  const selectedTags = (sourceCv.tag || []).filter((tag) => activeTagNames.has(tag.name));

  const triggerIds = new Set();
  for (const tag of selectedTags) {
    for (const triggerId of tag.firingTriggerId || []) {
      triggerIds.add(String(triggerId));
    }
  }

  const selectedTriggers = (sourceCv.trigger || []).filter((trigger) =>
    triggerIds.has(String(trigger.triggerId))
  );

  const selectedVariables = (sourceCv.variable || []).filter((variable) =>
    activeVariableNames.has(variable.name)
  );

  const out = {
    exportFormatVersion: source.exportFormatVersion || 2,
    exportTime: source.exportTime || "1970-01-01 00:00:00",
    containerVersion: {
      ...sourceCv,
      tag: selectedTags,
      trigger: selectedTriggers,
      variable: selectedVariables,
      customTemplate: sourceCv.customTemplate || []
    }
  };

  writeJson(outPath, out);

  const report = [
    "# GTM Elevar Active Rebuild Report",
    "",
    `- Source GTM: ${gtmPath}`,
    `- Source matrix: ${matrixPath}`,
    `- Active matrix rows: ${activeRows.length}`,
    `- Active tag names requested: ${activeTagNames.size}`,
    `- Active variable names requested: ${activeVariableNames.size}`,
    `- Tags exported: ${selectedTags.length}`,
    `- Triggers exported: ${selectedTriggers.length}`,
    `- Variables exported: ${selectedVariables.length}`,
    `- Folders exported: ${(sourceCv.folder || []).length}`,
    "",
    `- Missing tags: ${[...activeTagNames].filter((name) => !selectedTags.some((tag) => tag.name === name)).length}`,
    `- Missing variables: ${[...activeVariableNames].filter(
      (name) => !selectedVariables.some((variable) => variable.name === name)
    ).length}`,
    ""
  ].join("\n");

  writeText(reportPath, report);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
