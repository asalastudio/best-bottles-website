import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
    GRACE_ONLINE_PRICING_RULE,
    forGraceModel,
    graceOnlinePricing,
    withGraceOnlinePricing,
} from "../src/lib/grace/onlinePricing";
import { buildBottleComponentsToolResult, buildSearchCatalogToolResult } from "../convex/graceSearchUtils";
import { buildSystemPrompt, VOICE_MODE_ADDENDUM } from "../convex/gracePrompt";
import { GRACE_REALTIME_INSTRUCTIONS } from "../src/lib/grace/realtimeInstructions";
import { GRACE_OPENAI_TOOL_SPECS } from "../src/lib/knowledge/toolSchemas";
import { GRACE_TOOLS } from "../convex/graceToolDefs";

// The 9 Oct case: the clear 15 ml Elegant metal roller, $0.88 online, 12+ quoted at $0.84.
// Grace said 60 × $0.84 = $50.40; the cart charged 60 × $0.88 = $52.80.
const ELEGANT = {
    graceSku: "GB-ELG-CLR-15ML-MRL-SSLV",
    websiteSku: "GBElg15MtlRollSlSh",
    itemName: "Elegant 15ml Clear roller bottle",
    family: "Elegant",
    capacity: "15ml",
    capacityMl: 15,
    color: "Clear",
    applicator: "Metal Roller Ball",
    capColor: "Shiny Silver",
    neckThreadSize: "13-415",
    slug: "elegant-15ml-clear-13-415-rollon",
    webPrice1pc: 0.88,
    webPrice10pc: null,
    webPrice12pc: 0.84,
    stockStatus: "In Stock",
};

describe("Grace online pricing contract", () => {
    it("splits the online unit price from quote-only volume rates", () => {
        expect(graceOnlinePricing(ELEGANT)).toEqual({
            onlineUnitPrice: 0.88,
            quoteOnlyVolumeRates: [{ fromQty: 12, quotedUnitPrice: 0.84 }],
        });
        expect(graceOnlinePricing({
            webPrice1pc: 0.85,
            priceTiers: [{ minQty: 1, unitPrice: 0.85 }, { minQty: 12, unitPrice: 0.81 }, { minQty: 144, unitPrice: 0.77 }, { minQty: 576, unitPrice: 0.72 }],
        }).quoteOnlyVolumeRates).toEqual([
            { fromQty: 12, quotedUnitPrice: 0.81 },
            { fromQty: 144, quotedUnitPrice: 0.77 },
            { fromQty: 576, quotedUnitPrice: 0.72 },
        ]);
        expect(graceOnlinePricing({ webPrice1pc: null, webPrice12pc: 0.5 })).toEqual({ onlineUnitPrice: null, quoteOnlyVolumeRates: [] });
        expect(graceOnlinePricing({ webPrice1pc: 0.5 })).toEqual({ onlineUnitPrice: 0.5, quoteOnlyVolumeRates: [] });
    });

    it("replaces the tier columns on a payload row and keeps them when priced twice", () => {
        const row = withGraceOnlinePricing({ ...ELEGANT, priceTiers: [{ minQty: 1, unitPrice: 0.88 }, { minQty: 12, unitPrice: 0.84 }] });
        expect(row).not.toHaveProperty("webPrice10pc");
        expect(row).not.toHaveProperty("webPrice12pc");
        expect(row).not.toHaveProperty("priceTiers");
        expect(row).toMatchObject({ webPrice1pc: 0.88, onlineUnitPrice: 0.88, quoteOnlyVolumeRates: [{ fromQty: 12, quotedUnitPrice: 0.84 }] });
        expect(withGraceOnlinePricing(row)).toEqual(row);
        const forModel = forGraceModel(row);
        expect(forModel).not.toHaveProperty("webPrice1pc");
        expect(forModel).toMatchObject({ onlineUnitPrice: 0.88, quoteOnlyVolumeRates: [{ fromQty: 12, quotedUnitPrice: 0.84 }] });
    });

    it("gives the search model only onlineUnitPrice and quote-only rates, led by the pricing rule", () => {
        // Text chat passes raw Convex rows; the browser gateway passes rows already priced.
        for (const rows of [[ELEGANT], [withGraceOnlinePricing(ELEGANT)]]) {
            const result = buildSearchCatalogToolResult({ searchTerm: "clear 15ml elegant metal roller", familyLimit: "Elegant" }, rows);
            expect(result.startsWith(GRACE_ONLINE_PRICING_RULE)).toBe(true);
            expect(result).not.toMatch(/webPrice/);
            const parsed = JSON.parse(result.slice(result.indexOf("SEARCH RESULTS:\n") + "SEARCH RESULTS:\n".length));
            expect(parsed).toEqual([expect.objectContaining({
                websiteSku: "GBElg15MtlRollSlSh",
                onlineUnitPrice: 0.88,
                quoteOnlyVolumeRates: [{ fromQty: 12, quotedUnitPrice: 0.84 }],
            })]);
            // $0.84 appears only as a quoted rate, never as a field a model could read as the price.
            const { quoteOnlyVolumeRates, ...rest } = parsed[0];
            expect(quoteOnlyVolumeRates).toHaveLength(1);
            expect(Object.values(rest)).not.toContain(0.84);
        }
    });

    it("prices bottle and component rows the same way for fitment answers", () => {
        const result = buildBottleComponentsToolResult({
            bottle: { ...ELEGANT },
            componentTypes: ["Cap"],
            totalComponents: 1,
            components: { Cap: [{ graceSku: "CMP-CAP-SSLV-13-415", itemName: "Shiny silver cap", webPrice1pc: 0.3, webPrice12pc: 0.25 }] },
        });
        expect(result).toContain(GRACE_ONLINE_PRICING_RULE);
        expect(result).not.toMatch(/webPrice/);
        expect(result).toContain('"onlineUnitPrice": 0.88');
        expect(result).toContain('"quotedUnitPrice": 0.25');
    });

    it("states the rule: online totals use the 1–11 rate, 12+ is from $X on a quote, the $50 minimum stands", () => {
        expect(GRACE_ONLINE_PRICING_RULE).toContain("onlineUnitPrice × quantity");
        expect(GRACE_ONLINE_PRICING_RULE).toContain("$50 order minimum");
        expect(GRACE_ONLINE_PRICING_RULE).toContain("/request-quote");
        expect(GRACE_ONLINE_PRICING_RULE).toContain("Never multiply a quotedUnitPrice by a quantity");
    });
});

describe("Grace prompts quote online totals from the 1–11 rate only", () => {
    it.each(["browser", "text"] as const)("the %s system prompt", (channel) => {
        const prompt = buildSystemPrompt({ channel });
        expect(prompt).toContain("onlineUnitPrice × quantity");
        expect(prompt).toContain("from $X each, confirmed on a quote");
        expect(prompt).toContain("/request-quote");
        expect(prompt).toContain("Never \"60 for $50.40\"");
        expect(prompt).not.toContain("Read the tiers off the product rows");
        expect(prompt).not.toContain("a dollar eighty-five if you grab a dozen");
        // The order minimum rule from the approved FAQ is untouched.
        expect(prompt).toContain("The minimum order is $50.00, excluding shipping charges.");
    });

    it("the voice addendum", () => {
        expect(VOICE_MODE_ADDENDUM).toContain("Online, every quantity is billed at the online unit price");
    });

    it("the realtime instructions", () => {
        expect(GRACE_REALTIME_INSTRUCTIONS).toContain("onlineUnitPrice × quantity");
        expect(GRACE_REALTIME_INSTRUCTIONS).toContain("quoteOnlyVolumeRates");
        expect(GRACE_REALTIME_INSTRUCTIONS).toContain("$50 order minimum");
        expect(GRACE_REALTIME_INSTRUCTIONS).not.toContain("quote from its priceTiers ladder");
        expect(GRACE_REALTIME_INSTRUCTIONS).not.toContain("webPrice12pc");
    });

    it("the tool descriptions", () => {
        const sku = GRACE_OPENAI_TOOL_SPECS.find((spec) => spec.name === "getProductBySku");
        expect(sku?.description).toContain("quoteOnlyVolumeRates");
        expect(sku?.description).toContain("never billed online");
        expect(sku?.description).not.toContain("quote tiers from it verbatim");
        const cart = GRACE_OPENAI_TOOL_SPECS.find((spec) => spec.name === "proposeCartAdd");
        expect(JSON.stringify(cart?.parameters)).toContain("onlineUnitPrice");
        expect(JSON.stringify(cart?.parameters)).not.toContain("Verified twelve-piece price");
        const search = GRACE_TOOLS.find((tool) => tool.type === "function" && tool.function.name === "searchCatalog");
        expect(search?.type === "function" ? search.function.description : "").toContain("quoteOnlyVolumeRates are confirmed on a quote only");
    });
});

describe("Grace chat cards", () => {
    it("label the comparison table's prices as online and quote, not 1pc and 12pc", () => {
        const source = readFileSync("src/components/grace/patterns/PatternF_DeepCompare.tsx", "utf8");
        expect(source).toContain('key: "Online price"');
        expect(source).toContain('key: "Volume (quote)"');
        expect(source).not.toContain("Price (12pc)");
        expect(source).not.toContain("webPrice12pc");
    });
});
