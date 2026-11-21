import { describe, expect, it } from "vitest";
import { familyOptionCount, familyPreviewScale, familyScreenOrder, pickFamilyPreviewBodies } from "@/lib/bottle-builder/family-previews";
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

    it("shows the family's range: smallest, middle and largest, one per capacity", () => {
        const bodies = [5, 9, 9, 25, 28, 50, 100].map((ml, i) => body("Cylinder", ml, i === 2 ? "13-415" : "17-415"));
        expect(pickFamilyPreviewBodies(bodies).map(b => b.capacityMl)).toEqual([5, 28, 100]);
        expect(pickFamilyPreviewBodies(bodies.slice(0, 2)).map(b => b.capacityMl)).toEqual([5, 9]);
        expect(pickFamilyPreviewBodies([body("Grace", 30)]).map(b => b.capacityMl)).toEqual([30]);
    });

    it("keeps only the bare clear glass each bottle is drawn with, and skips bottles with nothing to draw", () => {
        const amberFirst = body("Boston Round", 15, "18-400", [config("br-15-amber", "Amber"), config("br-15-clear", "Clear"), config("br-15-cobalt", "Cobalt Blue")]);
        const blank = body("Boston Round", 60, "20-400", [config("br-60", "Clear", { bodyImage: undefined })]);
        const [picked, ...rest] = pickFamilyPreviewBodies([amberFirst, blank]);
        expect(rest).toHaveLength(0);
        expect(picked.configurations.map(c => c.id)).toEqual(["br-15-clear"]);
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
