#!/usr/bin/env node
/**
 * port-tokens.mjs — materials.json (part-named) -> tokens.json (physical).
 *
 * WHY THE PORT IS MECHANICAL
 * Every value here has been approved by Jordan and pinned by material_lock.
 * The port therefore COPIES values byte-for-byte and only changes how they
 * are KEYED and GROUPED. Nothing is retuned, merged or "cleaned up" —
 * merging two near-identical metals would silently move an approved look,
 * which is exactly the failure this system exists to prevent.
 *
 * Where two entries are genuinely identical they collapse to one token.
 * Where they differ they keep separate tokens but share a `family`, so the
 * validator can report the spread and a human decides. That is the whole
 * trick: inconsistency becomes visible and enforceable instead of silent.
 *
 *   node scripts/materials/port-tokens.mjs          # writes public/models/tokens.json
 */
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "public/models/materials.json";
const OUT = "public/models/tokens.json";

/** legacy key -> [token id, family]. Physical substance, never part name. */
const MAP = {
  CAP_SHINY_GOLD:          ["metal.gold.polished",       "metal.gold.polished"],
  CAP_MATTE_GOLD:          ["metal.gold.matte",          "metal.gold.matte"],
  CAP_SHINY_SILVER:        ["metal.silver.polished",     "metal.silver.polished"],
  CAP_MATTE_SILVER:        ["metal.silver.matte",        "metal.silver.matte"],
  CAP_DOTS_SILVER:         ["metal.silver.matte.dots",   "metal.silver.matte"],
  CAP_DOTS_PINK:           ["metal.rose.matte",          "metal.rose"],
  CAP_COPPER:              ["metal.copper.polished",     "metal.copper"],
  PART_STUD_CHROME:        ["metal.chrome.polished",     "metal.chrome.polished"],
  PART_STUD_CHROME_BRIGHT: ["metal.chrome.bright",       "metal.chrome.bright"],
  PART_BALL_STEEL:         ["metal.steel.ball",          "metal.steel.polished"],
  PART_STUD_STEEL:         ["metal.steel.stud",          "metal.steel.polished"],
  SPRAY_RED:               ["metal.anodised.red",        "metal.anodised"],
  SPRAY_TURQUOISE:         ["metal.anodised.turquoise",  "metal.anodised"],

  CAP_SHINY_BLACK:         ["polymer.abs.gloss_black",   "polymer.abs"],
  CAP_DOTS_BLACK:          ["polymer.abs.gloss_black",   "polymer.abs"],  // identical -> merges
  CAP_WHITE:               ["polymer.pp.white_cap",      "polymer.pp.white"],
  PART_ACTUATOR_PP:        ["polymer.pp.white_actuator", "polymer.pp.white"],
  PART_HOUSING_PP:         ["polymer.pp.natural_housing","polymer.pp.natural"],
  PART_HOUSING_PP_NATURAL: ["polymer.pp.natural",        "polymer.pp.natural"],
  PART_REDUCER_PP:         ["polymer.pp.natural_reducer","polymer.pp.natural"],
  PART_BALL_PLASTIC:       ["polymer.pp.ball",           "polymer.pp.ball"],
  PART_DIPTUBE_PP:         ["polymer.pp.translucent",    "polymer.pp.translucent"],
  PART_DIPTUBE_CLEAR:      ["polymer.pp.clear_tube",     "polymer.pp.clear"],
  PART_OVERCAP_CLEAR:      ["polymer.pp.clear_overcap",  "polymer.pp.clear"],
  PART_FILLER_LIQUID:      ["fluid.filler",              "fluid"],
  PART_DRP_RUBBER:         ["polymer.rubber.bulb",       "polymer.rubber"],

  LEATHER_BLACK:           ["polymer.leather.black",       "polymer.leather"],
  LEATHER_BROWN:           ["polymer.leather.brown",       "polymer.leather"],
  LEATHER_LIGHT_BROWN:     ["polymer.leather.light_brown", "polymer.leather"],
  LEATHER_IVORY:           ["polymer.leather.ivory",       "polymer.leather"],
  LEATHER_PINK:            ["polymer.leather.pink",        "polymer.leather"],

  ANSP_BLACK:    ["textile.knit.black",    "textile.knit"],
  ANSP_WHITE:    ["textile.knit.white",    "textile.knit"],
  ANSP_IVORY:    ["textile.knit.ivory",    "textile.knit"],
  ANSP_RED:      ["textile.knit.red",      "textile.knit"],
  ANSP_PINK:     ["textile.knit.pink",     "textile.knit"],
  ANSP_LAVENDER: ["textile.knit.lavender", "textile.knit"],
  ANSP_SILVER:   ["textile.knit.silver",   "textile.knit"],
  ANSP_GOLD:     ["textile.knit.gold",     "textile.knit"],

  STUDIO_BONE:   ["stage.bone", "stage"],
};

/** Vestigial: real glass lives in glassPresets.ts; these are placeholders. */
const DROP = new Set(["GLASS_CLEAR","GLASS_AMBER","GLASS_COBALT","GLASS_GREEN","GLASS_FROSTED"]);

const CLASS_OF = (id) => id.split(".")[0];

/** three.js-only knobs move into lanes.web; the core stays renderer-neutral. */
const WEB_ONLY = new Set(["envMapIntensity", "env", "maps", "alphaHash", "opacity"]);

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function hexToLinear(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((v) => +srgbToLinear(v / 255).toFixed(6));
}

const src = JSON.parse(readFileSync(SRC, "utf8"));
const materials = {};
const aliases = {};
const conflicts = [];

for (const [key, v] of Object.entries(src.materials)) {
  if (DROP.has(key)) continue;
  const hit = MAP[key];
  if (!hit) { conflicts.push(`UNMAPPED legacy key: ${key}`); continue; }
  const [id, family] = hit;
  aliases[key] = id;

  const core = { class: CLASS_OF(id), family };
  const web = {};
  for (const [k, val] of Object.entries(v)) {
    if (val === null || val === undefined) continue;
    if (k === "note") continue;
    if (k === "linear") continue;                  // recomputed below
    if (k === "color") { core.baseColorHex = val; core.baseColorLinear = hexToLinear(val); continue; }
    (WEB_ONLY.has(k) ? web : core)[k] = val;
  }
  if (Object.keys(web).length) core.lanes = { web };
  if (v.note) core.provenance = v.note;

  if (materials[id]) {
    // a second legacy key claims this token — only legal if byte-identical
    const a = JSON.stringify({ ...materials[id], provenance: 0 });
    const b = JSON.stringify({ ...core, provenance: 0 });
    if (a !== b) {
      conflicts.push(`CONFLICT ${id}: ${key} disagrees with the entry already there`);
    } else if (core.provenance && !materials[id].provenance?.includes(core.provenance)) {
      // KEEP BOTH approval records. Two legacy keys merging is a bookkeeping
      // change; an approval is evidence and must never be dropped by one.
      materials[id].provenance =
        `${materials[id].provenance ?? ""}\n\n[also approved as ${key}] ${core.provenance}`.trim();
    }
  } else {
    materials[id] = core;
  }
}

const out = {
  schemaVersion: "1.0.0",
  generatedBy: "scripts/materials/port-tokens.mjs",
  source: SRC,
  note:
    "Tokens are keyed by PHYSICAL MATERIAL; parts reference them by alias or " +
    "assignment. Values are copied byte-for-byte from the approved, locked " +
    "material set — the port changes keying and grouping only. Entries sharing " +
    "a `family` are the same substance: where their values differ that is an " +
    "inconsistency for a human to reconcile, and validate-tokens.mjs reports it.",
  colorManagement: {
    toneMapping: "ACESFilmic",
    outputColorSpace: "sRGB",
    exposure: 0.91,
    blenderParity:
      "Blender must render ACES (not 'Standard') at this exposure. " +
      "See docs/configurator/RENDER-DESIGN-SYSTEM-PROPOSAL.md §3.",
  },
  glass: {
    status: "pending-port",
    source: "src/lib/materials/glassPresets.ts",
    why: "Glass carries per-geometry thickness bakes and approved per-colourway " +
         "env rotations; porting it alongside the metals would have put two " +
         "approved surfaces at risk in one change. Ported next.",
  },
  aliases,
  materials,
};

writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(`wrote ${OUT}: ${Object.keys(materials).length} tokens, ${Object.keys(aliases).length} aliases`);
if (conflicts.length) { console.log("\nISSUES:"); conflicts.forEach((c) => console.log("  " + c)); }
