import { describe, expect, it } from "vitest";
import { approvedComponentKit, approvedComponentKits, isBostonRollOnSku } from "@/lib/paper-doll/approved-component-kits";
import { approvedMasterSku } from "@/lib/paper-doll/approved-kit-index";
import { availableViews, stageLayout } from "@/lib/products/pdp-redesign/stage";
import display from "@/lib/products/display-images.generated.json";

const bostonRollOns = () => Object.keys(approvedComponentKits()).filter(isBostonRollOnSku);

describe("Boston Round 20-400 roll-ons use the complete roller inserts (2026-11-20)", () => {
    it("serves all 70 Boston 30 and 60 ml roll-on recipes", () => {
        expect(bostonRollOns()).toHaveLength(70);
        expect(isBostonRollOnSku("GBBstnAmb1ozRollonGl")).toBe(true);
        expect(isBostonRollOnSku("GBBstn2ozMtlRollShnSl")).toBe(true);
        expect(isBostonRollOnSku("GBBstn15BlkDrp")).toBe(false);
    });

    it("draws the seated register roller in CAP ON and CAP OFF and the complete insert only in EXPLODED", () => {
        for (const sku of bostonRollOns()) {
            const kit = approvedComponentKit(sku)!;
            const rollers = kit.parts.filter(part => part.slot === "roller");
            expect(rollers.map(part => part.views)).toEqual([["sidecar", "capon"], ["exploded"]]);
            const insert = rollers[1].image.url;
            expect(insert).toMatch(/^\/images\/approved-masters\/boston-roller-(metal|plastic)-20-400\.[a-f0-9]{12}\.png$/);
            expect(insert.includes("metal")).toBe(/Mtl/.test(sku));
            // Nothing is served from the local review folder on a hosted storefront.
            for (const part of kit.parts) expect(part.image.url.startsWith("/local-kits/")).toBe(false);
            expect((display.sources as Record<string, Record<string, string>>)[insert]?.["640"]).toMatch(/^\/images\/approved-masters\/boston-roller-(metal|plastic)-20-400-640\.[a-f0-9]{12}\.webp$/);
        }
    });

    it("offers EXPLODED on the product page with the insert lifted off the glass", () => {
        const kit = approvedComponentKit("GBBstnAmb1ozRollonMattGl")!;
        const context = { family: "Boston Round", capacityMl: 30, color: "Amber", applicator: "Plastic Roller Ball", websiteSku: "GBBstnAmb1ozRollonMattGl" };
        expect(availableViews(kit, context)).toContain("exploded");
        const exploded = stageLayout(kit, "exploded", context)!;
        expect(exploded.parts.find(part => part.slot === "roller")?.url).toMatch(/boston-roller-plastic-20-400/);
        expect(stageLayout(kit, "capon", context)!.parts.find(part => part.slot === "roller")?.url).not.toMatch(/boston-roller/);
    });

    it("leaves the catalog cards alone: these are product page recipes, not approved masters", () => {
        for (const sku of bostonRollOns()) expect(approvedMasterSku(sku)).toBeNull();
    });
});
