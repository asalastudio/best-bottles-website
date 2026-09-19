import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { attachBuilderKits, slimBuilderBodies } from "@/lib/bottle-builder/payload";
import { chooserPreloadUrls } from "@/lib/bottle-builder/mobile-request";
import { bareGlassPreview, clearBodyPreview, previewParts, type BuilderBody, type BuilderConfiguration, type BuilderKit } from "@/lib/bottle-builder/model";

const kit = (sku: string, extra: Partial<BuilderKit> = {}): BuilderKit => ({
    sku, websiteSku: sku, graceSku: null, familyId: "cylinder-9ml-clear-17-415", completeness: "full", conflicts: [],
    canvas: { width: 1000, height: 1100 },
    anchors: { axisX: 500, neckAxisX: 500, seatY: 300, baselineY: 1000, pxPerMm: null },
    plateSha256: "plate", three: { bodyId: "cylinder-9ml", glass: "clear", finish: "17-415", closureAssemblyKind: null, capMaterialId: null, trimMaterialId: null, rollerVariant: "metal" },
    parts: [{
        slot: "body", variantKey: "body", zOrder: 0, explodeIndex: 0, assembled: { x: 0, y: 0 },
        bounds: { left: 400, top: 300, right: 600, bottom: 1000 },
        image: { url: `https://example.com/${sku}-body.webp`, key: "body", sha256: "body", bytes: 8000, width: 1000, height: 1100 },
        image2x: { url: `https://example.com/${sku}-body@2x.webp`, key: "body2x", sha256: "body2x", bytes: 20000, width: 2000, height: 2200 },
        mask: { url: `https://example.com/${sku}-mask.webp`, key: "mask", sha256: "mask", bytes: 4000, width: 1000, height: 1100 },
        derivation: "psd-layer", exploded: { dx: 0, dy: 0 },
    }],
    ...extra,
});

const config = (id: string, overrides: Partial<BuilderConfiguration> = {}): BuilderConfiguration => ({
    id, bodyId: "cylinder-9ml|17-415|Glass Bottle", family: "Cylinder", capacityMl: 9, neck: "17-415",
    color: "Clear", fitment: "Metal Roller", closure: "Black", kit: kit(id),
    photoUrl: "https://example.com/plate.webp",
    bodyImage: { url: `https://example.com/${id}-chooser.webp`, width: 400, height: 520 },
    finishComponent: { websiteSku: "CPRoll17415Black", imageUrl: null, name: "Black" },
    profileLabel: "Cylinder", caseQuantity: 24,
    product: { graceSku: `GB-${id}`, websiteSku: id, itemName: id, shopifyVariantId: "1", shopifySellable: true, checkoutEligible: true, quantity: 1, unitPrice: 1, webPrice1pc: 1 },
    ...overrides,
} as BuilderConfiguration);

const body = (configurations: BuilderConfiguration[]): BuilderBody => ({
    id: configurations[0]!.bodyId, profileLabel: "Cylinder", family: "Cylinder", capacityMl: 9, neck: "17-415", configurations,
});

describe("builder first-paint payload", () => {
    it("keeps chooser identities and drops kit layers so the first HTML is not a kit catalog", () => {
        const preview = kit("Cylinder9MetalGold");
        const full = [body([
            config("Cylinder9MetalBlack"),
            config("Cylinder9MetalGold", { closure: "Gold", previewKit: preview, kit: kit("Cylinder9MetalGold", { completeness: "capSplit" }) }),
        ])];
        const slim = slimBuilderBodies(full);
        expect(JSON.stringify(slim)).not.toMatch(/example.com\/Cylinder9MetalBlack-body/);
        expect(JSON.stringify(slim)).not.toContain("image2x");
        expect(JSON.stringify(slim)).not.toContain("plateSha256");
        expect(slim[0]!.configurations.every(item => item.kit === null && item.previewKit === undefined)).toBe(true);
        expect(slim[0]!.configurations.map(item => [item.id, item.color, item.fitment, item.closure, item.product.webPrice1pc, item.bodyImage?.url]))
            .toEqual(full[0]!.configurations.map(item => [item.id, item.color, item.fitment, item.closure, item.product.webPrice1pc, item.bodyImage?.url]));
        expect(slim[0]!.configurations[1]!.previewKitSku).toBe("Cylinder9MetalGold");
        expect(chooserPreloadUrls(slim)).toEqual(["https://example.com/Cylinder9MetalBlack-chooser.webp"]);
    });

    it("keeps one bare-glass layer per colour when a family has no reviewed body image", () => {
        // Cylinder ships no reviewed 50 ml body webp, so before this the chooser
        // tile had a null kit and a null bodyImage and drew "Image unavailable".
        const clear = config("Cylinder50SprayBlack", { bodyImage: null });
        const slim = slimBuilderBodies([body([
            clear,
            config("Cylinder50SprayGold", { closure: "Gold", bodyImage: null }),
            config("Cylinder50SprayFrost", { color: "Frosted", bodyImage: null }),
        ])]);
        const [first, second, frosted] = slim[0]!.configurations;
        expect(first!.kit).toBeNull();
        expect(first!.chooserKit?.parts.map(part => part.slot)).toEqual(["body"]);
        expect(first!.chooserKit?.parts[0]!.image.url).toBe("https://example.com/Cylinder50SprayBlack-body.webp");
        // Only the first configuration of each colour is ever drawn by the chooser.
        expect(second!.chooserKit).toBeUndefined();
        expect(frosted!.chooserKit?.parts.map(part => part.slot)).toEqual(["body"]);
        // Still not a kit catalog: no sibling layers, no 2x, no mask.
        expect(JSON.stringify(slim)).not.toContain("-body@2x.webp");
        expect(JSON.stringify(slim)).not.toContain("-mask.webp");
        expect(previewParts(clearBodyPreview(slim[0]!), "body").map(part => part.slot)).toEqual(["body"]);
        expect(chooserPreloadUrls(slim)).toEqual(["https://example.com/Cylinder50SprayBlack-body.webp"]);
    });

    it("prefers the reviewed body image and never layers a borrowed kit over it", () => {
        const slim = slimBuilderBodies([body([config("Cylinder9MetalBlack")])]);
        expect(slim[0]!.configurations[0]!.chooserKit).toBeUndefined();
        const tile = clearBodyPreview(slim[0]!);
        expect(tile.bodyImage?.url).toBe("https://example.com/Cylinder9MetalBlack-chooser.webp");
        expect(previewParts(tile, "body")).toEqual([]);
    });

    it("draws a clear tile from the reviewed clear image, not a coloured body layer", () => {
        const amber = config("Cylinder9Amber", { color: "Amber", bodyImage: null });
        const slim = slimBuilderBodies([body([amber])]);
        expect(slim[0]!.configurations[0]!.chooserKit).toBeDefined();
        // clearBodyPreview finds no reviewed Clear image for this fixture body and
        // keeps the amber configuration, borrowed layer and all.
        expect(clearBodyPreview(slim[0]!).color).toBe("Amber");
        // A configuration carrying a reviewed image drops the borrowed layer.
        expect(bareGlassPreview({ ...slim[0]!.configurations[0]!, bodyImage: { url: "https://example.com/reviewed.webp", width: 400, height: 520 } }).chooserKit).toBeUndefined();
    });

    it("restores only the selected bottle's kits without changing compatible choices", () => {
        const preview = kit("Cylinder9MetalGold");
        const slim = slimBuilderBodies([body([
            config("Cylinder9MetalBlack"),
            config("Cylinder9MetalGold", { closure: "Gold", previewKit: preview }),
        ])]);
        const restored = attachBuilderKits(slim, { Cylinder9MetalGold: preview });
        expect(restored[0]!.configurations[0]!.kit).toBeNull();
        expect(restored[0]!.configurations[1]!.kit).toEqual(preview);
        expect(restored[0]!.configurations[1]!.previewKit).toEqual(preview);
        expect(restored[0]!.configurations.map(item => item.fitment)).toEqual(["Metal Roller", "Metal Roller"]);
    });
});

describe("Build Your Bottle first-paint contract", () => {
    it("caches the opened family and sends the slim workspace, then loads kits for the selected bottle", () => {
        const page = readFileSync("src/app/matrix/page.tsx", "utf8");
        const server = readFileSync("src/lib/bottle-builder/server.ts", "utf8");
        const client = readFileSync("src/components/matrix/MatrixClient.tsx", "utf8");
        expect(server).toMatch(/loadBuilderFamily\s*=\s*unstable_cache/);
        expect(server).toContain("slimBuilderBodies");
        expect(page).toContain("slimBuilderBodies");
        expect(client).toContain("useBuilderKits");
    });
});
