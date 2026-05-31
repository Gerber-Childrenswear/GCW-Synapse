import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

function runNodeScript(scriptPath: string, args: string[]) {
  execFileSync(process.execPath, [scriptPath, ...args], {
    stdio: "pipe",
    encoding: "utf8"
  });
}

describe("gtm tooling fixtures", () => {
  it("generates deterministic Elevar rebuild bundle from fixture inputs", () => {
    const repoRoot = path.resolve(__dirname, "..");
    const fixtureDir = path.join(repoRoot, "test", "fixtures", "gtm-tooling");

    const gtmPath = path.join(fixtureDir, "fixture_workspace.json");
    const matrixPath = path.join(fixtureDir, "fixture_matrix.csv");
    const outPath = path.join(fixtureDir, "out_elevar_bundle.json");
    const reportPath = path.join(fixtureDir, "out_elevar_report.md");

    runNodeScript(path.join(repoRoot, "scripts", "generateElevarRebuildBundle.js"), [
      "--gtm",
      gtmPath,
      "--matrix",
      matrixPath,
      "--out",
      outPath,
      "--report",
      reportPath
    ]);

    const out = JSON.parse(fs.readFileSync(outPath, "utf8"));
    const cv = out.containerVersion;

    assert.equal((cv.tag || []).length, 2);
    assert.equal((cv.trigger || []).length, 2);
    assert.equal((cv.variable || []).length, 1);

    const tagNames = new Set((cv.tag || []).map((tag: { name: string }) => tag.name));
    assert.equal(tagNames.has("Tag - Purchase"), true);
    assert.equal(tagNames.has("Tag - Pageview"), true);
    assert.equal(tagNames.has("Tag - Paused"), false);
  });

  it("generates deterministic Synapse preview clone bundle from fixture rebuild output", () => {
    const repoRoot = path.resolve(__dirname, "..");
    const fixtureDir = path.join(repoRoot, "test", "fixtures", "gtm-tooling");

    const sourceBundlePath = path.join(fixtureDir, "out_elevar_bundle.json");
    const previewBundlePath = path.join(fixtureDir, "out_preview_bundle.json");
    const previewReportPath = path.join(fixtureDir, "out_preview_report.md");

    runNodeScript(path.join(repoRoot, "scripts", "generateSynapsePreviewBundle.js"), [
      "--source-bundle",
      sourceBundlePath,
      "--out",
      previewBundlePath,
      "--report",
      previewReportPath
    ]);

    runNodeScript(path.join(repoRoot, "scripts", "validateSynapsePreviewBundle.js"), [
      "--source-bundle",
      sourceBundlePath,
      "--bundle",
      previewBundlePath
    ]);

    const out = JSON.parse(fs.readFileSync(previewBundlePath, "utf8"));
    const cv = out.containerVersion;

    assert.equal((cv.tag || []).length, 2);
    assert.equal((cv.trigger || []).length, 2);

    for (const tag of cv.tag || []) {
      assert.equal(String(tag.name).startsWith("Synapse Preview - "), true);
      assert.equal(tag.paused, true);
      assert.equal(Array.isArray(tag.firingTriggerId) && tag.firingTriggerId.length > 0, true);
    }

    for (const trigger of cv.trigger || []) {
      assert.equal(trigger.type, "CUSTOM_EVENT");
      const filter = trigger.customEventFilter?.[0]?.parameter || [];
      const arg1 = filter.find((p: { key: string; value: string }) => p.key === "arg1")?.value;
      assert.equal(arg1, "gcw_synapse_event");
    }

    const variableNames = new Set((cv.variable || []).map((v: { name: string }) => v.name));
    assert.equal(variableNames.has("dlv - Synapse - Event Name"), true);
  });
});
