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

const ASSETS_ROOT = process.env.PAPER_DOLL_ASSETS_ROOT?.trim();
if (!ASSETS_ROOT) {
    console.error("Set PAPER_DOLL_ASSETS_ROOT to the folder containing family-model.json (e.g. .../CYL-9ML)");
    process.exit(1);
}

const SUBDIRS = {
    body: "bodies",
    cap: "caps",
    roller: "fitments",
    sprayer: "spray",
    pump: "lotion",
};

function variantKeyFromFilename(slot, basename) {
    const base = basename.replace(/\.png$/i, "");
    if (slot === "body") {
        const m = base.match(/^CYL-([A-Z]+)-9ML-body$/i);
        return m ? m[1] : base;
    }
    if (slot === "cap") {
        const m = base.match(/^CYL-9ML-(.+)-cap$/i);
        return m ? m[1] : base;
    }
    if (slot === "roller") {
        const m = base.match(/^CYL-9ML-(.+)-roller$/i);
        return m ? m[1] : base;
    }
    if (slot === "sprayer") {
        const m = base.match(/^CYL-9ML-SPRAY-(.+)-sprayer$/i);
        return m ? m[1] : base;
    }
    if (slot === "pump") {
        const m = base.match(/^CYL-9ML-LOTION-(.+)-pump$/i);
        return m ? m[1] : base;
    }
    return base;
}

async function main() {
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
                variantKey: variantKeyFromFilename(slot, name),
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

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
