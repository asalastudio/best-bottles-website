#!/usr/bin/env node
/**
 * Upload Paper Doll PNGs to Sanity and create/update paperDollFamily document.
 *
 * Env:
 *   SANITY_API_TOKEN — write token
 *   NEXT_PUBLIC_SANITY_PROJECT_ID or SANITY_STUDIO_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET (default production)
 *   PAPER_DOLL_ASSETS_ROOT — recanvas output folder with manifest.json and PNGs
 *
 * This command always leaves storefrontReady=false. The Sanity document must
 * pass the independent storefront validator before a separate reviewed release
 * can enable it.
 */

import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@sanity/client";
import sharp from "sharp";

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

function assertManifest(raw) {
    if (raw.familyKey !== "CYL-9ML") throw new Error("Only the reviewed CYL-9ML manifest is supported.");
    if (raw.canvasPreset !== "pdp-2080x2288") throw new Error("Manifest canvasPreset must be pdp-2080x2288.");
    if (raw.canvas?.width !== 2080 || raw.canvas?.height !== 2288) throw new Error("Manifest canvas must be 2080×2288.");
    if (raw.pipelineVersion !== "recanvas-v1") throw new Error("Manifest pipelineVersion must be recanvas-v1.");
    if (!raw.assetRevision) throw new Error("Manifest assetRevision is required.");
    if (!Array.isArray(raw.layers) || raw.layers.length !== 26) throw new Error("Manifest must contain all 26 CYL-9ML layers.");
    const keys = new Set(raw.layers.map((layer) => `${layer.slot}:${layer.variantKey}`));
    if (keys.size !== raw.layers.length) throw new Error("Manifest contains duplicate slot:variantKey values.");
}

async function main() {
    const manifestPath = join(ASSETS_ROOT, "manifest.json");
    const raw = JSON.parse(await readFile(manifestPath, "utf8"));
    assertManifest(raw);
    const familyKey = raw.familyKey;

    const layerAssets = [];
    for (const layer of raw.layers) {
        const abs = join(ASSETS_ROOT, layer.relativePath);
        const metadata = await sharp(abs).metadata();
        if (metadata.width !== 2080 || metadata.height !== 2288 || metadata.channels !== 4 || metadata.hasAlpha !== true) {
            throw new Error(`${layer.relativePath} failed the 2080×2288 RGBA pre-upload gate.`);
        }
        console.log("Uploading", abs);
        const asset = await uploadPng(abs, layer.sourceFilename);
        layerAssets.push({
            _type: "paperDollLayerAsset",
            _key: `${layer.slot}-${layer.variantKey}`.replace(/[^a-z0-9-]/gi, "-"),
            slot: layer.slot,
            variantKey: layer.variantKey,
            sourceFilename: layer.sourceFilename,
            image: {
                _type: "image",
                asset: {
                    _type: "reference",
                    _ref: asset._id,
                },
            },
        });
    }

    const anchorsJson = JSON.stringify(
        { sourceCanvas: raw.sourceCanvas, transform: raw.transform },
        null,
        2
    );

    const doc = {
        _type: "paperDollFamily",
        familyKey,
        displayName: raw.displayName,
        canvasPreset: raw.canvasPreset,
        canvasWidth: raw.canvas.width,
        canvasHeight: raw.canvas.height,
        pipelineVersion: raw.pipelineVersion,
        assetRevision: raw.assetRevision,
        storefrontReady: false,
        layerOrderRollon: raw.layerOrderRollon,
        layerOrderSpray: raw.layerOrderSpray,
        layerOrderLotion: raw.layerOrderLotion,
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

    console.log(`Done. ${layerAssets.length} layer assets uploaded with storefrontReady=false.`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
