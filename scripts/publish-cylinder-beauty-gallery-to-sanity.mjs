#!/usr/bin/env node

import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@sanity/client";
import dotenv from "dotenv";
import sharp from "sharp";

import {
    CYLINDER_BEAUTY_UPLOADS,
    buildCylinderBeautyGalleryDocument,
} from "./cylinder-beauty-gallery-sanity-core.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
dotenv.config({ path: path.join(projectRoot, ".env.local") });

const apply = process.argv.includes("--apply");
const projectId = process.env.SANITY_STUDIO_PROJECT_ID
    || process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.SANITY_STUDIO_DATASET
    || process.env.NEXT_PUBLIC_SANITY_DATASET
    || "production";
const token = process.env.SANITY_API_TOKEN;

if (!projectId) throw new Error("Missing Best Bottles Sanity project id");
if (apply && !token) throw new Error("SANITY_API_TOKEN is required with --apply");

for (const asset of CYLINDER_BEAUTY_UPLOADS) {
    if (!existsSync(asset.absolutePath)) throw new Error(`Missing generated asset: ${asset.absolutePath}`);
    const metadata = await sharp(asset.absolutePath).metadata();
    if (metadata.width !== 2080 || metadata.height !== 2288) {
        throw new Error(`${asset.glassKey} must be 2080 x 2288; found ${metadata.width} x ${metadata.height}`);
    }
}

if (!apply) {
    console.log(JSON.stringify({
        mode: "dry-run",
        projectId,
        dataset,
        documentId: "paperDollBeautyGallery.CYL-9ML",
        storefrontReady: true,
        assets: CYLINDER_BEAUTY_UPLOADS.map((asset) => ({
            glassKey: asset.glassKey,
            path: asset.absolutePath,
            dimensions: "2080x2288",
        })),
    }, null, 2));
    process.exit(0);
}

const sanity = createClient({
    projectId,
    dataset,
    token,
    apiVersion: "2026-08-04",
    useCdn: false,
});

const uploadedAssets = {};
for (const asset of CYLINDER_BEAUTY_UPLOADS) {
    console.log(`[${asset.glassKey}] uploading ${path.basename(asset.absolutePath)}`);
    const uploaded = await sanity.assets.upload("image", createReadStream(asset.absolutePath), {
        filename: `cylinder-${asset.outputSlug}-metal-roller-matte-silver-sandstone-v1.png`,
        contentType: "image/png",
        label: `CYL-9ML ${asset.glassLabel} sandstone beauty hero`,
        title: `Cylinder 9 mL ${asset.glassLabel} · Sandstone Beauty Hero`,
    });
    uploadedAssets[asset.glassKey] = uploaded._id;
}

const document = buildCylinderBeautyGalleryDocument(uploadedAssets);
await sanity.createOrReplace(document);

const verification = await sanity.fetch(`
  *[_id == "paperDollBeautyGallery.CYL-9ML"][0] {
    _id,
    familyKey,
    storefrontReady,
    canvasWidth,
    canvasHeight,
    "heroCount": count(heroes),
    "glassKeys": heroes[].glassKey,
    "dimensions": heroes[] {
      glassKey,
      "width": image.asset->metadata.dimensions.width,
      "height": image.asset->metadata.dimensions.height
    }
  }
`);

if (
    verification?._id !== "paperDollBeautyGallery.CYL-9ML"
    || verification?.storefrontReady !== true
    || verification?.heroCount !== 5
    || verification?.dimensions?.some((image) => image.width !== 2080 || image.height !== 2288)
) {
    throw new Error(`Sanity verification failed: ${JSON.stringify(verification)}`);
}

console.log(JSON.stringify({ mode: "applied", projectId, dataset, verification }, null, 2));
