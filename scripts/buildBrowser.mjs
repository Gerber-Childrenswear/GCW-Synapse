import * as esbuild from "esbuild";
import { mkdirSync } from "node:fs";
import path from "node:path";

const outDir = path.resolve("extensions/synapse-theme/assets");
mkdirSync(outDir, { recursive: true });

await esbuild.build({
  entryPoints: ["src/browser/index.ts"],
  outfile: path.join(outDir, "gcw-synapse.js"),
  bundle: true,
  minify: true,
  sourcemap: true,
  target: ["es2020"],
  format: "iife",
  platform: "browser",
  legalComments: "none"
});

console.log("Built extensions/synapse-theme/assets/gcw-synapse.js");
