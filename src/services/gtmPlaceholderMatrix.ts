import { readFileSync } from "node:fs";
import path from "node:path";

export type PlaceholderFamily = {
  eventName: string;
  tagCount: number;
  placeholderCount: number;
  tags: string[];
  placeholders: string[];
};

export type PlaceholderMatrixReport = {
  sourceBundlePath: string;
  tagsScanned: number;
  triggersScanned: number;
  eventGroups: number;
  families: PlaceholderFamily[];
};

const DEFAULT_CHECKLIST_PATH = path.join(
  process.cwd(),
  "docs/gtm/GTM-TKW58K8_synapse_placeholder_checklist.md"
);

function parseSummaryTable(markdown: string): { tags: number; triggers: number; eventGroups: number } {
  const tagsMatch = markdown.match(/Tags scanned:\s*(\d+)/i);
  const triggersMatch = markdown.match(/Triggers scanned:\s*(\d+)/i);
  const groupsMatch = markdown.match(/Event groups:\s*(\d+)/i);

  return {
    tags: tagsMatch?.[1] ? Number.parseInt(tagsMatch[1], 10) : 0,
    triggers: triggersMatch?.[1] ? Number.parseInt(triggersMatch[1], 10) : 0,
    eventGroups: groupsMatch?.[1] ? Number.parseInt(groupsMatch[1], 10) : 0
  };
}

function parseBundlePath(markdown: string): string {
  const match = markdown.match(/Source bundle:\s*(.+)/i);
  return match?.[1]?.trim() ?? "unknown";
}

function parseFamilies(markdown: string): PlaceholderFamily[] {
  const sections = markdown.split(/^## Event /m).slice(1);
  const families: PlaceholderFamily[] = [];

  for (const section of sections) {
    const eventName = section.split("\n")[0]?.trim() ?? "unknown";
    const tagsBlock = section.split("### Tags")[1]?.split("### Placeholders")[0] ?? "";
    const placeholdersBlock = section.split("### Placeholders")[1]?.split("### Tags")[0] ?? "";

    const tags = tagsBlock
      .split("\n")
      .filter((line) => line.startsWith("- "))
      .map((line) => line.slice(2).trim())
      .filter(Boolean);

    const placeholders = placeholdersBlock
      .split("\n")
      .filter((line) => line.startsWith("- "))
      .map((line) => line.slice(2).trim())
      .filter(Boolean);

    const tagCountMatch = section.match(/- Tags:\s*(\d+)/);
    const placeholderCountMatch = section.match(/- Placeholders:\s*(\d+)/);

    families.push({
      eventName,
      tagCount: tagCountMatch?.[1] ? Number.parseInt(tagCountMatch[1], 10) : tags.length,
      placeholderCount: placeholderCountMatch?.[1]
        ? Number.parseInt(placeholderCountMatch[1], 10)
        : placeholders.length,
      tags,
      placeholders
    });
  }

  return families;
}

export function buildPlaceholderMatrixReport(checklistPath = DEFAULT_CHECKLIST_PATH): PlaceholderMatrixReport {
  const markdown = readFileSync(checklistPath, "utf8");
  const summary = parseSummaryTable(markdown);

  return {
    sourceBundlePath: parseBundlePath(markdown),
    tagsScanned: summary.tags,
    triggersScanned: summary.triggers,
    eventGroups: summary.eventGroups,
    families: parseFamilies(markdown)
  };
}
