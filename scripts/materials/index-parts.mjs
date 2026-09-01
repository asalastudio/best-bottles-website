#!/usr/bin/env node
/**
 * index-parts.mjs — list every GLB the studio can load.
 *
 * The studio works one product at a time (Jordan: "we'll just work on each
 * product that comes in one by one"), so the part picker has to offer the
 * whole library without anyone typing a filename. Regenerate after adding
 * GLBs:  node scripts/materials/index-parts.mjs
 */
import { readdirSync, writeFileSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Bounding box straight out of the GLB's POSITION accessors.
 *
 *  The library does not share one origin convention and it should not have
 *  to: closures defined against a finish put z=0 on the NECK RIM, while
 *  CAP_PNKDOT puts it on the cap's own base because its interface is
 *  deliberately unverified. The studio has to frame both, so it needs each
 *  part's centre and size.
 *
 *  Measured HERE rather than in the browser on purpose. The runtime version
 *  had to wait for the GLTF to stream in, retry on an empty box, and survive
 *  React's effect ordering -- and it silently never ran. A GLB carries min
 *  and max on every accessor by spec, so this is a file read, not a race.
 */
function bounds(file) {
  const b = readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67) return null;      // 'glTF'
  let off = 12, json = null;
  while (off < b.length) {
    const len = b.readUInt32LE(off), type = b.readUInt32LE(off + 4);
    if (type === 0x4e4f534a) json = JSON.parse(b.slice(off + 8, off + 8 + len).toString("utf8"));
    off += 8 + len;
  }
  if (!json?.meshes) return null;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const mesh of json.meshes)
    for (const prim of mesh.primitives ?? []) {
      const acc = json.accessors?.[prim.attributes?.POSITION];
      if (!acc?.min || !acc?.max) continue;
      for (let i = 0; i < 3; i++) {
        lo[i] = Math.min(lo[i], acc.min[i]);
        hi[i] = Math.max(hi[i], acc.max[i]);
      }
    }
  if (!Number.isFinite(lo[0])) return null;
  const r = (v) => +v.toFixed(6);
  return {
    center: lo.map((v, i) => r((v + hi[i]) / 2)),
    size: lo.map((v, i) => r(hi[i] - v)),
  };
}

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
    const bb = bounds(join(ROOT, dir, f));
    parts.push({
      id, kind,
      url: `/models/${dir}/${f}`,
      neck: (id.match(/\b(\d{2}-\d{3})\b/) || [])[1] ?? null,
      kb: Math.round(statSync(join(ROOT, dir, f)).size / 1024),
      ...(bb ?? {}),
    });
  }
}

writeFileSync(`${ROOT}/parts-index.json`,
  JSON.stringify({ generatedBy: "index-parts.mjs", count: parts.length, parts }, null, 2));
console.log(`${parts.length} parts indexed -> ${ROOT}/parts-index.json`);
for (const [, kind] of DIRS)
  console.log(`  ${String(parts.filter((p) => p.kind === kind).length).padStart(3)}  ${kind}`);
