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

function inferMappedEventName(triggerName) {
  const normalized = String(triggerName || "").toLowerCase();
  if (normalized.includes("purchase")) {
    return "purchase";
  }
  if (normalized.includes("user_data") || normalized.includes("user data")) {
    return "user_data";
  }
  if (normalized.includes("pagevisit") && normalized.includes("dl_user_data")) {
    return "user_data";
  }
  if (normalized.includes("pageview") || normalized.includes("page view")) {
    return "page_view";
  }
  return "custom_event";
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceBundlePath = args["source-bundle"];
  const outPath = args.out;
  const reportPath = args.report;

  if (!sourceBundlePath || !outPath || !reportPath) {
    throw new Error("Usage: --source-bundle <file> --out <file> --report <file>");
  }

  const source = readJson(sourceBundlePath);
  const sourceCv = source.containerVersion || {};
  const sourceTags = sourceCv.tag || [];
  const sourceTriggers = sourceCv.trigger || [];

  const previewFolderId = "19901";
  const previewVariableId = "19901";
  const previewTriggerStart = 300000;
  const previewTagStart = 400000;

  const triggerById = new Map(sourceTriggers.map((trigger) => [String(trigger.triggerId), trigger]));
  const previewTriggers = [];
  const triggerMap = new Map();

  sourceTriggers.forEach((trigger, index) => {
    const nextId = String(previewTriggerStart + index);
    const mappedEvent = inferMappedEventName(trigger.name);
    triggerMap.set(String(trigger.triggerId), nextId);

    previewTriggers.push({
      accountId: trigger.accountId,
      containerId: trigger.containerId,
      triggerId: nextId,
      name: `Synapse Preview - ${trigger.name}`,
      type: "CUSTOM_EVENT",
      parentFolderId: previewFolderId,
      customEventFilter: [
        {
          type: "EQUALS",
          parameter: [
            { type: "TEMPLATE", key: "arg0", value: "{{_event}}" },
            { type: "TEMPLATE", key: "arg1", value: "gcw_synapse_event" }
          ]
        }
      ],
      filter: [
        {
          type: "EQUALS",
          parameter: [
            { type: "TEMPLATE", key: "arg0", value: "{{dlv - Synapse - Event Name}}" },
            { type: "TEMPLATE", key: "arg1", value: mappedEvent }
          ]
        }
      ],
      notes: `Synapse preview clone of trigger ${trigger.triggerId}. originalType=${trigger.type}, mappedEvent=${mappedEvent}. Fires on gcw_synapse_event and optional event_name mapping`
    });
  });

  const previewTags = sourceTags.map((tag, index) => {
    const originalTriggerIds = (tag.firingTriggerId || []).map((id) => String(id));
    const remappedTriggerIds = originalTriggerIds
      .map((id) => triggerMap.get(id))
      .filter(Boolean);

    const fallbackTrigger = previewTriggers[0] ? String(previewTriggers[0].triggerId) : "300000";

    return {
      ...tag,
      tagId: String(previewTagStart + index),
      name: `Synapse Preview - ${tag.name}`,
      parentFolderId: previewFolderId,
      paused: true,
      firingTriggerId: remappedTriggerIds.length > 0 ? remappedTriggerIds : [fallbackTrigger],
      notes: `Synapse preview clone of tag ${tag.tagId}. Default paused=true for controlled side-by-side validation`
    };
  });

  const previewVariable = {
    accountId: sourceCv.accountId,
    containerId: sourceCv.containerId,
    variableId: previewVariableId,
    name: "dlv - Synapse - Event Name",
    type: "v",
    parameter: [
      { type: "INTEGER", key: "dataLayerVersion", value: "2" },
      { type: "BOOLEAN", key: "setDefaultValue", value: "false" },
      { type: "TEMPLATE", key: "name", value: "event_name" }
    ],
    parentFolderId: previewFolderId,
    formatValue: {}
  };

  const out = {
    exportFormatVersion: source.exportFormatVersion || 2,
    exportTime: source.exportTime || "1970-01-01 00:00:00",
    containerVersion: {
      ...sourceCv,
      tag: previewTags,
      trigger: previewTriggers,
      variable: [previewVariable],
      folder: [
        {
          accountId: sourceCv.accountId,
          containerId: sourceCv.containerId,
          folderId: previewFolderId,
          name: "GCW Synapse Side-by-Side Preview",
          notes: "Generated preview tags/triggers rewired to gcw_synapse_event. Enable in small batches during validation."
        }
      ],
      builtInVariable: sourceCv.builtInVariable || []
    }
  };

  writeJson(outPath, out);

  const report = [
    "# GTM Synapse Side-by-Side Preview Report",
    "",
    `- Source bundle: ${sourceBundlePath}`,
    `- Source active tags: ${sourceTags.length}`,
    `- Source selected triggers: ${sourceTriggers.length}`,
    `- Preview tags generated: ${previewTags.length}`,
    `- Preview triggers generated: ${previewTriggers.length}`,
    "- Preview tags default paused: true",
    "",
    "## Mapping Samples",
    ""
  ]
    .concat(previewTags.slice(0, 10).map((tag) => `- ${tag.name}`))
    .concat([""])
    .join("\n");

  writeText(reportPath, report);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
