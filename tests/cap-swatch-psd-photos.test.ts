import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import photos from "@/lib/products/cap-swatch-photos.generated.json";
import options from "@/lib/products/cap-swatch-photo-options.generated.json";
import { catalogCapComponentPhoto, catalogCapHeadPhoto, catalogCapPhoto, catalogCapPhotoBounds, catalogCapPhotoWithoutKind } from "@/lib/products/catalog-cap-photos";
import reviewed from "@/lib/products/cylinder-cap-thumbnails.generated.json";
import sharedReviewed from "@/lib/products/cap-swatch-shared-reviewed.json";
import { capSwatchFrame, CAP_SWATCH_HEIGHT, CAP_SWATCH_WIDTH } from "@/components/catalog/CatalogCapDots";
import { closurePartFrame } from "@/components/bottle-builder/BuilderFinishImage";
import { componentForOption } from "../scripts/catalog/cap-swatch-components";

const photoMap = photos as Record<string, { url: string; width: number; height: number; source: string }>;
const optionMap = options as Record<string, string>;
const file = (url: string) => path.join(process.cwd(), "public", url);

describe("PSD cap photos", () => {
    it("are lossless WebP files named by component SKU and content hash, at their recorded size", async () => {
        expect(Object.keys(photoMap).length).toBeGreaterThan(80);
        for (const [key, photo] of Object.entries(photoMap)) {
            const bytes = readFileSync(file(photo.url));
            const name = path.basename(photo.url);
            expect(name.startsWith(`${key}.`), name).toBe(true);
            expect(name).toBe(`${key}.${createHash("sha256").update(bytes).digest("hex").slice(0, 12)}.webp`);
            // RIFF....WEBPVP8L: the lossless bitstream
            expect(bytes.subarray(12, 16).toString("ascii"), name).toBe("VP8L");
            const meta = await sharp(bytes).metadata();
            expect([meta.width, meta.height], name).toEqual([photo.width, photo.height]);
            expect(meta.hasAlpha, name).toBe(true);
            expect(Math.max(photo.width, photo.height)).toBeLessThanOrEqual(240);
        }
    });

    it("are trimmed to the part: some opaque pixel touches every edge", async () => {
        for (const photo of Object.values(photoMap)) {
            const { data, info } = await sharp(file(photo.url)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
            const alpha = (x: number, y: number) => data[(y * info.width + x) * 4 + 3];
            const row = (y: number) => Array.from({ length: info.width }, (_, x) => alpha(x, y));
            const col = (x: number) => Array.from({ length: info.height }, (_, y) => alpha(x, y));
            for (const edge of [row(0), row(info.height - 1), col(0), col(info.width - 1)]) expect(Math.max(...edge), photo.url).toBeGreaterThan(0);
        }
    });
});

describe("mapping catalog options to PSD component photos", () => {
    it("reads the closure component from the option's SKU", () => {
        expect(componentForOption("GBCrcl50RdcrBlkLthr", "18-415")).toBe("CP18-415BlkLthr");
        expect(componentForOption("GBSlk30RdcrIvyLthr", "18-415")).toBe("CP18-415LIvyLthr");
        expect(componentForOption("GBElg60RdcrWht", "18-415")).toBe("CP18-415Wh");
        expect(componentForOption("GBDivaFrst46RdcrShnBlkTall", "18-415")).toBe("CP18-415ShnBlkTall");
        expect(componentForOption("GBBstnBlu15WhtDrprGlTrim", "18-400")).toBe("Drp18-40015mlShnGlTrimWhiteBulb");
        expect(componentForOption("GBBstnAmb15mlBlkDropper", "18-400")).toBe("Drp18-40015mlBlckBulb");
        expect(componentForOption("GBBstn1ozWhtDrpShnSlTrim", "20-400")).toBe("Drp20-4001ozlShnSlTrimWhiteBulb");
        expect(componentForOption("GBBstnAmb1ozBlkDrpShnGl", "20-400")).toBe("Drp20-4001ozShnGlTrimBlkBulb");
        expect(componentForOption("GBBstn2ozBlkCapSht", "20-400")).toBe("20-400Cp2ozShortBlk");
        expect(componentForOption("GBBstn2ozMtlRollBlk", "20-400")).toBe("CPRoll20-400TallShnBlk");
        expect(componentForOption("GBV1DrmBlackCapSht", "13-425")).toBe("CP13-425Blk");
        expect(componentForOption("GBVAmb1DrmBlkDrpr", "13-425")).toBe("Drp13-425Blk");
        expect(componentForOption("LBElg100LtnClOvrCap", "18-415")).toBe("Ltn18-415MtSlCl");
        expect(componentForOption("LBSlk100WhtRectClOverCap", "18-415")).toBe("Ltn18-415SqClr");
        expect(componentForOption("GBCyl5SprySlMatt", "13-415")).toBe("CP13-415SprySlMt");
        expect(componentForOption("GBTallRect10MtlRollPinkDo", "13-415")).toBe("CPRoll13-415PinkDot");
        expect(componentForOption("GBCyl9SpryRd", "17-415")).toBe("Spry17-415Red");
        expect(componentForOption("GB1mlAmbVBlk", "Plug")).toBe("ROD1mlBlk");
    });

    it("files the short metallic 13-415 caps, which have no PSD, under the reviewed photo of the same cap", () => {
        expect(componentForOption("GBElg15CuSht", "13-415")).toBe("CP13-415CuSht");
        expect(componentForOption("GBCrcl15GlMattSht", "13-415")).toBe("CP13-415GlMattSht");
        expect(componentForOption("GBSleek5BlkShSht", "13-415")).toBe("CP13-415BlkShSht");
        expect(componentForOption("GBTulip6BlkSht", "13-415")).toBe("CP13-415BlkSht");
        for (const [component, sameCap] of Object.entries(sharedReviewed)) {
            expect(component in photoMap, component).toBe(false);
            expect((reviewed as Record<string, string>)[sameCap], sameCap).toMatch(/reviewed-cap-thumbs/);
        }
        const copper = catalogCapComponentPhoto("GBCrcl15CuSht")!;
        expect(copper).toEqual({ component: "CP13-415CuSht", url: (reviewed as Record<string, string>).GBCyl5CuSht, cutOut: false });
        // already measured with the other reviewed thumbnails, so it draws cropped to the cap
        expect(capSwatchFrame(copper.url).kind).toBe("crop");
    });

    it("gives no photo rather than a guess", () => {
        // a SKU read on the wrong neck
        expect(componentForOption("GBCrcl50RdcrBlkLthr", "13-415")).toBeUndefined();
        // an atomizer whose SKU ends like a tall gold cap is not a bottle with a cap
        expect(componentForOption("GBAtom5Gl", "13-415", "Atomizer")).toBeUndefined();
        expect(componentForOption("GBCrcl15Gl", "13-415", null)).toBe("CP13-415Gl");
        // glass stoppers: nothing in the library
        expect(componentForOption("GBSQSTBlue", "Ground")).toBeUndefined();
        expect(optionMap.GBAtom5Gl).toBeUndefined();
    });

    it("maps only onto photos that exist, and fills the options the 20 Nov audit found bare", () => {
        for (const [sku, component] of Object.entries(optionMap)) expect(catalogCapComponentPhoto(sku)?.component, `${sku} -> ${component}`).toBe(component);
        const audit = readFileSync("docs/CAP_SWATCH_COVERAGE_2026-11-20.md", "utf8").split("## Options with no swatch photo")[1];
        const gapSkus = [...audit.matchAll(/SKUs: (.+)$/gm)].flatMap((m) => m[1].split(",").map((s) => s.trim()));
        expect(gapSkus).toHaveLength(519);
        const bare = gapSkus.filter((sku) => !optionMap[sku]);
        // what is left: glass stoppers and crystal caps
        expect(bare).toHaveLength(12);
        for (const sku of ["GBCrcl100RdcrShnGl", "GBDivaFrst46RdcrPnkLthr", "GBBstn2ozWhtDrprShnGlTrim", "GBBstnBlu15BlkDrpr", "GBVGr1DrmWhtCapSht", "GBVBlu1DrmBlkDropper", "GBRoyal13GlSht"]) {
            expect(optionMap[sku], sku).toBeDefined();
        }
    });
});

describe("choosing a cap photo", () => {
    const reducer = { id: "r", label: "Black Leather", websiteSku: "GBCrcl50RdcrBlkLthr" };
    const shortCopper = { id: "c", label: "Short Matte Copper", websiteSku: "GBCrcl15CuSht" };
    const mattGoldSpray = { id: "s", label: "Screw Cap Matte Gold", websiteSku: "GBCrcl15SpryGlMatt" };
    const pump = { id: "p", label: "Pump Clear Overcap", websiteSku: "LBElg100LtnClOvrCap" };

    it("shows a sprayer's or pump's exposed head, never the index's photo (which can be the overcap)", () => {
        // the three 13-415 sprayer plates that are overcaps, and every other 13-415 finish
        for (const [sku, component] of [["GBCrcl15SpryGlMatt", "CP13-415SpryGlMt"], ["GBCrcl15SpryBluMatt", "CP13-415SpryBluMt"], ["GBCrcl15SpryBlkSh", "CP13-415SpryBlkSh"],
            ["GBElg15SpryBlkMatt", "CP13-415SpryBlkMt"], ["GBElg15SpryCuMatt", "CP13-415SpryCuMt"], ["GBCyl5SprySlMatt", "CP13-415SprySlMt"], ["GBCyl5SpryGlSh", "CP13-415SpryGlSh"], ["GBCyl5SprySlSh", "CP13-415SprySlSh"]]) {
            const overcapPlate = { websiteSku: component, thumb: `https://blob.example/${component}.webp` };
            const url = catalogCapPhoto({ id: sku, label: "", websiteSku: sku }, [overcapPlate], "sprayer");
            expect(url, sku).toMatch(new RegExp(`^/images/cap-swatches/${component}\\.[0-9a-f]{12}\\.webp$`));
        }
        // shown at once: it does not wait for the plate index
        expect(catalogCapPhoto(mattGoldSpray, [], "sprayer", undefined, { platesLoaded: false })).toBe(catalogCapHeadPhoto(mattGoldSpray, "sprayer"));
        expect(catalogCapPhoto(pump, [], "pump", undefined, { platesLoaded: false })).toMatch(/Ltn18-415MtSlCl\.[0-9a-f]{12}\.webp$/);
        // a cap is not a mechanism: no head photo
        expect(catalogCapHeadPhoto(shortCopper, "plain")).toBeUndefined();
    });

    it("fills other closures only where the plate index has no photo, and only once the plates have answered", () => {
        const fill = catalogCapComponentPhoto(shortCopper.websiteSku)!.url;
        expect(catalogCapPhoto(shortCopper, [], "plain", undefined, { platesLoaded: false })).toBeUndefined();
        expect(catalogCapPhoto(shortCopper, [], "plain")).toBe(fill);
        const plate = { websiteSku: "CP13-415CuSht", thumb: "https://blob.example/plate.webp" };
        expect(catalogCapPhoto(shortCopper, [plate], "plain")).toBe(plate.thumb);
        expect(catalogCapPhoto(shortCopper, [], "plain", new Set([fill]))).toBeUndefined();
    });

    it("shows a reviewed or component photo on a card whose closure has no kind (reducers, Pillar caps)", () => {
        // the Cylinder reducers have reviewed photos of their own, which a kind-less card used to skip
        const cylinderReducer = { id: "x", label: "Black Leather", websiteSku: "GBCyl100RdcrBlkLthr" };
        expect(catalogCapPhotoWithoutKind(cylinderReducer)).toBe((reviewed as Record<string, string>).GBCyl100RdcrBlkLthr);
        expect(catalogCapPhotoWithoutKind(reducer)).toMatch(/^\/images\/cap-swatches\/CP18-415BlkLthr\./);
        expect(catalogCapPhotoWithoutKind({ id: "p", label: "Short Matte Copper", websiteSku: "GBPillar9CuSht" })).toBe((reviewed as Record<string, string>).GBCyl5CuSht);
        expect(catalogCapPhotoWithoutKind({ id: "s", label: "Stopper", websiteSku: "GBSQSTBlue" })).toBeUndefined();
        expect(catalogCapPhotoWithoutKind(cylinderReducer, new Set([(reviewed as Record<string, string>).GBCyl100RdcrBlkLthr]))).toBeUndefined();
    });

    it("draws a PSD part at full swatch size, already cropped, in the catalog and in the builder", () => {
        const url = catalogCapComponentPhoto(reducer.websiteSku)!.url;
        const bounds = catalogCapPhotoBounds(url)!;
        expect([bounds.left, bounds.top, bounds.right, bounds.bottom]).toEqual([0, 0, bounds.width, bounds.height]);
        const frame = capSwatchFrame(url);
        expect(frame.kind).toBe("crop");
        expect(Math.max(frame.width / CAP_SWATCH_WIDTH, frame.height / CAP_SWATCH_HEIGHT)).toBeGreaterThan(0.95);
        expect(closurePartFrame(url)?.image).toEqual({ width: "100%", height: "100%", left: "0%", top: "0%" });
    });
});

describe("Build Your Bottle closure grid", () => {
    it("draws every roll-on cap of one moulding at one height on one baseline, whatever the plate's margin", async () => {
        const { CLOSURE_HEIGHT } = await import("@/components/bottle-builder/BuilderFinishImage");
        const plates = ["d717752ddc78c25762c9134e716c8eafd459fd11a0c4f499122ffa5c0907510f", "76c60985446372d07e0635c0d9135d9cc32cb7c5782fa36e26ab662f77dc08e2",
            "a30d76a6b69a0bff24efbb327090f01323d7d5dcdcb11b72d84b5abba7aa50c6"].map((hash) => `https://blob.example/plates/roll-on-cap-13-415/x/${hash}.front-on-240x240.webp`);
        // the desktop tile's inner box (Builder.module.css .closureThumb, less the 6 px inset)
        const [tileWidth, tileHeight] = [97 - 12, 106 - 12];
        const heights = plates.map((url) => {
            const frame = closurePartFrame(url)!;
            const width = Math.min(tileWidth, CLOSURE_HEIGHT * tileHeight * frame.ratio);
            return Math.round(width / frame.ratio);
        });
        expect(new Set(heights).size).toBe(1);
        expect(heights[0]).toBe(Math.round(CLOSURE_HEIGHT * tileHeight));
        expect(closurePartFrame("https://blob.example/never-measured.webp")).toBeUndefined();
    });
});

describe("Build Your Bottle kit-layer finish grid", () => {
    const kitConfig = (id: string, top: number, bottom = 300) => ({
        id, family: "Test", capacityMl: 15, color: "Clear", neck: "18-415", fitment: "Reducer", closure: id,
        kit: { canvas: { width: 1000, height: 1100 }, anchors: { axisX: 500, seatY: 300, baselineY: 1000 },
            parts: [{ slot: "cap", image: { url: `/${id}.webp`, width: 1000, height: 1100 }, bounds: { left: 420, right: 580, top, bottom } }] },
    }) as unknown as import("@/lib/bottle-builder/model").BuilderConfiguration;

    it("frames short and tall caps on one shared scale and baseline", async () => {
        const { finishGridBounds } = await import("@/components/bottle-builder/BuilderFinishImage");
        const grid = [kitConfig("short", 220), kitConfig("tall", 150), kitConfig("leather", 140)];
        const bounds = finishGridBounds(grid[0], grid)!;
        expect(bounds).toHaveLength(3);
        expect(Math.min(...bounds.map((b) => b.top))).toBe(140);
        expect(new Set(bounds.map((b) => b.bottom))).toEqual(new Set([300]));
    });

    it("lets one moulding in several finishes fill each tile alike", async () => {
        const { finishGridBounds } = await import("@/components/bottle-builder/BuilderFinishImage");
        const grid = [kitConfig("gold", 150), kitConfig("black", 156), kitConfig("silver", 152)];
        expect(finishGridBounds(grid[0], grid)).toBeUndefined();
        expect(finishGridBounds(kitConfig("alone", 150), [kitConfig("alone", 150)])).toBeUndefined();
    });
});
