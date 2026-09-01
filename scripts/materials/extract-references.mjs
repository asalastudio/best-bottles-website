#!/usr/bin/env node
/**
 * extract-references.mjs — CANONICAL REFERENCE LIBRARY.
 *
 * Jordan's standard: "realism is non-negotiable … every single required
 * item that needs a digital twin needs to be stored as the parallel
 * reference for every single component."
 *
 * The PSD library IS the reference. This walks it, flattens every closure
 * PSD to a PNG beside a manifest row, and records what each one is FOR —
 * so every digital twin has a parallel reference sitting next to it and
 * "does it match?" becomes a comparison, not an opinion.
 *
 * Writes:
 *   public/references/closures/<slug>.png     flattened reference
 *   data/references/closures.json             manifest (component, finish,
 *                                             colourway, token, px/mm anchor)
 *
 *   node scripts/materials/extract-references.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const SRC = "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Original-Photoshop-Sources/20. Closures - Cap, Sprayers, Lotion pumps, etc";
const OUT_IMG = "public/references/closures";
const OUT_MAN = "data/references/closures.json";

mkdirSync(OUT_IMG, { recursive: true });
mkdirSync("data/references", { recursive: true });

// python does the PSD work (psd_tools); node orchestrates + writes the manifest
const py = `
import json, glob, os, re, sys
from psd_tools import PSDImage
SRC = ${JSON.stringify(SRC)}
OUT = ${JSON.stringify(OUT_IMG)}
rows = []
for path in sorted(glob.glob(os.path.join(SRC, "*", "*.psd"))):
    folder = os.path.basename(os.path.dirname(path))
    stem = os.path.splitext(os.path.basename(path))[0]
    name = re.sub(r"^\\d+\\.\\s*", "", stem)
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", (folder + "-" + name)).strip("-").lower()
    try:
        psd = PSDImage.open(path)
        img = psd.composite().convert("RGB")
    except Exception as e:
        rows.append({"slug": slug, "source": path, "error": str(e)[:120]})
        continue
    img.save(os.path.join(OUT, slug + ".png"))
    finish = None
    m = re.search(r"(\\d{2}-\\d{3})", folder + " " + name)
    if m: finish = m.group(1)
    comp = None
    low = folder.lower()
    for key, c in [("roll on","roller"),("metal roll","roller-metal"),("spray","sprayer"),
                   ("sprayer","sprayer"),("lotion","pump"),("cap","cap"),("reducer","reducer"),
                   ("dropper","dropper"),("ansp tsl","bulb-tassel"),("ansp","bulb"),
                   ("wand","wand"),("ring","ring")]:
        if key in low: comp = c; break
    rows.append({"slug": slug, "component": comp, "finish": finish,
                 "colourway": name, "folder": folder,
                 "image": "/references/closures/" + slug + ".png",
                 "source": path, "w": img.width, "h": img.height})
print(json.dumps(rows))
`;
const out = execFileSync("python3", ["-c", py], { maxBuffer: 1 << 28 }).toString();
const rows = JSON.parse(out);
const ok = rows.filter((r) => !r.error);
writeFileSync(OUT_MAN, JSON.stringify({
  generatedBy: "scripts/materials/extract-references.mjs",
  note: "CANONICAL references for every closure digital twin. The PSD library is the standard; these flattened PNGs are what a render is measured against.",
  count: ok.length,
  references: ok,
}, null, 2));
console.log(`wrote ${ok.length} references -> ${OUT_IMG}/  (manifest ${OUT_MAN})`);
const byComp = {};
for (const r of ok) byComp[r.component ?? "?"] = (byComp[r.component ?? "?"] ?? 0) + 1;
console.log("by component:", byComp);
if (rows.length - ok.length) console.log("failed:", rows.length - ok.length);
