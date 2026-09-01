#!/usr/bin/env node
/**
 * index-parts.mjs — list every GLB the studio can load.
 *
 * The studio works one product at a time (Jordan: "we'll just work on each
 * product that comes in one by one"), so the part picker has to offer the
 * whole library without anyone typing a filename. Regenerate after adding
 * GLBs:  node scripts/materials/index-parts.mjs
 */
import { readdirSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "public/models";
const DIRS = [
  ["closures", "closure"],
  ["bodies-threaded", "body"],
  ["bodies-thickness", "body (thickness-baked)"],
];

const parts = [];
for (const [dir, kind] of DIRS) {
  let names;
  try { names = readdirSync(join(ROOT, dir)); } catch { continue; }
  for (const f of names.filter((n) => n.endsWith(".glb")).sort()) {
    const id = f.replace(/\.glb$/, "");
    parts.push({
      id, kind,
      url: `/models/${dir}/${f}`,
      neck: (id.match(/\b(\d{2}-\d{3})\b/) || [])[1] ?? null,
      kb: Math.round(statSync(join(ROOT, dir, f)).size / 1024),
    });
  }
}

writeFileSync(`${ROOT}/parts-index.json`,
  JSON.stringify({ generatedBy: "index-parts.mjs", count: parts.length, parts }, null, 2));
console.log(`${parts.length} parts indexed -> ${ROOT}/parts-index.json`);
for (const [, kind] of DIRS)
  console.log(`  ${String(parts.filter((p) => p.kind === kind).length).padStart(3)}  ${kind}`);
