#!/usr/bin/env node

import { parseArgs } from "node:util";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

export const PIPELINE_VERSION = "recanvas-v1";
export const SOURCE_CANVAS = Object.freeze({ width: 1000, height: 1300 });
export const TARGET_CANVAS = Object.freeze({ width: 2080, height: 2288 });

const SOURCE_DIRECTORIES = ["bottles", "caps", "fitments", "sprayers", "lotion-pumps"];

const EXPECTED_KEYS = Object.freeze({
    body: ["AMB", "BLU", "CLR", "FRS", "SWL"],
    cap: ["BLK-DOT", "MATT-CU", "MATT-GL", "MATT-SL", "PNK-DOT", "SHN-BLK", "SHN-GL", "SHN-SL", "SL-DOT", "WHT"],
    roller: ["MTL-ROLL", "PLS-ROLL"],
    sprayer: ["BLK", "GL", "MATT-SL", "RD", "SHN-SL", "TUR"],
    pump: ["BLK", "GL", "MATT-SL"],
});

function round(value) {
    return Math.round(value * 1_000_000) / 1_000_000;
}

export function createRecanvasPlan(source = SOURCE_CANVAS, target = TARGET_CANVAS) {
    if (source.width <= 0 || source.height <= 0 || target.width <= 0 || target.height <= 0) {
        throw new Error("Canvas dimensions must be positive numbers.");
    }
    const scale = target.height / source.height;
    const resizedWidth = Math.round(source.width * scale);
    const resizedHeight = target.height;
    if (resizedWidth > target.width) {
        throw new Error("Height-based recanvas would crop horizontally; refusing to alter layer composition.");
    }
    const remainingWidth = target.width - resizedWidth;
    const left = Math.floor(remainingWidth / 2);
    const right = remainingWidth - left;

    return {
        sourceWidth: source.width,
        sourceHeight: source.height,
        targetWidth: target.width,
        targetHeight: target.height,
        scale: round(scale),
        resizedWidth,
        resizedHeight,
        left,
        right,
        top: 0,
        bottom: 0,
    };
}

export function transformPoint(point, plan = createRecanvasPlan()) {
    return {
        x: round(point.x * plan.scale + plan.left),
        y: round(point.y * plan.scale + plan.top),
    };
}

export function canonicalLayerFromSourcePath(sourcePath) {
    const normalized = sourcePath.split(sep).join("/");
    const filename = basename(normalized);
    let match;

    if ((match = filename.match(/^CYL-(AMB|BLU|CLR|FRS|SWL)-9ML-body\.png$/i))) {
        const variantKey = match[1].toUpperCase();
        return {
            slot: "body",
            variantKey,
            sourceFilename: filename,
            relativePath: `bodies/CYL-${variantKey}-9ML-body.png`,
        };
    }
    if ((match = filename.match(/^CYL-9ML-(BLK-DOT|MATT-CU|MATT-GL|MATT-SL|PNK-DOT|SHN-BLK|SHN-GL|SHN-SL|SL-DOT|WHT)-cap\.png$/i))) {
        const variantKey = match[1].toUpperCase();
        return {
            slot: "cap",
            variantKey,
            sourceFilename: filename,
            relativePath: `caps/CYL-9ML-${variantKey}-cap.png`,
        };
    }
    if ((match = filename.match(/^CYL-9ML-(MRL|ROL)-fitment\.png$/i))) {
        const variantKey = match[1].toUpperCase() === "MRL" ? "MTL-ROLL" : "PLS-ROLL";
        return {
            slot: "roller",
            variantKey,
            sourceFilename: filename,
            relativePath: `fitments/CYL-9ML-${variantKey}-roller.png`,
        };
    }
    if ((match = filename.match(/^CYL-9ML-SPR-(BLK|GL|MATT-SL|RD|SHN-SL|TUR)-sprayer\.png$/i))) {
        const variantKey = match[1].toUpperCase();
        return {
            slot: "sprayer",
            variantKey,
            sourceFilename: filename,
            relativePath: `spray/CYL-9ML-SPRAY-${variantKey}-sprayer.png`,
        };
    }
    if ((match = filename.match(/^CYL-9ML-LPM-(BLK|GL|MATT-SL)-pump\.png$/i))) {
        const variantKey = match[1].toUpperCase();
        return {
            slot: "pump",
            variantKey,
            sourceFilename: filename,
            relativePath: `lotion/CYL-9ML-LOTION-${variantKey}-pump.png`,
        };
    }

    throw new Error(`Unrecognized CYL-9ML source layer: ${sourcePath}`);
}

async function regionIsTransparent(filePath, region) {
    if (region.width === 0 || region.height === 0) return true;
    const buffer = await sharp(filePath)
        .extract(region)
        .ensureAlpha()
        .raw()
        .toBuffer();
    for (let index = 3; index < buffer.length; index += 4) {
        if (buffer[index] !== 0) return false;
    }
    return true;
}

export async function recanvasLayer(sourcePath, outputPath, plan = createRecanvasPlan()) {
    const metadata = await sharp(sourcePath).metadata();
    if (metadata.width !== plan.sourceWidth || metadata.height !== plan.sourceHeight) {
        throw new Error(
            `${sourcePath} must be ${plan.sourceWidth}×${plan.sourceHeight}; received ${metadata.width ?? "?"}×${metadata.height ?? "?"}`,
        );
    }
    if (!metadata.hasAlpha || metadata.channels !== 4) {
        throw new Error(`${sourcePath} must be an RGBA PNG with transparency.`);
    }

    await mkdir(dirname(outputPath), { recursive: true });
    await sharp(sourcePath)
        .ensureAlpha()
        .resize({
            width: plan.resizedWidth,
            height: plan.resizedHeight,
            fit: "fill",
            kernel: sharp.kernel.lanczos3,
        })
        .extend({
            left: plan.left,
            right: plan.right,
            top: plan.top,
            bottom: plan.bottom,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png({ compressionLevel: 9, adaptiveFiltering: true })
        .toFile(outputPath);

    const outputMetadata = await sharp(outputPath).metadata();
    const leftTransparent = await regionIsTransparent(outputPath, {
        left: 0,
        top: 0,
        width: plan.left,
        height: plan.targetHeight,
    });
    const rightTransparent = await regionIsTransparent(outputPath, {
        left: plan.targetWidth - plan.right,
        top: 0,
        width: plan.right,
        height: plan.targetHeight,
    });
    const topTransparent = await regionIsTransparent(outputPath, {
        left: 0,
        top: 0,
        width: plan.targetWidth,
        height: 1,
    });
    const bottomTransparent = await regionIsTransparent(outputPath, {
        left: 0,
        top: plan.targetHeight - 1,
        width: plan.targetWidth,
        height: 1,
    });

    return {
        width: outputMetadata.width,
        height: outputMetadata.height,
        channels: outputMetadata.channels,
        hasAlpha: outputMetadata.hasAlpha,
        transparentEdges: leftTransparent && rightTransparent && topTransparent && bottomTransparent,
    };
}

function assertCoverage(entries) {
    const actualKeys = new Set(entries.map((entry) => `${entry.slot}:${entry.variantKey}`));
    const expectedKeys = new Set(
        Object.entries(EXPECTED_KEYS).flatMap(([slot, keys]) => keys.map((key) => `${slot}:${key}`)),
    );
    const missing = [...expectedKeys].filter((key) => !actualKeys.has(key));
    const unexpected = [...actualKeys].filter((key) => !expectedKeys.has(key));
    if (actualKeys.size !== entries.length) {
        throw new Error("Duplicate slot:variantKey values found in CYL-9ML layers.");
    }
    if (missing.length || unexpected.length) {
        throw new Error(`CYL-9ML layer coverage mismatch. Missing: ${missing.join(", ") || "none"}. Unexpected: ${unexpected.join(", ") || "none"}.`);
    }
}

export function buildCylinder9mlManifest(entries, assetRevision) {
    if (!assetRevision?.trim()) throw new Error("assetRevision is required.");
    assertCoverage(entries);

    return {
        familyKey: "CYL-9ML",
        displayName: "9 mL Cylinder — 17-415",
        canvasPreset: "pdp-2080x2288",
        canvas: { ...TARGET_CANVAS },
        sourceCanvas: { ...SOURCE_CANVAS },
        transform: createRecanvasPlan(),
        pipelineVersion: PIPELINE_VERSION,
        assetRevision: assetRevision.trim(),
        storefrontReady: false,
        layerOrderRollon: ["body", "roller", "cap"],
        layerOrderSpray: ["body", "sprayer"],
        layerOrderLotion: ["body", "pump"],
        configurations: {
            rollon: { layers: ["body", "roller", "cap"] },
            spray: { layers: ["body", "sprayer"] },
            lotion: { layers: ["body", "pump"] },
        },
        layers: entries.map((entry) => ({
            ...entry,
            width: TARGET_CANVAS.width,
            height: TARGET_CANVAS.height,
            sanityAssetId: null,
            url: null,
        })),
    };
}

async function discoverSourceLayers(sourceRoot) {
    const entries = [];
    for (const directory of SOURCE_DIRECTORIES) {
        const directoryPath = join(sourceRoot, directory);
        const directoryEntries = await readdir(directoryPath, { withFileTypes: true });
        for (const entry of directoryEntries) {
            if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".png")) continue;
            const sourceRelativePath = `${directory}/${entry.name}`;
            entries.push({
                ...canonicalLayerFromSourcePath(sourceRelativePath),
                sourceRelativePath,
            });
        }
    }
    entries.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    assertCoverage(entries);
    return entries;
}

async function createContactSheet(outputRoot, entries) {
    const columns = 5;
    const cellWidth = 320;
    const cellHeight = 352;
    const rows = Math.ceil(entries.length / columns);
    const composites = [];
    const index = [];

    for (const [position, entry] of entries.entries()) {
        const left = (position % columns) * cellWidth;
        const top = Math.floor(position / columns) * cellHeight;
        const image = await sharp(join(outputRoot, entry.relativePath))
            .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .resize({
                width: cellWidth - 24,
                height: cellHeight - 24,
                fit: "contain",
                background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .png()
            .toBuffer();
        composites.push({ input: image, left: left + 12, top: top + 12 });
        index.push({ position: position + 1, slot: entry.slot, variantKey: entry.variantKey, relativePath: entry.relativePath });
    }

    const contactSheetPath = join(outputRoot, "contact-sheet.png");
    await sharp({
        create: {
            width: columns * cellWidth,
            height: rows * cellHeight,
            channels: 4,
            background: { r: 238, g: 234, b: 226, alpha: 1 },
        },
    }).composite(composites).png().toFile(contactSheetPath);
    await writeFile(join(outputRoot, "contact-sheet-index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");
    return contactSheetPath;
}

async function createConfigurationContactSheet(outputRoot, entries) {
    const byKey = new Map(entries.map((entry) => [`${entry.slot}:${entry.variantKey}`, entry]));
    const bodies = EXPECTED_KEYS.body;
    const configurations = [
        { mode: "rollon-metal-white", layers: [["roller", "MTL-ROLL"], ["cap", "WHT"]] },
        { mode: "rollon-plastic-gold", layers: [["roller", "PLS-ROLL"], ["cap", "MATT-GL"]] },
        { mode: "spray-matte-silver", layers: [["sprayer", "MATT-SL"]] },
        { mode: "lotion-black", layers: [["pump", "BLK"]] },
    ];
    const columns = configurations.length;
    const cellWidth = 360;
    const cellHeight = 520;
    const composites = [];
    const index = [];

    for (const [row, bodyKey] of bodies.entries()) {
        for (const [column, configuration] of configurations.entries()) {
            const body = byKey.get(`body:${bodyKey}`);
            const layers = [body, ...configuration.layers.map(([slot, key]) => byKey.get(`${slot}:${key}`))];
            if (layers.some((layer) => !layer)) {
                throw new Error(`Cannot build contact-sheet configuration ${bodyKey}/${configuration.mode}.`);
            }
            const fullComposite = await sharp({
                create: {
                    width: TARGET_CANVAS.width,
                    height: TARGET_CANVAS.height,
                    channels: 4,
                    background: { r: 0, g: 0, b: 0, alpha: 0 },
                },
            }).composite(layers.map((layer) => ({ input: join(outputRoot, layer.relativePath) }))).png().toBuffer();
            const tile = await sharp(fullComposite)
                .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .resize({
                    width: cellWidth - 32,
                    height: cellHeight - 32,
                    fit: "contain",
                    background: { r: 0, g: 0, b: 0, alpha: 0 },
                })
                .png()
                .toBuffer();
            composites.push({ input: tile, left: column * cellWidth + 16, top: row * cellHeight + 16 });
            index.push({ row: row + 1, column: column + 1, body: bodyKey, mode: configuration.mode });
        }
    }

    const contactSheetPath = join(outputRoot, "configuration-contact-sheet.png");
    await sharp({
        create: {
            width: columns * cellWidth,
            height: bodies.length * cellHeight,
            channels: 4,
            background: { r: 238, g: 234, b: 226, alpha: 1 },
        },
    }).composite(composites).png().toFile(contactSheetPath);
    await writeFile(join(outputRoot, "configuration-contact-sheet-index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");
    return contactSheetPath;
}

export async function runCylinder9mlRecanvas({ sourceRoot, outputRoot, assetRevision, manifestPath }) {
    const source = resolve(sourceRoot);
    const output = resolve(outputRoot);
    if (source === output) throw new Error("Source and output directories must be different; in-place recanvas is prohibited.");

    const entries = await discoverSourceLayers(source);
    const plan = createRecanvasPlan();
    const layerAudit = [];
    for (const entry of entries) {
        const sourcePath = join(source, entry.sourceRelativePath);
        const outputPath = join(output, entry.relativePath);
        const audit = await recanvasLayer(sourcePath, outputPath, plan);
        if (
            audit.width !== TARGET_CANVAS.width
            || audit.height !== TARGET_CANVAS.height
            || audit.channels !== 4
            || audit.hasAlpha !== true
            || audit.transparentEdges !== true
        ) {
            throw new Error(`Recanvas audit failed for ${entry.relativePath}: ${JSON.stringify(audit)}`);
        }
        layerAudit.push({ relativePath: entry.relativePath, ...audit });
    }

    const manifestEntries = entries.map(({ sourceRelativePath: _sourceRelativePath, ...entry }) => entry);
    const manifest = buildCylinder9mlManifest(manifestEntries, assetRevision);
    await mkdir(output, { recursive: true });
    await writeFile(join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    await writeFile(join(output, "audit.json"), `${JSON.stringify({ plan, layers: layerAudit }, null, 2)}\n`, "utf8");
    await createContactSheet(output, entries);
    await createConfigurationContactSheet(output, entries);
    if (manifestPath) {
        await mkdir(dirname(resolve(manifestPath)), { recursive: true });
        await writeFile(resolve(manifestPath), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    }

    return { manifest, audit: layerAudit, outputRoot: output };
}

async function main() {
    const { values } = parseArgs({
        options: {
            source: { type: "string" },
            output: { type: "string" },
            manifest: { type: "string" },
            "asset-revision": { type: "string" },
        },
    });
    if (!values.source || !values.output || !values["asset-revision"]) {
        throw new Error("Usage: node scripts/paper-doll/recanvas-cylinder-9ml.mjs --source <dir> --output <dir> --asset-revision <id> [--manifest <path>]");
    }

    const result = await runCylinder9mlRecanvas({
        sourceRoot: values.source,
        outputRoot: values.output,
        assetRevision: values["asset-revision"],
        manifestPath: values.manifest,
    });
    process.stdout.write(`Recanvased ${result.audit.length} CYL-9ML layers to ${result.outputRoot}\n`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
    main().catch((error) => {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
    });
}
