import { describe, expect, it } from "vitest";
import { builderProductEntry } from "@/lib/bottle-builder/entry";
import { deriveBuilder, type BuilderBody, type BuilderConfiguration } from "@/lib/bottle-builder/model";
import { buildYourBottleHref } from "@/lib/products/pdp-redesign/model";

const config = (id: string, color: string, closure: string) => ({ id, bodyId: "9|17-415", color, closure,
    fitment: "Fine Mist Sprayer", kit: null, bodyImage: null,
    product: { graceSku: `grace-${id}`, webPrice1pc: 1 },
} as BuilderConfiguration);
const configs = [config("clear-black", "Clear", "Black"), config("swirl-black", "Swirl", "Black"), config("swirl-gold", "Swirl", "Gold")];
const bodies = [{ id: "9|17-415", configurations: configs }, { id: "9|13-415", configurations: [config("tall-nine", "Clear", "Black")] }] as BuilderBody[];

describe("product to builder handoff", () => {
    it("preserves an exact finish that chooser slimming would omit, through first paint", () => {
        const start = builderProductEntry(bodies, "swirl-gold");
        expect(start.selection).toMatchObject({ bodyId: "9|17-415", color: "Swirl", fitment: "Fine Mist Sprayer", closure: "Gold" });
        expect(deriveBuilder(start.bodies, start.selection).configuration?.id).toBe("swirl-gold");
        expect(start.step).toBe(3);
        expect(start.bodies[0].chooserOnly).toBe(false);
        expect(start.bodies[1].chooserOnly).toBe(true);
        expect(start.unavailable).toBe(false);
    });
    it("accepts a Grace SKU and does not confuse two 9 ml necks", () => {
        expect(builderProductEntry(bodies, "grace-swirl-black").selection.bodyId).toBe("9|17-415");
    });
    it("keeps ordinary entry and unavailable products safe without substituting a bottle", () => {
        expect(builderProductEntry(bodies).selection.bodyId).toBeNull();
        expect(builderProductEntry(bodies).unavailable).toBe(false);
        expect(builderProductEntry(bodies, "removed-product")).toMatchObject({ step: 0, unavailable: true, selection: { bodyId: null } });
    });
    it("carries the current SKU and safely encodes query values", () => {
        const href = buildYourBottleHref({ family: "Boston Round" }, null, "sku & gold");
        const params = new URL(href, "http://localhost").searchParams;
        expect(params.get("family")).toBe("Boston Round");
        expect(params.get("sku")).toBe("sku & gold");
        expect(params.get("from")).toBe("pdp");
    });
});
