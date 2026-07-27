import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import * as esbuild from "esbuild";

const themeOutDir = path.resolve("extensions/theme-app-extension/assets");
const cdnOutDir = path.resolve("apps/admin/public");
mkdirSync(themeOutDir, { recursive: true });
mkdirSync(cdnOutDir, { recursive: true });

const outfile = path.join(themeOutDir, "gcw-synapse.js");

await esbuild.build({
  entryPoints: ["src/browser/index.ts"],
  outfile,
  bundle: true,
  minify: true,
  sourcemap: true,
  target: ["es2020"],
  format: "iife",
  platform: "browser",
  legalComments: "none"
});

// Worker ASSETS serves apps/admin/dist (built from public/); keep CDN in sync.
copyFileSync(outfile, path.join(cdnOutDir, "gcw-synapse.js"));
try {
  copyFileSync(`${outfile}.map`, path.join(cdnOutDir, "gcw-synapse.js.map"));
} catch {
  // map optional
}

console.log("Built extensions/theme-app-extension/assets/gcw-synapse.js");
console.log("Synced apps/admin/public/gcw-synapse.js (Worker CDN)");
