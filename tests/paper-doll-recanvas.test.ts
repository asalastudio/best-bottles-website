import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

// The production pipeline remains directly executable by Node, so its tested
// implementation lives in an ESM script rather than in the storefront bundle.
import {
    buildCylinder9mlManifest,
    canonicalLayerFromSourcePath,
    createRecanvasPlan,
    recanvasLayer,
    transformPoint,
} from "../scripts/paper-doll/recanvas-cylinder-9ml.mjs";

describe("CYL-9ML 2080×2288 recanvas pipeline", () => {
    it("uses one uniform height-based transform for every layer", () => {
        const plan = createRecanvasPlan({ width: 1000, height: 1300 });

        expect(plan).toEqual({
            sourceWidth: 1000,
            sourceHeight: 1300,
            targetWidth: 2080,
            targetHeight: 2288,
            scale: 1.76,
            resizedWidth: 1760,
            resizedHeight: 2288,
            left: 160,
            right: 160,
            top: 0,
            bottom: 0,
        });
        expect(transformPoint({ x: 500, y: 650 }, plan)).toEqual({ x: 1040, y: 1144 });
    });

    it("normalizes the source pipeline names into Sanity layer keys", () => {
        expect(canonicalLayerFromSourcePath("bottles/CYL-AMB-9ML-body.png")).toMatchObject({
            slot: "body",
            variantKey: "AMB",
            relativePath: "bodies/CYL-AMB-9ML-body.png",
        });
        expect(canonicalLayerFromSourcePath("fitments/CYL-9ML-MRL-fitment.png")).toMatchObject({
            slot: "roller",
            variantKey: "MTL-ROLL",
            relativePath: "fitments/CYL-9ML-MTL-ROLL-roller.png",
        });
        expect(canonicalLayerFromSourcePath("fitments/CYL-9ML-ROL-fitment.png")).toMatchObject({
            slot: "roller",
            variantKey: "PLS-ROLL",
        });
        expect(canonicalLayerFromSourcePath("sprayers/CYL-9ML-SPR-TUR-sprayer.png")).toMatchObject({
            slot: "sprayer",
            variantKey: "TUR",
            relativePath: "spray/CYL-9ML-SPRAY-TUR-sprayer.png",
        });
        expect(canonicalLayerFromSourcePath("lotion-pumps/CYL-9ML-LPM-GL-pump.png")).toMatchObject({
            slot: "pump",
            variantKey: "GL",
            relativePath: "lotion/CYL-9ML-LOTION-GL-pump.png",
        });
    });

    it("produces an exact RGBA canvas with transparent side padding", async () => {
        const root = await mkdtemp(join(tmpdir(), "cyl-recanvas-test-"));
        const source = join(root, "source.png");
        const output = join(root, "output.png");
        const center = await sharp({
            create: {
                width: 400,
                height: 900,
                channels: 4,
                background: { r: 180, g: 100, b: 40, alpha: 1 },
            },
        }).png().toBuffer();
        await sharp({
            create: {
                width: 1000,
                height: 1300,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 },
            },
        }).composite([{ input: center, left: 300, top: 200 }]).png().toFile(source);

        const audit = await recanvasLayer(source, output);
        const metadata = await sharp(output).metadata();
        const leftAlpha = await sharp(output)
            .extract({ left: 0, top: 0, width: 160, height: 2288 })
            .ensureAlpha()
            .raw()
            .toBuffer();

        expect(metadata).toMatchObject({ width: 2080, height: 2288, channels: 4, hasAlpha: true });
        expect(audit).toMatchObject({ width: 2080, height: 2288, transparentEdges: true });
        expect([...leftAlpha].filter((_, index) => index % 4 === 3).every((alpha) => alpha === 0)).toBe(true);
        expect((await stat(output)).size).toBeGreaterThan(0);
    });

    it("builds a non-live manifest for all 26 canonical Cylinder layers", async () => {
        const entries = [
            ...["AMB", "BLU", "CLR", "FRS", "SWL"].map((key) => ({
                slot: "body",
                variantKey: key,
                sourceFilename: `CYL-${key}-9ML-body.png`,
                relativePath: `bodies/CYL-${key}-9ML-body.png`,
            })),
            ...["BLK-DOT", "MATT-CU", "MATT-GL", "MATT-SL", "PNK-DOT", "SHN-BLK", "SHN-GL", "SHN-SL", "SL-DOT", "WHT"].map((key) => ({
                slot: "cap",
                variantKey: key,
                sourceFilename: `CYL-9ML-${key}-cap.png`,
                relativePath: `caps/CYL-9ML-${key}-cap.png`,
            })),
            ...["MTL-ROLL", "PLS-ROLL"].map((key) => ({
                slot: "roller",
                variantKey: key,
                sourceFilename: `CYL-9ML-${key}-roller.png`,
                relativePath: `fitments/CYL-9ML-${key}-roller.png`,
            })),
            ...["BLK", "GL", "MATT-SL", "RD", "SHN-SL", "TUR"].map((key) => ({
                slot: "sprayer",
                variantKey: key,
                sourceFilename: `CYL-9ML-SPRAY-${key}-sprayer.png`,
                relativePath: `spray/CYL-9ML-SPRAY-${key}-sprayer.png`,
            })),
            ...["BLK", "GL", "MATT-SL"].map((key) => ({
                slot: "pump",
                variantKey: key,
                sourceFilename: `CYL-9ML-LOTION-${key}-pump.png`,
                relativePath: `lotion/CYL-9ML-LOTION-${key}-pump.png`,
            })),
        ];

        const manifest = buildCylinder9mlManifest(entries, "cyl-9ml-test-r1");

        expect(manifest).toMatchObject({
            familyKey: "CYL-9ML",
            canvasPreset: "pdp-2080x2288",
            canvas: { width: 2080, height: 2288 },
            pipelineVersion: "recanvas-v1",
            assetRevision: "cyl-9ml-test-r1",
            storefrontReady: false,
        });
        expect(manifest.layers).toHaveLength(26);
        expect(manifest.layers.every((layer: { url: unknown; sanityAssetId: unknown }) => (
            layer.url === null && layer.sanityAssetId === null
        ))).toBe(true);

        // Keep the import exercised as a real ESM module, not a type-only fixture.
        expect(JSON.parse(JSON.stringify(manifest))).toEqual(manifest);
        expect(await readFile(new URL("../scripts/paper-doll/recanvas-cylinder-9ml.mjs", import.meta.url), "utf8"))
            .toContain("recanvas-v1");
    });
});
