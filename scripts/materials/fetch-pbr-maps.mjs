#!/usr/bin/env node
/**
 * fetch-pbr-maps.mjs — pull the CC0 texture sets our tokens reference.
 *
 * The token file names maps it does not ship; without them a leather cap
 * falls back to flat colour and reads like painted plastic. This script
 * fetches them from source so the assets are reproducible rather than
 * "someone downloaded these once" — which is how public/models/pbr/matte
 * arrived, with no record of where from.
 *
 * Sources are CC0. Attribution is recorded in the token provenance.
 *   node scripts/materials/fetch-pbr-maps.mjs [set]
 */
import { mkdirSync, writeFileSync, existsSync, readdirSync, copyFileSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SETS = {
  leather: {
    id: "Leather028",
    zip: "https://ambientcg.com/get?file=Leather028_1K-PNG.zip",
    license: "CC0 1.0 — ambientCG (https://ambientcg.com/view?id=Leather028)",
    out: "public/models/pbr/leather",
    // ambientCG ships NormalGL (OpenGL, +Y up) and NormalDX. three.js is
    // OpenGL convention, so NormalGL is the correct one — picking DX
    // inverts the lighting on every bump and reads as if lit from below.
    want: { Color: "color.png", NormalGL: "normal.png", Roughness: "roughness.png" },
  },
};

const name = process.argv[2] ?? "leather";
const set = SETS[name];
if (!set) { console.error(`unknown set '${name}'. have: ${Object.keys(SETS).join(", ")}`); process.exit(1); }

const work = join(tmpdir(), `pbr-${set.id}`);
mkdirSync(work, { recursive: true });
const zip = join(work, `${set.id}.zip`);

if (!existsSync(zip)) {
  console.log(`fetching ${set.id} …`);
  const res = await fetch(set.zip, { redirect: "follow" });
  if (!res.ok) { console.error(`download failed: HTTP ${res.status}`); process.exit(1); }
  writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
}
console.log(`zip ${(statSync(zip).size / 1e6).toFixed(2)} MB`);

execSync(`unzip -o -q "${zip}" -d "${work}"`, { stdio: "inherit" });
mkdirSync(set.out, { recursive: true });

const files = readdirSync(work);
let copied = 0;
for (const [attr, dest] of Object.entries(set.want)) {
  const hit = files.find((f) => f.includes(`_${attr}.`) || f.endsWith(`${attr}.png`));
  if (!hit) { console.error(`  ✗ ${attr} not found in the archive`); continue; }
  const to = join(set.out, dest);
  copyFileSync(join(work, hit), to);
  console.log(`  ✓ ${hit}  ->  ${to}  ${(statSync(to).size / 1e6).toFixed(2)} MB`);
  copied++;
}
writeFileSync(join(set.out, "LICENSE.txt"), `${set.license}\nFetched by scripts/materials/fetch-pbr-maps.mjs\n`);
console.log(`\n${copied}/${Object.keys(set.want).length} maps installed · ${set.license}`);
