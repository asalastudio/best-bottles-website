import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
    isAssembledBottlePdp,
    shouldHideAssembledPdpLowerStack,
} from "@/lib/products/assembled-pdp";

describe("assembled bottle PDP gate (ASA-193)", () => {
    it("hides the lower stack on assembled bottle+cap and bottle+applicator PDPs", () => {
        expect(isAssembledBottlePdp({
            category: "Glass Bottle",
            family: "Square",
            assemblyType: "complete-set",
            applicator: "Cap/Closure",
            itemName: "15 ML CLEAR SQUARE BOTTLE WITH CAP",
        })).toBe(true);
        expect(shouldHideAssembledPdpLowerStack({
            category: "Glass Bottle",
            family: "Cylinder",
            applicator: "Plastic Roller Ball",
            itemName: "9 ml Clear Cylinder Roll-On",
        })).toBe(true);
        expect(shouldHideAssembledPdpLowerStack({
            category: "Glass Bottle",
            family: "Diva",
            applicator: "Perfume Spray",
            itemName: "46 ml Clear Diva Perfume Spray",
        })).toBe(true);
    });

    it("leaves component-only PDPs and non-bottle merchandising alone", () => {
        expect(shouldHideAssembledPdpLowerStack({
            category: "Cap/Closure",
            family: "Cap/Closure",
            itemName: "Short Cap 13-415 — Black",
        })).toBe(false);
        expect(shouldHideAssembledPdpLowerStack({
            category: "Component",
            family: "Sprayer",
            itemName: "Fine Mist Sprayer 18-415",
        })).toBe(false);
        expect(shouldHideAssembledPdpLowerStack({
            category: "Packaging",
            family: "Gift Bag",
            itemName: "Gold Gift Bag",
        })).toBe(false);
    });

    it("does not treat bottle-only bodies as assembled kits", () => {
        expect(isAssembledBottlePdp({
            category: "Glass Bottle",
            family: "Cylinder",
            assemblyType: null,
            applicator: "Bottle Only",
            itemName: "30 ml Clear Cylinder Bottle Only",
        })).toBe(false);
        expect(shouldHideAssembledPdpLowerStack({
            category: "Glass Bottle",
            family: "Boston Round",
            applicator: null,
            itemName: "15 ml Amber Boston Round bottle only",
            websiteSku: "GBBstnAmb15mlOnly",
        })).toBe(false);
    });
});

describe("assembled PDP wiring", () => {
    const desktop = readFileSync("src/app/products/[slug]/ProductDetailClient.tsx", "utf8");
    const mobile = readFileSync("src/components/products/mobile/MobileProductPdp.tsx", "utf8");

    it("gates the desktop lower stack through one assembled-bottle helper", () => {
        expect(desktop).toContain('from "@/lib/products/assembled-pdp"');
        expect(desktop).toContain("shouldHideAssembledPdpLowerStack(");
        expect(desktop).toContain("hideAssembledLowerStack");
        expect(desktop).toMatch(/hideAssembledLowerStack\s*\?\s*null\s*:\s*\(/);
        expect(desktop).toContain('data-testid="pdp-desktop-secondary"');
        expect(desktop).toContain("<PdpDiscoverySections");
        expect(desktop).toContain("<PdpDiscoveryMatrixLink");
    });

    it("does not render mobile discovery disclosures on assembled bottle PDPs", () => {
        expect(mobile).toContain('from "@/lib/products/assembled-pdp"');
        expect(mobile).toContain("shouldHideAssembledPdpLowerStack(");
        expect(mobile).toMatch(/hideAssembledLowerStack\s*\?\s*null\s*:/);
        expect(mobile).toContain("<MobileProductDetails");
    });

    it("leaves Build Your Bottle on the matrix route", () => {
        const matrix = readFileSync("src/app/matrix/page.tsx", "utf8");
        expect(matrix).toContain("Build Your Bottle");
        expect(matrix).not.toContain("shouldHideAssembledPdpLowerStack");
    });
});
