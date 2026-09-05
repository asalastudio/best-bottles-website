import { describe, expect, it } from "vitest";
import { resolveGlassSiblingVariant } from "../src/lib/products/guided-variant-resolver";
const variants = [
    { sku: "cobalt-plastic-black", applicator: "Plastic Roller Ball", cap: "Black Dotted" },
    { sku: "cobalt-metal-gold", applicator: "Metal Roller Ball", cap: "Matte Gold" },
    { sku: "cobalt-metal-silver", applicator: "Metal Roller Ball", cap: "Matte Silver" },
];
const deps = { sku: (v: typeof variants[number]) => v.sku, applicator: (v: typeof variants[number]) => v.applicator, capFinish: (v: typeof variants[number]) => v.cap };
describe("glass sibling selection", () => {
    it("preserves the selected metal roller and silver cap instead of the destination default", () => {
        expect(resolveGlassSiblingVariant(variants, { applicator: "Metal Roller Ball", capOption: "Matte Silver" }, deps)?.sku).toBe("cobalt-metal-silver");
    });
    it("preserves roller material when the finish is unavailable", () => {
        expect(resolveGlassSiblingVariant(variants, { applicator: "Metal Roller Ball", capOption: "Pink Dotted" }, deps)?.sku).toBe("cobalt-metal-gold");
    });
    it("does not invent a variant for empty destinations", () => {
        expect(resolveGlassSiblingVariant([], { applicator: "Metal Roller Ball", capOption: "Matte Silver" }, deps)).toBeNull();
    });
});
