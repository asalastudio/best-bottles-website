import { describe, expect, it } from "vitest";
import { GRACE_OPENAI_TOOL_SPECS } from "../src/lib/grace/openaiToolSpecs";

const EXISTING_GRACE_TOOLS = [
    "searchCatalog",
    "getProductBySku",
    "getPolicy",
    "getFamilyOverview",
    "getBottleComponents",
    "checkCompatibility",
    "getCatalogStats",
    "getPriceStats",
    "getCurrentPageContext",
    "getCartContents",
    "getBrowsingHistory",
    "showProducts",
    "compareProducts",
    "proposeCartAdd",
    "proceedToCheckout",
    "navigateToPage",
    "showProductPresentation",
    "prefillForm",
    "updateFormField",
    "submitForm",
    "displayProductCard",
    "displayFamilyCard",
    "displayCompatibility",
    "displayBuildKit",
    "displayComparison",
    "displayCatalogStrip",
    "displayShortlist",
    "displayAnatomy",
    "setCatalogRefinements",
    "prepareQuoteRequest",
    "listGraceProjects",
    "proposeProjectSave",
] as const;

describe("Grace OpenAI tool contract", () => {
    it("ports every existing Grace capability exactly once", () => {
        const names = GRACE_OPENAI_TOOL_SPECS.map((tool) => tool.name);
        expect(names).toHaveLength(EXISTING_GRACE_TOOLS.length);
        expect(new Set(names).size).toBe(names.length);
        expect(names.slice().sort()).toEqual(EXISTING_GRACE_TOOLS.slice().sort());
    });

    it("uses strict object schemas with no undeclared arguments", () => {
        for (const tool of GRACE_OPENAI_TOOL_SPECS) {
            expect(tool.description.length).toBeGreaterThan(20);
            expect(tool.parameters.type).toBe("object");
            expect(tool.parameters.additionalProperties).toBe(false);
            expect(tool.parameters.required.slice().sort()).toEqual(
                Object.keys(tool.parameters.properties).sort(),
            );
        }
    });

    it("marks every optional OpenAI argument nullable while still required", () => {
        const search = GRACE_OPENAI_TOOL_SPECS.find((tool) => tool.name === "searchCatalog");
        expect(search?.parameters.required).toContain("familyLimit");
        expect(search?.parameters.properties.familyLimit.type).toEqual(["string", "null"]);
    });

    it("exposes exact Refine controls without a retired builder contract", () => {
        const refine = GRACE_OPENAI_TOOL_SPECS.find((tool) => tool.name === "setCatalogRefinements");

        expect(refine?.parameters.required).toContain("customerRequest");
        expect(refine?.parameters.properties.neckThreadSizes).toEqual(expect.objectContaining({
            type: ["array", "null"],
        }));
        expect(GRACE_OPENAI_TOOL_SPECS.map((tool) => tool.name)).not.toContain("setPaperDollSelection");
    });

    it("supports quote preparation and confirmation-gated authenticated projects", () => {
        const quote = GRACE_OPENAI_TOOL_SPECS.find((tool) => tool.name === "prepareQuoteRequest");
        const project = GRACE_OPENAI_TOOL_SPECS.find((tool) => tool.name === "proposeProjectSave");
        expect(quote?.parameters.properties.products).toEqual(expect.objectContaining({ type: "array" }));
        expect(project?.description).toContain("confirmation");
        expect(project?.parameters.properties.projectId.type).toEqual(["string", "null"]);
    });

});
