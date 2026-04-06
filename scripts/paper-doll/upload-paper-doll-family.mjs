#!/usr/bin/env node
/**
 * Upload Paper Doll PNGs to Sanity and create/update paperDollFamily document.
 *
 * Env:
 *   SANITY_API_TOKEN — write token
 *   NEXT_PUBLIC_SANITY_PROJECT_ID or SANITY_STUDIO_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET (default production)
 *   PAPER_DOLL_ASSETS_ROOT — folder with family-model.json and bodies/, caps/, etc.
 */

import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@sanity/client";

const projectId =
    process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || process.env.SANITY_STUDIO_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const token = process.env.SANITY_API_TOKEN;
const ASSETS_ROOT = process.env.PAPER_DOLL_ASSETS_ROOT?.trim();

if (!projectId || !token) {
    console.error("Missing SANITY_API_TOKEN or project id env vars.");
    process.exit(1);
}
if (!ASSETS_ROOT) {
    console.error("Set PAPER_DOLL_ASSETS_ROOT");
    process.exit(1);
}

const client = createClient({
    projectId,
    dataset,
    apiVersion: "2025-02-19",
    token,
    useCdn: false,
});

async function uploadPng(absPath, filename) {
    return client.assets.upload("image", createReadStream(absPath), {
        filename,
        contentType: "image/png",
    });
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

    const layerAssets = [];

    for (const [slot, sub] of Object.entries(SUBDIRS)) {
        const names = raw.availableComponents?.[slot] ?? [];
        for (const name of names) {
            const abs = join(ASSETS_ROOT, sub, name);
            console.log("Uploading", abs);
            const asset = await uploadPng(abs, name);
            layerAssets.push({
                _type: "paperDollLayerAsset",
                _key: `${slot}-${variantKeyFromFilename(slot, name)}`.replace(/[^a-z0-9-]/gi, "-"),
                slot,
                variantKey: variantKeyFromFilename(slot, name),
                sourceFilename: name,
                image: {
                    _type: "image",
                    asset: {
                        _type: "reference",
                        _ref: asset._id,
                    },
                },
            });
        }
    }

    const anchorsJson = JSON.stringify(
        { anchors: raw.anchors, contentBounds: raw.contentBounds },
        null,
        2
    );

    const doc = {
        _type: "paperDollFamily",
        familyKey,
        displayName: raw.displayName ?? "9ml Cylinder",
        canvasWidth: raw.canvas?.width ?? 2000,
        canvasHeight: raw.canvas?.height ?? 2200,
        layerOrderRollon: raw.layerOrder ?? ["body", "roller", "cap"],
        layerOrderSpray: raw.layerOrderSpray ?? ["body", "sprayer"],
        layerOrderLotion: raw.layerOrderLotion ?? ["body", "pump"],
        anchorsJson,
        layerAssets,
    };

    const existing = await client.fetch(
        `*[_type == "paperDollFamily" && familyKey == $k][0]._id`,
        { k: familyKey }
    );

    if (existing) {
        await client.patch(existing).set(doc).commit();
        console.log("Patched paperDollFamily", existing);
    } else {
        const created = await client.create(doc);
        console.log("Created paperDollFamily", created._id);
    }

    console.log(`Done. ${layerAssets.length} layer assets uploaded.`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
