#!/usr/bin/env node
/**
 * Build data/paper-doll/<familyKey>/manifest.json from family-model.json + on-disk PNGs.
 *
 * Usage:
 *   PAPER_DOLL_ASSETS_ROOT=/path/to/CYL-9ML node scripts/paper-doll/generate-manifest.mjs
 *
 * Does not upload to Sanity — run upload-paper-doll-family.mjs after this.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "../..");

// Resolved inside main() rather than at module scope, so the parser below can be
// imported and tested without the script exiting on a missing env var.
function assetsRoot() {
    const r = process.env.PAPER_DOLL_ASSETS_ROOT?.trim();
    if (!r) {
        console.error("Set PAPER_DOLL_ASSETS_ROOT to the folder containing family-model.json (e.g. .../CYL-9ML)");
        process.exit(1);
    }
    return r;
}

const SUBDIRS = {
    body: "bodies",
    cap: "caps",
    roller: "fitments",
    sprayer: "spray",
    pump: "lotion",
};

const SLOT_SUFFIX = { body: "body", cap: "cap", roller: "roller", sprayer: "sprayer", pump: "pump" };
// Some slots carry a role infix between the family key and the variant, e.g.
// CYL-9ML-SPRAY-BLK-sprayer. Kept as a lookup so a new family only has to name
// its infixes, not hand-write another five regexes.
const SLOT_INFIX = { sprayer: "SPRAY", pump: "LOTION" };

const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Derive a variantKey from a layer filename.
 *
 * Patterns are BUILT FROM familyKey rather than hardcoded. The previous version
 * embedded /^CYL-([A-Z]+)-9ML-body$/ and friends, so every filename in any other
 * family fell through to the raw basename and the manifest silently carried
 * junk variantKeys that the render API could never match.
 *
 * familyKey "CYL-9ML" splits into a family token and a size token, because the
 * body filename interleaves the variant between them (CYL-CLR-9ML-body) while
 * every other slot appends it (CYL-9ML-SHN-BLK-cap).
 */
export function variantKeyFromFilename(slot, basename, familyKey) {
    const base = basename.replace(/\.png$/i, "");
    const fam = esc(familyKey);
    const suffix = SLOT_SUFFIX[slot] ?? slot;

    if (slot === "body") {
        const i = familyKey.lastIndexOf("-");
        if (i > 0) {
            const head = esc(familyKey.slice(0, i));      // CYL
            const size = esc(familyKey.slice(i + 1));     // 9ML
            const m = base.match(new RegExp(`^${head}-(.+)-${size}-${suffix}$`, "i"));
            if (m) return m[1];
        }
        const m2 = base.match(new RegExp(`^${fam}-(.+)-${suffix}$`, "i"));
        return m2 ? m2[1] : base;
    }

    const infix = SLOT_INFIX[slot];
    if (infix) {
        const m = base.match(new RegExp(`^${fam}-${esc(infix)}-(.+)-${suffix}$`, "i"));
        if (m) return m[1];
    }
    const m = base.match(new RegExp(`^${fam}-(.+)-${suffix}$`, "i"));
    if (m) return m[1];

    // Last resort: strip a trailing slot suffix so the key is at least usable.
    const m3 = base.match(new RegExp(`^(.+)-${suffix}$`, "i"));
    return m3 ? m3[1] : base;
}

async function main() {
    const ASSETS_ROOT = assetsRoot();
    const modelPath = join(ASSETS_ROOT, "family-model.json");
    const raw = JSON.parse(await readFile(modelPath, "utf8"));
    const familyKey = raw.family ?? "CYL-9ML";

    const layers = [];
    for (const [slot, sub] of Object.entries(SUBDIRS)) {
        const names = raw.availableComponents?.[slot] ?? [];
        for (const name of names) {
            const filePath = join(ASSETS_ROOT, sub, name);
            let meta = { width: null, height: null };
            try {
                const i = sharp(filePath);
                meta = await i.metadata();
            } catch (e) {
                console.warn(`Skip missing file: ${filePath}`);
                continue;
            }
            layers.push({
                slot,
                variantKey: variantKeyFromFilename(slot, name, familyKey),
                sourceFilename: name,
                relativePath: `${sub}/${name}`,
                width: meta.width,
                height: meta.height,
                sanityAssetId: null,
                url: null,
            });
        }
    }

    const manifest = {
        generated_at: new Date().toISOString(),
        pipeline_version: "1.0.0",
        familyKey,
        displayName: raw.displayName ?? familyKey,
        canvas: raw.canvas,
        layerOrderRollon: raw.layerOrder ?? raw.configurations?.rollon?.layers,
        layerOrderSpray: raw.layerOrderSpray ?? raw.configurations?.spray?.layers,
        layerOrderLotion: raw.layerOrderLotion ?? raw.configurations?.lotion?.layers,
        anchors: raw.anchors,
        configurations: raw.configurations,
        layers,
    };

    const outDir = join(REPO_ROOT, "data", "paper-doll", familyKey);
    await mkdir(outDir, { recursive: true });
    const outFile = join(outDir, "manifest.json");
    await writeFile(outFile, JSON.stringify(manifest, null, 2), "utf8");
    console.log(`Wrote ${outFile} (${layers.length} layers)`);
}

const invokedDirectly = process.argv[1] &&
    fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
    main().catch((e) => {
        console.error(e);
        process.exit(1);
    });
}
