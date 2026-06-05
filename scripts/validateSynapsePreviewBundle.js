#!/usr/bin/env node

const fs = require("node:fs");

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

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function getCustomEventArg1(trigger) {
  const filters = trigger.customEventFilter || [];
  const first = filters[0] || {};
  const parameters = first.parameter || [];
  const arg1 = parameters.find((param) => param.key === "arg1");
  return arg1 ? arg1.value : undefined;
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceBundlePath = args["source-bundle"];
  const bundlePath = args.bundle;

  if (!sourceBundlePath || !bundlePath) {
    throw new Error("Usage: --source-bundle <file> --bundle <file>");
  }

  const source = readJson(sourceBundlePath);
  const bundle = readJson(bundlePath);

  const sourceTags = source.containerVersion?.tag || [];
  const sourceTriggers = source.containerVersion?.trigger || [];
  const previewTags = bundle.containerVersion?.tag || [];
  const previewTriggers = bundle.containerVersion?.trigger || [];
  const previewVariables = bundle.containerVersion?.variable || [];

  assertCondition(previewTags.length === sourceTags.length, "Preview tag count does not match source tag count");
  assertCondition(
    previewTriggers.length === sourceTriggers.length,
    "Preview trigger count does not match source trigger count"
  );

  for (const tag of previewTags) {
    assertCondition(
      String(tag.name || "").startsWith("Synapse Preview - "),
      `Invalid preview tag name: ${tag.name || "(missing)"}`
    );
    assertCondition(tag.paused === true, `Preview tag must be paused: ${tag.name || "(missing)"}`);
    assertCondition(
      Array.isArray(tag.firingTriggerId) && tag.firingTriggerId.length > 0,
      `Preview tag must have firing triggers: ${tag.name || "(missing)"}`
    );
  }

  for (const trigger of previewTriggers) {
    assertCondition(trigger.type === "CUSTOM_EVENT", `Preview trigger type must be CUSTOM_EVENT: ${trigger.name}`);
    assertCondition(
      getCustomEventArg1(trigger) === "gcw_synapse_event",
      `Preview trigger must listen for gcw_synapse_event: ${trigger.name}`
    );
  }

  assertCondition(
    previewVariables.some((variable) => variable.name === "dlv - Synapse - Event Name"),
    "Missing required variable: dlv - Synapse - Event Name"
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
