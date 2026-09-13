import { describe, expect, it } from "vitest";
import { requiresAssembledClosure } from "../src/lib/products/closure-presentation";
import { getPdpStageModes, preservePdpStageMode } from "../src/lib/products/pdp-stage-modes";
import { getMobileViewModes, coerceMobileViewMode, preferredViewForPicker } from "../src/lib/products/mobile-pdp-view-modes";

describe("assembled dropper presentation", () => {
    it.each(["Vintage Bulb Sprayer", "Vintage Bulb Sprayer with Tassel", "Dropper", "Reducer", "Atomizer"])("keeps %s as a complete top swap on desktop and mobile", applicator => {
        expect(getPdpStageModes({ applicator, hasReleasedExplodedKit: true, hasApprovedImageOrPlate: true }).map(m => m.id)).toEqual(["photo"]);
        expect(getMobileViewModes({ applicator, hasCapOffAsset: true }).map(m => m.id)).toEqual(["assembled"]);
    });
    it("uses the catalog applicator and never a SKU pattern", () => {
        expect(requiresAssembledClosure("Dropper")).toBe(true);
        expect(requiresAssembledClosure(" dropper ")).toBe(true);
        expect(requiresAssembledClosure("GBBstn15BlkDropper")).toBe(false);
        expect(requiresAssembledClosure("Metal Roller Ball")).toBe(false);
        expect(requiresAssembledClosure("N/A", "GBBstn15BlkDrp")).toBe(true);
        expect(requiresAssembledClosure("N/A", "another-sku")).toBe(false);
    });
    it("rejects a saved exploded mode even when a dropper has a released kit", () => {
        const modes = getPdpStageModes({ applicator: "Dropper", hasReleasedExplodedKit: true, hasApprovedImageOrPlate: true });
        expect(modes.map(m => m.id)).toEqual(["photo"]);
        expect(preservePdpStageMode("exploded", modes)).toBe("photo");
    });
    it("keeps mobile and Grace cap-off requests assembled despite old removable parts", () => {
        const caps = { applicator: "Dropper", hasCapOffAsset: true };
        expect(getMobileViewModes(caps).map(m => m.id)).toEqual(["assembled"]);
        expect(coerceMobileViewMode("capOff", caps)).toBe("assembled");
        expect(preferredViewForPicker("capFinish", "capOff", caps)).toBe("assembled");
    });
    it("keeps Boston rollers seated while preserving cap-off", () => {
        for (const applicator of ["Metal Roller Ball", "Plastic Roller Ball"]) {
            const modes = getPdpStageModes({ applicator, productFamily: "Boston Round", hasReleasedExplodedKit: true, hasApprovedImageOrPlate: true });
            expect(modes.map(m => m.id)).not.toContain("exploded");
            expect(preservePdpStageMode("exploded", modes)).toBe("photo");
            expect(getMobileViewModes({ applicator, hasCapOffAsset: true }).map(m => m.id)).toContain("capOff");
        }
    });
    it("retains other families existing roller capabilities", () => {
        expect(getPdpStageModes({ applicator: "Metal Roller Ball", hasReleasedExplodedKit: true }).map(m => m.id)).toContain("exploded");
        expect(getMobileViewModes({ applicator: "Plastic Roller Ball", hasCapOffAsset: true }).map(m => m.id)).toContain("capOff");
    });
});
