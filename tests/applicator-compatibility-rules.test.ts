import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
    applyApplicatorCompatibilityRules,
    isRollOnPluggedBottle,
    needsReducerWithLinerCap,
    resolveCompatibleComponents,
    type NormalizedComponent,
} from "../convex/componentUtils";

function component(graceSku: string, itemName: string): NormalizedComponent {
    return {
        graceSku,
        itemName,
        imageUrl: null,
        webPrice1pc: 0.4,
        webPrice12pc: 0.3,
        capColor: "Black",
        stockStatus: "In Stock",
    };
}

const grouped = {
    Cap: [component("CMP-CAP-BLK-18-415", "Lined short cap 18-415")],
    "Short Cap": [component("CMP-CAP-WHT-18-415", "Lined white short cap")],
    Sprayer: [component("CMP-SPR-BLK-18-415", "Fine mist sprayer 18-415")],
    "Roll-On Cap": [component("CMP-ROC-BLK-18-415", "Roll-on cap 18-415")],
    Reducer: [component("CMP-RDC-18-415", "Orifice reducer 18-415")],
};

describe("applicator compatibility rules (ASA-194)", () => {
    it("treats roll-on plugged bottles as incompatible with lined caps and sprayers", () => {
        expect(isRollOnPluggedBottle({
            applicator: "Plastic Roller Ball",
            itemName: "15 ml Clear Square Roll-On",
            websiteSku: "GBSqr15RollBlkSh",
            graceSku: "GB-SQR-CLR-15ML-ROL-SBLK",
            neckThreadSize: "13-415",
        })).toBe(true);
        expect(isRollOnPluggedBottle({
            applicator: "Cap/Closure",
            itemName: "15 ML CLEAR SQUARE BOTTLE WITH CAP",
            websiteSku: "GBSqr15BlkSht",
            neckThreadSize: "13-415",
        })).toBe(false);
    });

    it("requires a reducer pairing on 18-415 liner-cap (non-roll-on) paths", () => {
        expect(needsReducerWithLinerCap({
            applicator: "Cap/Closure",
            itemName: "30 ml Clear Cylinder with liner cap",
            websiteSku: "GBCyl30Clr",
            neckThreadSize: "18-415",
        })).toBe(true);
        expect(needsReducerWithLinerCap({
            applicator: "Metal Roller Ball",
            itemName: "30 ml Clear Cylinder Roll-On",
            websiteSku: "GBCyl30RollBlk",
            neckThreadSize: "18-415",
        })).toBe(false);
        expect(needsReducerWithLinerCap({
            applicator: "Cap/Closure",
            itemName: "15 ml Clear Square with cap",
            websiteSku: "GBSqr15BlkSht",
            neckThreadSize: "13-415",
        })).toBe(false);
    });

    it("strips lined caps and sprayers from roll-on-plugged compatible lists", () => {
        const resolved = applyApplicatorCompatibilityRules(grouped, grouped, {
            applicator: "Plastic Roller Ball",
            itemName: "15 ml Clear Cylinder Roll-On",
            websiteSku: "GBCyl15RollBlk",
            neckThreadSize: "18-415",
        });

        expect(Object.keys(resolved).sort()).toEqual(["Roll-On Cap"]);
        expect(resolved["Roll-On Cap"]?.[0]?.graceSku).toBe("CMP-ROC-BLK-18-415");
    });

    it("keeps or restores the reducer when an 18-415 liner cap is the active path", () => {
        const withoutReducer = {
            Cap: grouped.Cap,
            Sprayer: grouped.Sprayer,
        };
        const resolved = applyApplicatorCompatibilityRules(withoutReducer, grouped, {
            applicator: "Cap/Closure",
            itemName: "30 ml Clear Cylinder with liner cap",
            websiteSku: "GBCyl30Clr",
            neckThreadSize: "18-415",
        });

        expect(resolved.Cap).toEqual(grouped.Cap);
        expect(resolved.Reducer?.[0]?.graceSku).toBe("CMP-RDC-18-415");
        expect(resolved.Sprayer).toEqual(grouped.Sprayer);
    });

    it("applies applicator rules after the thread fitment filter", () => {
        const resolved = resolveCompatibleComponents(grouped, {
            threadSize: "18-415",
            components: {
                "Short Cap with Liner": "✓",
                Sprayer: "✓",
                Reducer: "✓",
                "Roll-On Cap": "✓",
            },
        }, {
            applicator: "Metal Roller Ball",
            itemName: "30 ml Clear Cylinder Roll-On",
            family: "Cylinder",
            neckThreadSize: "18-415",
            websiteSku: "GBCyl30MtlRollBlk",
        });

        expect(resolved.Cap).toBeUndefined();
        expect(resolved.Sprayer).toBeUndefined();
        expect(resolved["Roll-On Cap"]?.[0]?.graceSku).toBe("CMP-ROC-BLK-18-415");
    });
});

describe("shared resolver wiring", () => {
    it("routes Grace, Matrix, and product PDP through resolveCompatibleComponents", () => {
        for (const path of ["convex/grace.ts", "convex/matrix.ts", "convex/products.ts"]) {
            const source = readFileSync(path, "utf8");
            expect(source, path).toContain("resolveCompatibleComponents(");
        }
    });
});
