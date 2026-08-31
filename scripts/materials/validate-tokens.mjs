#!/usr/bin/env node
/**
 * validate-tokens.mjs — the gate that makes material generation predictable.
 *
 * Four checks, each catching a failure this project has actually hit:
 *
 *  1 CLASS INVARIANTS   a metal must be metalness 1 with roughness > 0 (a
 *                       perfect mirror on a small curved cap reflects nothing
 *                       legible); a polymer must be metalness 0. Catches the
 *                       "polymer inherited metalness from a bad export" bug.
 *  2 COLOUR ENCODING    baseColorLinear must agree with baseColorHex. The
 *                       library colours are already sRGB fractions and were
 *                       once re-encoded, which washed every gold out.
 *  3 FAMILY SPREAD      members of one family are the same substance. Differing
 *                       values are reported — this is how "why is this gold not
 *                       that gold" becomes a build failure instead of a
 *                       screenshot argument.
 *  4 REFERENCE INTEGRITY every material name used in app code must resolve to
 *                       a token. A typo currently renders silent grey.
 *
 *   node scripts/materials/validate-tokens.mjs [--strict]
 * --strict also fails on family spread (advisory by default, since today's
 * spread is inherited from approved values a human must reconcile).
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const strict = process.argv.includes("--strict");
const t = JSON.parse(readFileSync("public/models/tokens.json", "utf8"));
const errors = [], warnings = [];

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hexToLinear = (hex) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => srgbToLinear(v / 255));
};

// 1 + 2
for (const [id, m] of Object.entries(t.materials)) {
  if (m.class === "metal") {
    if (m.metalness !== 1) errors.push(`${id}: class metal but metalness=${m.metalness}`);
    if (!(m.roughness > 0)) errors.push(`${id}: metal roughness must be > 0, got ${m.roughness}`);
  }
  if (["polymer", "textile", "stage", "fluid"].includes(m.class) && m.metalness !== 0)
    errors.push(`${id}: class ${m.class} must be metalness 0, got ${m.metalness}`);

  if (m.baseColorHex && m.baseColorLinear) {
    const want = hexToLinear(m.baseColorHex);
    const drift = Math.max(...want.map((w, i) => Math.abs(w - m.baseColorLinear[i])));
    if (drift > 1e-4)
      errors.push(`${id}: baseColorLinear disagrees with ${m.baseColorHex} (max drift ${drift.toExponential(2)})`);
  }
}

// 3
const fam = {};
for (const [id, m] of Object.entries(t.materials)) (fam[m.family] ??= []).push([id, m]);
for (const [f, members] of Object.entries(fam)) {
  if (members.length < 2) continue;
  // Colour MAY differ inside a family — that is what a colourway is. For
  // glass the colour lives in the attenuation pair, not a base colour, so
  // those are exempt too. Every other property must match: same substance
  // + same finish = same numbers.
  const varying = ["roughness", "metalness", "clearcoat", "ior", "maps"].filter(
    (k) => new Set(members.map(([, m]) => JSON.stringify(m[k] ?? m.lanes?.web?.[k]))).size > 1);
  const eIs = new Set(members.map(([, m]) => m.lanes?.web?.envMapIntensity).filter((v) => v != null));
  if (varying.length || eIs.size > 1)
    warnings.push(`family ${f}: ${members.length} members differ on ` +
      `${[...varying, ...(eIs.size > 1 ? [`envMapIntensity {${[...eIs].join(", ")}}`] : [])].join(", ")}` +
      `\n      ${members.map(([id]) => id).join("\n      ")}`);
}

// 4
let used = [];
try {
  const out = execSync(
    `grep -rhoE '"(CAP|PART|LEATHER|ANSP|SPRAY|STUDIO)_[A-Z_]+"' src/ --include=*.ts --include=*.tsx || true`,
    { encoding: "utf8" });
  used = [...new Set(out.split("\n").map((s) => s.replace(/"/g, "").trim()).filter(Boolean))];
} catch {}
// `_TALL_VIEW` is a lab-only synthetic id stripped before lookup; CAP_DOTS is
// a MESH-name prefix (mesh.includes("CAP_DOTS")), never a material key.
const MESH_PREFIXES = new Set(["CAP_DOTS"]);
const unresolved = used
  .map((k) => k.replace(/_TALL_VIEW$/, ""))
  .filter((k) => !MESH_PREFIXES.has(k))
  .filter((k) => !t.aliases[k] && !t.materials[k]);
if (unresolved.length)
  errors.push(`material names used in code with no token: ${unresolved.join(", ")}`);

console.log(`tokens ${Object.keys(t.materials).length} · aliases ${Object.keys(t.aliases).length} · code refs checked ${used.length}`);
if (warnings.length) { console.log("\nFAMILY SPREAD (advisory — reconcile or justify):"); warnings.forEach((w) => console.log("  ⚠ " + w)); }
if (errors.length) { console.log("\nERRORS:"); errors.forEach((e) => console.log("  ✗ " + e)); }
const fail = errors.length || (strict && warnings.length);
console.log(fail ? "\nGATE: FAIL" : "\nGATE: PASS");
process.exit(fail ? 1 : 0);
