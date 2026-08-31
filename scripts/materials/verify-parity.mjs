#!/usr/bin/env node
/**
 * verify-parity.mjs — proves the token port changed NO material values.
 *
 * createMaterial() in registry.ts applies the same formulas the old inline
 * code in Bottle3DViewer applied, verbatim. So if every legacy key's fields
 * survive the port unchanged, every rendered material is unchanged too.
 * This checks that field-by-field, which is stronger than eyeballing a
 * screenshot and it runs in CI.
 */
import { readFileSync } from "node:fs";

const old = JSON.parse(readFileSync("public/models/materials.json", "utf8")).materials;
const t = JSON.parse(readFileSync("public/models/tokens.json", "utf8"));
const VESTIGIAL = new Set(["GLASS_CLEAR","GLASS_AMBER","GLASS_COBALT","GLASS_GREEN","GLASS_FROSTED"]);

const CORE = ["metalness","roughness","clearcoat","ior","transmission","specularIntensity","specularColor"];
const WEB  = ["envMapIntensity","env","maps","opacity","alphaHash"];
let checked = 0; const bad = [];

for (const [key, o] of Object.entries(old)) {
  if (VESTIGIAL.has(key)) continue;
  const id = t.aliases[key];
  if (!id) { bad.push(`${key}: no alias`); continue; }
  const n = t.materials[id];
  if (!n) { bad.push(`${key} -> ${id}: token missing`); continue; }
  checked++;

  if (o.color !== n.baseColorHex) bad.push(`${key}: colour ${o.color} -> ${n.baseColorHex}`);
  for (const f of CORE) {
    const a = o[f] ?? null, b = n[f] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(`${key}.${f}: ${a} -> ${b}`);
  }
  for (const f of WEB) {
    const a = o[f] ?? null, b = n.lanes?.web?.[f] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(`${key}.${f}: ${a} -> ${b}`);
  }
  // a merged token carries every contributing key's approval text
  if (o.note && !(n.provenance ?? "").includes(o.note))
    bad.push(`${key}: provenance/approval text lost`);
}

console.log(`compared ${checked} legacy materials against their tokens`);
if (bad.length) { console.log("\nDRIFT:"); bad.forEach((b) => console.log("  ✗ " + b)); }
console.log(bad.length ? "\nPARITY: FAIL" : "\nPARITY: PASS — no material value changed");
process.exit(bad.length ? 1 : 0);
