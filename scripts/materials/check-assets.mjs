#!/usr/bin/env node
/**
 * check-assets.mjs — every asset the app asks for must exist on disk.
 *
 * WHY: on 2026-08-31 a retired GLB (BB_ANSP_ASSEMBLY_18415.glb) stayed
 * referenced by a useGLTF hook. Hooks run unconditionally, so the 404 threw
 * inside <Canvas> and took down EVERY 18-415 product page — price and
 * add-to-cart included. Typecheck cannot catch a missing file; a page load
 * catches it far too late. This does, in about a second.
 *
 * Scans src/ for /models/... string literals, resolves template literals by
 * expanding the finish placeholders the closure loaders use, and asserts the
 * file is in public/.
 *
 *   node scripts/materials/check-assets.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const SRC = "src", PUBLIC = "public";
const FINISHES = ["17415", "18415"];          // ${fin} in the closure loaders

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if ([".ts", ".tsx"].includes(extname(p))) out.push(p);
  }
  return out;
}

const refs = new Map();                        // asset path -> [source files]
for (const file of walk(SRC)) {
  const text = readFileSync(file, "utf8");
  // both "/models/x.glb" and `/models/closures/BB_CAP_${fin}.glb`
  for (const m of text.matchAll(/["'`](\/models\/[^"'`\n]+)["'`]/g)) {
    const raw = m[1];
    if (!raw.includes("${")) { (refs.get(raw) ?? refs.set(raw, []).get(raw)).push(file); continue; }
    // expand the one placeholder family we use; anything else is dynamic
    // and gets skipped rather than guessed at
    if (/\$\{fin\}/.test(raw) && !/\$\{(?!fin\})/.test(raw)) {
      for (const f of FINISHES) {
        const r = raw.replace(/\$\{fin\}/g, f);
        (refs.get(r) ?? refs.set(r, []).get(r)).push(file);
      }
    }
  }
}

const missing = [];
for (const [asset, files] of refs) {
  // {bodyId} style runtime templates are not literals; skip anything left
  if (asset.includes("{") || asset.includes("$")) continue;
  if (!existsSync(join(PUBLIC, asset))) missing.push([asset, [...new Set(files)]]);
}

console.log(`checked ${refs.size} asset references from ${SRC}/`);
if (missing.length) {
  console.log("\nMISSING — these are referenced in code but not on disk:");
  for (const [a, files] of missing) {
    console.log(`  ✗ ${a}`);
    for (const f of files) console.log(`      referenced by ${f}`);
  }
  console.log("\nASSETS: FAIL");
  process.exit(1);
}
console.log("\nASSETS: PASS — every referenced asset exists");
