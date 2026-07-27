import fs from "node:fs";
import path from "node:path";

type AppEmbedFinding = {
  id: string;
  type: string;
  disabled: boolean;
};

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) {
    return process.argv[idx + 1];
  }
  return undefined;
}

function resolveThemePath(): string {
  const fromArg = getArg("--theme");
  if (fromArg) {
    return path.resolve(fromArg);
  }

  return path.resolve("D:/Users/ncassidy/Downloads/theme_export_gcw_30may2026_unzipped");
}

function readJson(filePath: string): unknown {
  const raw = fs.readFileSync(filePath, "utf8");
  const cleaned = raw
    .replace(/^\uFEFF/, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
  return JSON.parse(cleaned);
}

function extractAppEmbeds(settingsData: unknown): AppEmbedFinding[] {
  const root = settingsData as { current?: { blocks?: Record<string, { type?: string; disabled?: boolean }> } };
  const blocks = root.current?.blocks ?? {};
  const out: AppEmbedFinding[] = [];

  for (const [id, block] of Object.entries(blocks)) {
    if (!block?.type || !block.type.startsWith("shopify://apps/")) {
      continue;
    }

    out.push({
      id,
      type: block.type,
      disabled: Boolean(block.disabled)
    });
  }

  return out;
}

function contains(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function main(): void {
  const themeRoot = resolveThemePath();
  const outPath = path.resolve(
    getArg("--out") ?? "docs/gtm/THEME_TRACKING_AUDIT.md"
  );

  const settingsPath = path.join(themeRoot, "config", "settings_data.json");
  const layoutPath = path.join(themeRoot, "layout", "theme.liquid");

  if (!fs.existsSync(settingsPath)) {
    throw new Error(`settings_data.json not found at ${settingsPath}`);
  }
  if (!fs.existsSync(layoutPath)) {
    throw new Error(`theme.liquid not found at ${layoutPath}`);
  }

  const settingsData = readJson(settingsPath);
  const appEmbeds = extractAppEmbeds(settingsData);
  const themeLiquid = fs.readFileSync(layoutPath, "utf8");

  const elevarEmbeds = appEmbeds.filter((e) => contains(e.type, "elevar-conversion-tracking"));
  const tripleWhaleEmbeds = appEmbeds.filter((e) => contains(e.type, "triplewhale"));
  const pandectesEmbeds = appEmbeds.filter((e) => contains(e.type, "pandectes"));

  const hasFoxthemeHead = contains(themeLiquid, "shop.metafields.foxtheme.code_head.value");
  const hasFoxthemeBody = contains(themeLiquid, "shop.metafields.foxtheme.code_body.value");
  const hasCommerceShieldPixelGuard = contains(themeLiquid, "commerce-shield-prod") && contains(themeLiquid, "cs-pixel-guard.js");
  const hasBloomreachDataLayerHook = fs.existsSync(path.join(themeRoot, "snippets", "bloomreach-engagement.liquid"));

  const findings: string[] = [];
  if (tripleWhaleEmbeds.some((e) => !e.disabled)) {
    findings.push(
      "Triple Whale app embed is enabled but out of scope — disable it so Synapse + GTM own tracking (avoid double-fire)."
    );
  }
  if (elevarEmbeds.some((e) => !e.disabled) && tripleWhaleEmbeds.some((e) => !e.disabled)) {
    findings.push("Elevar and Triple Whale app embeds are both enabled. This can double-fire client events.");
  }
  if (hasFoxthemeHead || hasFoxthemeBody) {
    findings.push("Foxtheme head/body metafield injection is present. Hidden tracking snippets can be injected outside source control.");
  }
  if (!hasCommerceShieldPixelGuard) {
    findings.push("Commerce Shield Pixel Guard script marker was not detected in theme.liquid.");
  }
  if (!hasBloomreachDataLayerHook) {
    findings.push("Bloomreach dataLayer hook snippet was not detected.");
  }

  const status = findings.length === 0 ? "ok" : "warning";

  const lines: string[] = [];
  lines.push("# Theme Tracking Audit", "", `- Theme path: ${themeRoot}`, `- Status: ${status}`, "");
  lines.push("## App Embeds", "", `- Total app embeds: ${appEmbeds.length}`, `- Elevar embeds: ${elevarEmbeds.length}`, `- Triple Whale embeds: ${tripleWhaleEmbeds.length}`, `- Pandectes embeds: ${pandectesEmbeds.length}`, "");

  lines.push("### Embed Detail", "", "| Block ID | Type | Disabled |", "|---|---|---|");
  for (const embed of appEmbeds) {
    lines.push(`| ${embed.id} | ${embed.type} | ${embed.disabled} |`);
  }

  lines.push("", "## Runtime Markers", "");
  lines.push(`- Foxtheme head injection present: ${hasFoxthemeHead}`);
  lines.push(`- Foxtheme body injection present: ${hasFoxthemeBody}`);
  lines.push(`- Commerce Shield pixel guard present: ${hasCommerceShieldPixelGuard}`);
  lines.push(`- Bloomreach dataLayer hook present: ${hasBloomreachDataLayerHook}`);

  lines.push("", "## Findings", "");
  if (findings.length === 0) {
    lines.push("- No high-risk overlap found in this export.");
  } else {
    for (const finding of findings) {
      lines.push(`- ${finding}`);
    }
  }

  lines.push("", "## Monday Action Checklist", "");
  lines.push("- Disable Elevar app embed when Synapse/TW pipeline is verified.");
  lines.push("- Keep only one owner for client pixel events per channel (TW or GTM/Synapse).", "- Audit foxtheme code_head/code_body values in Shopify admin before launch.");
  lines.push("- Confirm GTM Preview shows one event path per action (no duplicate purchase/add_to_cart).", "- Validate /ops/alerts and /ops/dead-letter are clean before go-live.");

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");

  console.log("Theme tracking audit generated:");
  console.log(`- ${outPath}`);
  console.log(`- status=${status}, findings=${findings.length}, embeds=${appEmbeds.length}`);
}

main();
