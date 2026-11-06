import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { pdpVariantFacts } from "@/lib/products/pdp-variant-facts";
import { buildMobileConfigRows } from "@/lib/products/mobile-pdp-config-rows";

vi.mock("convex/react", () => ({ useQuery: () => [] }));
vi.mock("@react-three/drei", () => ({ useGLTF: () => ({}) }));
const { default: ConfiguratorPdp } = await import("@/components/products/ConfiguratorPdp");
const { closureBaseFromSlug } = await import("@/lib/products/use-closure-thumbnails");

// Selected fields from the read-only production products:getProductGroup query,
// 2026-10-02. Structured color/applicator are null on every 30 ml variant.
const jars = [
    { websiteSku: "CJAmb30BlkCap", color: null, applicator: null, capStyle: null, itemName: "Cream glass jar style 30 ml amber bottle with black cap. For use with body butters, creams, thick lotions. Price each", expectedColor: "Amber" },
    { websiteSku: "CJAmb30SlCap", color: null, applicator: null, capStyle: null, itemName: "Cream glass jar style 30 ml amber bottle with silver cap. For use with body butters, creams, thick lotions. Price each", expectedColor: "Amber" },
    { websiteSku: "CJFrst30BlkCap", color: null, applicator: null, capStyle: null, itemName: "Cream glass jar style 30 ml frosted bottle with black cap. For use with body butters, creams, thick lotions. Small trial or sample size. Great for promotions. Price each", expectedColor: "Frosted" },
    { websiteSku: "CJFrst30SlCap", color: null, applicator: null, capStyle: null, itemName: "Cream jar style 30 ml frosted bottle with silver cap . For use with body butters, creams, thick lotions. Small trial or sample size. Great for promotions. Price each", expectedColor: "Frosted" },
];

function renderFacts(currentSlug: string, variantFacts?: ReturnType<typeof pdpVariantFacts>) {
    return renderToStaticMarkup(createElement(ConfiguratorPdp, {
        currentSlug, groupTitle: "Cream Jar 30 ml", capacityLabel: "", priceEach: null,
        variantFacts, glassOptions: [],
    }));
}

describe("classic jar selected-SKU facts", () => {
    it.each(jars)("renders $websiteSku without clear/spray fallbacks", (jar) => {
        const facts = pdpVariantFacts(jar, null);
        expect(facts).toEqual({ color: jar.expectedColor, closure: "Cap" });
        const html = renderFacts("cream-jar-30ml-mixed", facts);
        expect(html).toMatch(new RegExp(`Glass Finish</span><span[^>]*>${jar.expectedColor}</span>`));
        expect(html).toMatch(/Closure<\/span><span[^>]*>Cap<\/span>/);
        expect(html).not.toContain("Fine Mist Spray");
        expect(html).not.toContain(">Clear<");
        const mobile = buildMobileConfigRows({
            closureBase: closureBaseFromSlug("cream-jar-30ml-mixed"),
            glass: { options: [{ id: facts.color!, label: facts.color! }], selectedId: facts.color },
        });
        expect(mobile.facts).toContainEqual({ label: "Glass Finish", value: jar.expectedColor });
    });

    it("does not confuse the 15 ml plastic jar's cap color with a body finish", () => {
        for (const cap of ["pink", "white"]) {
            const facts = pdpVariantFacts({ itemName: `Plastic, cream jar style 15 ml bottle with ${cap} cap. For use with body butters, creams, and thick lotions.` });
            expect(facts).toEqual({ color: null, closure: "Cap" });
            expect(renderFacts("cream-jar-15ml-mixed", facts)).not.toContain("Glass Finish");
        }
    });

    it.each([
        "Bottle with no cap",
        "Bottle with black cap sold separately",
        "Bottle with black cap. Cap is not included.",
        "Bottle with optional black cap",
        "Bottle compatible with black cap",
        "Bottle can be used with black cap",
        "Bottle without cap",
    ])("does not infer an included closure from %s", (itemName) => {
        expect(pdpVariantFacts({ itemName }).closure).toBeNull();
    });

    it("leaves unknown facts absent on an unmapped route", () => {
        expect(pdpVariantFacts({ itemName: "Container with black cap" })).toEqual({ color: null, closure: "Cap" });
        expect(pdpVariantFacts({})).toEqual({ color: null, closure: null });
        const html = renderFacts("unknown-container", pdpVariantFacts({}));
        expect(html).not.toContain("Glass Finish");
        expect(html).not.toContain("Fine Mist Spray");
        expect(html).not.toContain("Bottle only");
    });

    it("does not revive a clear preset when selected facts are unknown on a derived route", () => {
        expect(renderFacts("cream-jar-30ml-amber-45mm", pdpVariantFacts({}))).not.toContain("Glass Finish");
    });

    it("prefers structured selected-SKU facts, then explicit body wording, then group color", () => {
        expect(pdpVariantFacts({ color: "Amber", applicator: "Lotion Pump", itemName: "Clear bottle with cap" }, "Frosted"))
            .toEqual({ color: "Amber", closure: "Lotion Pump" });
        expect(pdpVariantFacts({ itemName: "Frosted bottle with silver cap" }, "Clear").color).toBe("Frosted");
        expect(pdpVariantFacts({}, "Mixed").color).toBeNull();
        expect(pdpVariantFacts({}, "Cobalt Blue").color).toBe("Cobalt Blue");
    });

    it.each([
        ["cream-jar-30ml-mixed", "none"],
        ["cream-jar-30ml-amber-45mm", "none"],
        ["cylinder-9ml-clear-17-415-rollon", "roller"],
        ["cylinder-9ml-amber-17-415-finemist", "sprayer"],
        ["cylinder-9ml-clear-17-415-lotionpump", "pump"],
    ])("keeps closure capability correct for %s", (slug, base) => {
        expect(closureBaseFromSlug(slug)).toBe(base);
    });

    it("keeps registered bottle presentation when no facts override is provided", () => {
        const html = renderFacts("cylinder-9ml-amber-17-415-finemist");
        expect(html).toContain("Amber");
        expect(html).toContain("Fine Mist Spray");
    });
});
