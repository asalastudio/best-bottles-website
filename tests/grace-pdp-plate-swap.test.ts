import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
    dispatchGracePdpPlateCommand,
    isGracePdpPlateCommand,
    matchListedOption,
    parsePlateViewMode,
    parseRollerVariant,
} from "@/lib/grace/pdpPlateSwap";

describe("Grace current-PDP plate swap", () => {
    it("matches a requested finish to the options the picker already lists", () => {
        expect(matchListedOption("gold", ["Black", "Gold", "White"])).toBe("Gold");
        expect(matchListedOption("shiny gold", ["Shiny Gold", "Matte Gold"])).toBe("Shiny Gold");
        expect(matchListedOption("teal", ["Black", "Gold"])).toBeNull();
    });

    it("parses roller and cap-on/off language without inventing a builder", () => {
        expect(parseRollerVariant("metal ball")).toBe("metal");
        expect(parseRollerVariant("plastic")).toBe("plastic");
        expect(parseRollerVariant("fine mist")).toBeNull();
        expect(parsePlateViewMode("cap off")).toBe("capOff");
        expect(parsePlateViewMode("with the cap on")).toBe("assembled");
        expect(parsePlateViewMode("dimensions")).toBeNull();
        expect(isGracePdpPlateCommand({ capOption: "Gold" })).toBe(true);
        expect(isGracePdpPlateCommand({})).toBe(false);
    });

    it("is a no-op off the window, and the PDP listens on the same commit path as the picker", () => {
        expect(dispatchGracePdpPlateCommand({ capOption: "Gold" })).toBe(false);
        const pdp = readFileSync("src/app/products/[slug]/ProductDetailClient.tsx", "utf8");
        const provider = readFileSync("src/components/grace/GraceProvider.tsx", "utf8");
        const mobile = readFileSync("src/components/products/mobile/MobileProductPdp.tsx", "utf8");
        expect(pdp).toContain("GRACE_PDP_PLATE_EVENT");
        expect(pdp).toContain("handleGuidedVariantSelection");
        expect(provider).toContain("configureCurrentProduct");
        expect(provider).not.toContain("setPaperDollSelection");
        expect(mobile).toContain("GRACE_PDP_PLATE_EVENT");
    });
});
