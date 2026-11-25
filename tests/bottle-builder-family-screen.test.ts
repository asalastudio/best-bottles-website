import { describe, expect, it } from "vitest";
import { familyOptionCount, familyPreviewScale, familyScreenOrder, familySizeRange, familySizes, pickFamilyTileSizes } from "@/lib/bottle-builder/family-previews";
import { familyTileOutline, placeFamilyShapes } from "@/components/icons/FamilyShapeGroup";
import { familyShapeOutline } from "@/components/icons/FamilyShapeIcon";
import type { BuilderBody, BuilderConfiguration } from "@/lib/bottle-builder/model";

const config = (id: string, color: string, extra: Partial<BuilderConfiguration> = {}) =>
    ({ id, color, fitment: "Screw Cap", bodyImage: { url: `/b/${id}.png`, width: 10, height: 20 }, ...extra }) as unknown as BuilderConfiguration;
const body = (family: string, capacityMl: number, neck = "18-415", configurations = [config(`${family}-${capacityMl}`, "Clear")]) =>
    ({ id: `${family.toLowerCase()}-${capacityMl}ml|${neck}|Glass Bottle`, family, capacityMl, neck, profileLabel: family, configurations }) as unknown as BuilderBody;

describe("Build Your Bottle family screen", () => {
    it("orders families the way the menus do, then the rest by name", () => {
        const order = familyScreenOrder([{ family: "Vial" }, { family: "Bell" }, { family: "Diva" }, { family: "Cylinder" }, { family: "Slim" }]).map(f => f.family);
        expect(order).toEqual(["Cylinder", "Diva", "Slim", "Bell", "Vial"]);
    });

    it("draws the family's range: smallest, middle and largest size, one per capacity", () => {
        const bodies = [5, 9, 9, 25, 28, 50, 100].map((ml, i) => body("Cylinder", ml, i === 2 ? "13-415" : "17-415"));
        expect(familySizes(bodies)).toEqual([5, 9, 25, 28, 50, 100]);
        expect(pickFamilyTileSizes(familySizes(bodies))).toEqual([5, 28, 100]);
        expect(pickFamilyTileSizes([5, 9])).toEqual([5, 9]);
        expect(pickFamilyTileSizes([30])).toEqual([30]);
    });

    it("writes the size range the way the mock-up does", () => {
        expect(familySizeRange([15, 30, 60])).toBe("15 to 60 ml");
        expect(familySizeRange([78, 128])).toBe("78 and 128 ml");
        expect(familySizeRange([55])).toBe("55 ml");
        expect(familySizeRange([3.3, 100])).toBe("3.3 and 100 ml");
        expect(familySizeRange([])).toBe("");
    });

    it("stands each size on one shelf, the tallest at full height, left to right inside the frame", () => {
        const outline = familyShapeOutline("Boston Round");
        const placed = placeFamilyShapes(outline, [.72, .83, 1]);
        expect(placed).toHaveLength(3);
        // Every outline's baseline (y = 22) lands on the shelf, y = 78.
        for (const p of placed) expect(p.y + 22 * p.scale).toBeCloseTo(78, 5);
        expect(placed[2].scale / placed[0].scale).toBeCloseTo(1 / .72, 5);
        const right = placed[2].x + outline.x1 * placed[2].scale;
        expect(placed[0].x + outline.x0 * placed[0].scale).toBeGreaterThanOrEqual(6.9);
        expect(right).toBeLessThanOrEqual(93.1);
    });

    it("draws Diva and Diamond with their tile detail, and keeps the plain outline for the menus", () => {
        expect(familyTileOutline("Diva").paths.length).toBeGreaterThan(1);
        expect(familyTileOutline("Diamond").paths.length).toBeGreaterThan(1);
        expect(familyShapeOutline("Diva").paths).toHaveLength(1);
        expect(familyShapeOutline("Diamond").paths).toHaveLength(1);
        expect(familyTileOutline("Boston Round")).toEqual(familyShapeOutline("Boston Round"));
        // Drawn outlines (relative commands) and unknown families still get an extent to lay out with.
        for (const family of ["Vial", "Apothecary", "Nope"]) expect(familyShapeOutline(family).x1).toBeGreaterThan(familyShapeOutline(family).x0);
    });

    it("counts options as every size in every glass it comes in", () => {
        const glasses = (id: string, colors: string[]) => colors.map(c => config(`${id}-${c}`, c));
        const family = [
            body("Boston Round", 15, "18-400", glasses("15", ["Clear", "Amber", "Cobalt Blue"])),
            body("Boston Round", 30, "20-400", glasses("30", ["Clear", "Amber", "Cobalt Blue"])),
            body("Boston Round", 60, "20-400", [...glasses("60", ["Clear", "Amber", "Cobalt Blue"]), config("60-clear-pump", "Clear")]),
        ];
        expect(familyOptionCount(family)).toBe(9);
    });

    it("draws each bottle at its height relative to the tallest in its group, never below half", () => {
        const group = [{ family: "Nope", capacityMl: 10 }, { family: "Nope", capacityMl: 100 }];
        expect(familyPreviewScale(group[1], group)).toBe(1);
        expect(familyPreviewScale(group[0], group)).toBeGreaterThanOrEqual(.5);
        expect(familyPreviewScale(group[0], group)).toBeLessThan(1);
    });

    it("reads a rounded capacity from the audit's nearest row, and never mixes measured and estimated heights", () => {
        // 3.3 ml is the audit's 3 ml Cylinder (37 mm of 154 mm), so it stands below the 28 ml (81 mm).
        const cylinder = [3.3, 28, 100].map(capacityMl => ({ family: "Cylinder", capacityMl }));
        const [small, middle, tall] = cylinder.map(size => familyPreviewScale(size, cylinder));
        expect(tall).toBe(1);
        expect(small).toBeLessThanOrEqual(middle);
        // Vial 9 ml has no row: the whole group steps up by capacity instead.
        const vial = [2, 4, 9].map(capacityMl => ({ family: "Vial", capacityMl }));
        const scales = vial.map(size => familyPreviewScale(size, vial));
        expect(scales[0]).toBeLessThan(scales[1]);
        expect(scales[1]).toBeLessThan(scales[2]);
    });
});

describe("Build Your Bottle finished views", () => {
    it("offers the product page's views only for a layered kit, cap on first, with CAP OFF for the cap beside the glass", async () => {
        const { builderViews, builderViewLabel } = await import("@/components/bottle-builder/BuilderViewStage");
        const bare = { id: "x", family: "Cylinder", capacityMl: 9, color: "Clear", fitment: "Metal Roller", kit: null, product: { websiteSku: "x" } } as unknown as BuilderConfiguration;
        expect(builderViews(bare)).toEqual([]);
        expect(builderViews(null)).toEqual([]);
        expect(builderViewLabel("capon")).toBe("CAP ON");
        expect(builderViewLabel("sidecar")).toBe("CAP OFF");
        expect(builderViewLabel("exploded")).toBe("EXPLODED");
    });

    it("Start over returns to the family screen", async () => {
        const { readFileSync } = await import("node:fs");
        const client = readFileSync("src/components/matrix/MatrixClient.tsx", "utf8");
        expect(client).toMatch(/function startOver\(\) \{[\s\S]*?reset\(\);[\s\S]*?openFamilyScreen\(\);/);
        expect(client).toContain("onClick={startOver}");
    });
});

describe("which /matrix links open on the family screen", () => {
    it("only a bare /matrix: a family, product or collection link goes straight to its bottles", async () => {
        const { readFileSync } = await import("node:fs");
        const page = readFileSync("src/app/matrix/page.tsx", "utf8");
        expect(page).toContain("const chooseFamilyFirst = !familyParam && !sku && !collection;");
    });
});
