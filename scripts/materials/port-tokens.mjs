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
  CAP_DOTS_PINK:           ["polymer.pp.pink_flat.dots", "polymer.pp"],
  CAP_COPPER:              ["metal.copper.polished",     "metal.copper"],
  PART_STUD_CHROME:        ["metal.chrome.polished",     "metal.chrome.polished"],
  PART_STUD_CHROME_BRIGHT: ["metal.chrome.bright",       "metal.chrome.bright"],
  PART_BALL_STEEL:         ["metal.steel.ball",          "metal.steel.polished"],
  PART_STUD_STEEL:         ["metal.steel.stud",          "metal.steel.polished"],
  SPRAY_RED:               ["metal.anodised.red",        "metal.anodised"],
  SPRAY_TURQUOISE:         ["metal.anodised.turquoise",  "metal.anodised"],
  // DRAFTS 2026-08-31 (pink dot cap session) — pending lab approval
  CAP_PINK:                ["polymer.pp.pink_flat",      "polymer.pp"],
  PART_STUD_RHINESTONE:    ["gem.rhinestone",            "gem.rhinestone"],

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

/** The old GLASS_* rows in materials.json were empty placeholders (all
 *  #ffffff, no glass fields). Real glass is ported below from the
 *  approved presets, and reclaims these alias names. */
const DROP = new Set(["GLASS_CLEAR","GLASS_AMBER","GLASS_COBALT","GLASS_GREEN","GLASS_FROSTED"]);

const CLASS_OF = (id) => id.split(".")[0];

/** three.js-only knobs move into lanes.web; the core stays renderer-neutral. */
const WEB_ONLY = new Set(["envMapIntensity", "env", "maps", "alphaHash", "opacity"]);

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function linearToSrgb(c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}
function linearToHex(rgb) {
  const v = rgb.map((c) => Math.max(0, Math.min(255, Math.round(linearToSrgb(c) * 255))));
  return "#" + v.map((x) => x.toString(16).padStart(2, "0")).join("");
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
    if (k === "linear") {
      // THE MEASURED ANCHOR. materials.json carries two colours: `color`,
      // which the renderer actually uses, and `linear`, which recorded the
      // physicallybased measurement the value was anchored to. Only the hex
      // ever reached the screen, so the anchor was invisible — shiny gold
      // renders #ffe496 while its anchor is the library's #fff3ca. Keep it
      // explicitly, so a deviation from measured reality is a fact in the
      // file rather than something you have to reverse-engineer.
      core.measuredAnchor = { linear: val, hex: linearToHex(val),
                              source: "physicallybased.info metal F0 (CC0)" };
      continue;
    }
    if (k === "color") { core.baseColorHex = val; core.baseColorLinear = hexToLinear(val); continue; }
    (WEB_ONLY.has(k) ? web : core)[k] = val;
  }
  if (core.measuredAnchor && core.baseColorHex &&
      core.measuredAnchor.hex.toLowerCase() !== core.baseColorHex.toLowerCase()) {
    const a = core.measuredAnchor.hex, b = core.baseColorHex;
    const px = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [ar, ag, ab] = px(a), [br, bg, bb] = px(b);
    core.measuredAnchor.deltaRgb = [br - ar, bg - ag, bb - ab];
    core.measuredAnchor.why =
      "Rendered colour deviates from the measurement — approved in the lab " +
      "under ACES, which desaturates. Blender renders 'Standard' and has no " +
      "such desaturation, so the hero lane must NOT apply this push twice: " +
      "emit the anchor there, or match Blender's view transform to ACES first.";
  }
  if (Object.keys(web).length) core.lanes = { web };
  if (v.note) core.provenance = v.note;

  if (materials[id]) {
    // a second legacy key claims this token — only legal if byte-identical
    // provenance and measuredAnchor are BOOKKEEPING, not render values —
    // two keys may legitimately carry different records of the same
    // rendered material. Compare only what reaches the screen.
    const a = JSON.stringify({ ...materials[id], provenance: 0, measuredAnchor: 0 });
    const b = JSON.stringify({ ...core, provenance: 0, measuredAnchor: 0 });
    if (a !== b) {
      conflicts.push(`CONFLICT ${id}: ${key} disagrees with the entry already there`);
    } else if (core.measuredAnchor && materials[id].measuredAnchor &&
               core.measuredAnchor.hex !== materials[id].measuredAnchor.hex) {
      // both keys render the same, but recorded different measurements.
      // Surface the disagreement instead of silently keeping one.
      (materials[id].measuredAnchor.disputed ??= []).push(
        { key, hex: core.measuredAnchor.hex, linear: core.measuredAnchor.linear });
    }
    if (core.provenance && !materials[id].provenance?.includes(core.provenance)) {
      // KEEP BOTH approval records. Two legacy keys merging is a bookkeeping
      // change; an approval is evidence and must never be dropped by one.
      materials[id].provenance =
        `${materials[id].provenance ?? ""}\n\n[also approved as ${key}] ${core.provenance}`.trim();
    }
  } else {
    materials[id] = core;
  }
}


// ---------------------------------------------------------------- glass
// Ported from the SAME approved values the app already renders, extracted
// exactly by scripts/materials/extract-glass.mts (no regex parsing — the
// provenance strings are approval records and must survive verbatim).
//
// thickness stays PER-GEOMETRY. The flat `thickness` here is only the
// thin-wall fallback; bodies with a bake use it, which is why the token
// records the source rather than pretending one number fits every bottle.
const GLASS_SRC = "data/materials/glass-presets.generated.json";
let glassCount = 0;
try {
  const presets = JSON.parse(readFileSync(GLASS_SRC, "utf8"));
  const GLASS_WEB = new Set([
    "envMapIntensity", "distortion", "anisotropicBlur", "envRotationDeg",
    "thinWall", "thicknessBake",
  ]);
  for (const [pid, g] of Object.entries(presets)) {
    const id = `glass.${pid}`;
    // family = substance + FINISH, same rule as the metals. clear/swirl are
    // the same flint glass (swirl differs by BODY MESH, not material);
    // amber/cobalt are one pigmented finish differing only in attenuation;
    // frosted is a genuinely different, etched surface.
    const GLASS_FAMILY = {
      clear: "glass.flint", swirl: "glass.flint",
      amber: "glass.pigmented", cobalt: "glass.pigmented",
      frosted: "glass.etched",
    };
    const core = { class: "glass", family: GLASS_FAMILY[pid] ?? "glass" };
    const web = {};
    for (const [k, v] of Object.entries(g)) {
      if (v === null || v === undefined) continue;
      if (k === "id" || k === "label" || k === "provenance") continue;
      if (k === "thickness") {
        core.thickness = {
          source: "geometry",
          bake: "/models/bodies-thickness/{bodyId}.thickness.png",
          fallbackM: v,
          why: "real wall thickness per body; the flat value is the thin-wall path only",
        };
        continue;
      }
      (GLASS_WEB.has(k) ? web : core)[k] = v;
    }
    if (Object.keys(web).length) core.lanes = { web };
    if (g.provenance) core.provenance = g.provenance;
    core.label = g.label;
    materials[id] = core;
    aliases[`GLASS_${pid.toUpperCase()}`] = id;
    glassCount++;
  }
} catch (e) {
  conflicts.push(`GLASS NOT PORTED — run: npx tsx scripts/materials/extract-glass.mts (${e.message})`);
}


// ------------------------------------------------------- declared changes
// The port is otherwise value-for-value. Anything deliberately CHANGED is
// declared here with a reason, and verify-parity exempts exactly these and
// nothing else — so "no material value changed" stays a real guarantee
// instead of quietly eroding.
const intentionalChanges = [];
for (const [id, m] of Object.entries(materials)) {
  if (!id.startsWith("polymer.leather.")) continue;
  const from = m.lanes?.web?.maps ?? null;
  (m.lanes ??= {}).web = { ...(m.lanes.web ?? {}), maps: "leather" };
  intentionalChanges.push({
    token: id, field: "lanes.web.maps", from, to: "leather",
    why: "Leather wore the generic matte maps, so it read as painted plastic. " +
         "Now uses the CC0 ambientCG Leather028 grain (normal + roughness at " +
         "512, public/models/pbr/leather). Colour still comes from the token: " +
         "the source colour map is brown and would overwrite all five approved " +
         "colourways.",
  });
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
  intentionalChanges,
  aliases,
  materials,
};

writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(`wrote ${OUT}: ${Object.keys(materials).length} tokens (${glassCount} glass), ${Object.keys(aliases).length} aliases`);
if (conflicts.length) { console.log("\nISSUES:"); conflicts.forEach((c) => console.log("  " + c)); }
