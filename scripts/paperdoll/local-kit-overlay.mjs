#!/usr/bin/env node
// Stage an extracted kit batch for LOCAL preview only: copy the part files under
// public/local-kits/<name>/ and write kits.json shaped like productKits rows,
// with /local-kits/... URLs. The dev server overlays these when
// BUILDER_LOCAL_KITS points at the JSON. Nothing is uploaded or written to Convex.
//
//   node scripts/paperdoll/local-kit-overlay.mjs --batch dist/paper-doll/boston-current-2026-09-16 --name boston-2026-09-16
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { resolve, join, basename } from "node:path";
const args = process.argv.slice(2); const value = k => args[args.indexOf(k) + 1];
const batch = resolve(value("--batch")); const name = value("--name");
const out = resolve("public/local-kits", name); await mkdir(join(out, "parts"), { recursive: true });
const manifest = JSON.parse(await readFile(join(batch, "kits/manifest.json"), "utf8"));
const rows = {}; let parts = 0;
for (const row of manifest.rows) {
  if (row.status !== "candidate") continue;
  const kitParts = [];
  for (const part of row.parts) {
    const file = basename(part.image); await copyFile(join(batch, "kits", part.image), join(out, "parts", file)); parts++;
    kitParts.push({ slot: part.slot, variantKey: part.variantKey, zOrder: part.zOrder, explodeIndex: part.explodeIndex, bounds: part.bounds, assembled: part.assembled, exploded: part.exploded,
      image: { url: `/local-kits/${name}/parts/${file}`, key: part.storeKey, sha256: part.sha256, bytes: part.bytes, width: part.width, height: part.height }, image2x: null, mask: null, derivation: part.derivation });
  }
  rows[row.sku] = { sku: row.sku, websiteSku: row.websiteSku, graceSku: row.graceSku, familyId: row.familyId, plateSha256: row.plateSha256, canvas: row.canvas, anchors: row.anchors,
    completeness: row.completeness, parts: kitParts, three: row.three, source: row.source, conflicts: [], storageProvider: "local-preview", builder: { name: "local-kit-overlay.mjs", version: "1.0.0", builtAt: Date.now() }, revision: 0 };
}
await writeFile(join(out, "kits.json"), JSON.stringify({ batch, generatedAt: new Date().toISOString(), rows }, null, 1));
console.log(`${Object.keys(rows).length} kits, ${parts} part files → ${out}`);
