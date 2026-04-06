#!/usr/bin/env node
/**
 * Upload CYL-9ML paper doll component PNGs to Sanity and create the family document.
 *
 * Usage: node tools/paper-doll-pipeline/upload-to-sanity.mjs
 */
import { createClient } from "@sanity/client";
import { readFileSync } from "fs";
import { join, basename } from "path";
import { randomUUID } from "crypto";

const ASSET_ROOT = join(
    process.env.HOME,
    "Desktop/AI-OS/clients/best-bottles/CYL-9ML"
);

const familyModel = JSON.parse(
    readFileSync(join(ASSET_ROOT, "family-model.json"), "utf-8")
);

const client = createClient({
    projectId: "gh97irjh",
    dataset: "production",
    token: process.env.SANITY_API_TOKEN,
    apiVersion: "2025-03-25",
    useCdn: false,
});

// Map from directory name → slot value in schema
const SLOT_MAP = {
    bodies: "body",
    caps: "cap",
    fitments: "roller",
    spray: "sprayer",
    lotion: "pump",
};

// Extract variant key from filename
function extractVariantKey(filename, slot) {
    const name = filename.replace(/\.(png|jpg)$/i, "");
    // bodies: CYL-AMB-9ML-body → AMB
    if (slot === "body") {
        const match = name.match(/CYL-(\w+)-9ML-body/);
        return match ? match[1] : name;
    }
    // caps: CYL-9ML-BLK-DOT-cap → BLK-DOT
    if (slot === "cap") {
        const match = name.match(/CYL-9ML-(.+)-cap/);
        return match ? match[1] : name;
    }
    // fitments: CYL-9ML-MTL-ROLL-roller → MTL-ROLL
    if (slot === "roller") {
        const match = name.match(/CYL-9ML-(.+)-roller/);
        return match ? match[1] : name;
    }
    // spray: CYL-9ML-SPRAY-BLK-sprayer → SPRAY-BLK
    if (slot === "sprayer") {
        const match = name.match(/CYL-9ML-(.+)-sprayer/);
        return match ? match[1] : name;
    }
    // lotion: CYL-9ML-LOTION-BLK-pump → LOTION-BLK
    if (slot === "pump") {
        const match = name.match(/CYL-9ML-(.+)-pump/);
        return match ? match[1] : name;
    }
    return name;
}

async function uploadAsset(filePath, filename) {
    const buffer = readFileSync(filePath);
    const asset = await client.assets.upload("image", buffer, {
        filename,
        contentType: "image/png",
    });
    console.log(`  ✓ Uploaded ${filename} → ${asset._id}`);
    return asset;
}

async function main() {
    console.log("Paper Doll → Sanity Upload: CYL-9ML");
    console.log("=" .repeat(50));

    // 1. Upload all component PNGs
    const layerAssets = [];
    const dirs = Object.entries(SLOT_MAP);

    for (const [dir, slot] of dirs) {
        const dirPath = join(ASSET_ROOT, dir);
        const componentKey = slot === "roller" ? "roller" : slot;
        const filenames =
            familyModel.availableComponents[componentKey] ||
            familyModel.availableComponents[slot] ||
            [];

        console.log(`\n📁 ${dir}/ (${filenames.length} files, slot: ${slot})`);

        for (const filename of filenames) {
            const filePath = join(dirPath, filename);
            try {
                const asset = await uploadAsset(filePath, filename);
                layerAssets.push({
                    _key: randomUUID().slice(0, 12),
                    _type: "paperDollLayerAsset",
                    slot,
                    variantKey: extractVariantKey(filename, slot),
                    sourceFilename: filename,
                    image: {
                        _type: "image",
                        asset: {
                            _type: "reference",
                            _ref: asset._id,
                        },
                    },
                });
            } catch (err) {
                console.error(`  ✗ Failed ${filename}: ${err.message}`);
            }
        }
    }

    console.log(`\n✅ Uploaded ${layerAssets.length}/26 assets`);

    // 2. Build anchors JSON from family-model
    const anchorsJson = JSON.stringify(
        {
            anchors: familyModel.anchors,
            contentBounds: familyModel.contentBounds,
        },
        null,
        2
    );

    // 3. Create the paperDollFamily document
    console.log("\n📄 Creating paperDollFamily document...");
    const doc = {
        _type: "paperDollFamily",
        familyKey: familyModel.family,
        displayName: familyModel.displayName,
        canvasWidth: familyModel.canvas.width,
        canvasHeight: familyModel.canvas.height,
        layerOrderRollon: familyModel.configurations.rollon.layers,
        layerOrderSpray: familyModel.configurations.spray.layers,
        layerOrderLotion: familyModel.configurations.lotion.layers,
        anchorsJson,
        layerAssets,
    };

    const created = await client.create(doc);
    console.log(`✅ Created paperDollFamily: ${created._id}`);
    console.log(`   familyKey: ${created.familyKey}`);
    console.log(`   layerAssets: ${created.layerAssets.length} components`);

    // 4. Publish it
    console.log("\n📤 Publishing...");
    await client
        .patch(created._id)
        .set({ _id: created._id })
        .commit({ autoGenerateArrayKeys: false });
    console.log("✅ Published successfully");

    console.log("\n🎉 Done! CYL-9ML family is live in Sanity.");
}

main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
});
