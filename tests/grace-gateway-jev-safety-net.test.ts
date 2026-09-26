import { describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { isGraceToolResult, type GraceToolResult } from "../src/lib/graceToolResults";

// GBElgFrst15MtlRollGlSh is the first row of src/lib/products/catalog-heroes.json,
// so its tile must carry that SKU's own released hero; GBNoHero999 has none.
const state = vi.hoisted(() => ({
    calls: [] as Array<Record<string, unknown>>,
    plateLookups: [] as string[][],
    rows: [
        {
            graceSku: "GB-ELG-FRS-15ML-MRL-SGLD-02",
            websiteSku: "GBElgFrst15MtlRollGlSh",
            itemName: "Elegant 15 ml frosted glass bottle with metal roller and shiny gold cap",
            family: "Elegant",
            capacity: "15ml",
            capacityMl: 15,
            color: "Frosted",
            canonicalColor: "Frosted",
            applicator: "Metal Roller Ball",
            capColor: "Shiny Gold",
            neckThreadSize: "13-415",
            slug: "elegant-15ml-frosted-13-415-rollon",
            webPrice1pc: 1.5,
            stockStatus: "In Stock",
            category: "Glass Bottle",
            shopifyVariantId: null,
        },
        {
            graceSku: "GB-NOHERO-999",
            websiteSku: "GBNoHero999",
            itemName: "Elegant 30 ml clear glass bottle with plastic roller",
            family: "Elegant",
            capacity: "30ml",
            capacityMl: 30,
            color: "Clear",
            canonicalColor: "Clear",
            applicator: "Plastic Roller Ball",
            capColor: "Black",
            neckThreadSize: "18-415",
            slug: "elegant-30ml-clear-18-415-rollon",
            webPrice1pc: 1.9,
            stockStatus: "In Stock",
            category: "Glass Bottle",
            shopifyVariantId: null,
        },
    ],
}));

vi.mock("@/lib/convexServerClient", () => ({
    createResilientConvexHttpClient: () => ({
        async query(ref: unknown, args: Record<string, unknown>) {
            const name = getFunctionName(ref as never);
            if (name === "productPlates:forSkus") {
                // Only the row without a Sunburst hero is asked for; it has a cap-on plate.
                state.plateLookups.push([...(args.skus as string[])]);
                return {
                    plates: { GBNoHero999: { image: "https://blob.example/plates/GBNoHero999.png", thumb: "https://blob.example/plates/GBNoHero999-thumb.png" } },
                    conflicts: [],
                };
            }
            if (name !== "grace:searchCatalog") throw new Error(`Unexpected query: ${name}`);
            state.calls.push(args);
            // Jev's applicator reading matches nothing; the request as written does.
            return args.applicatorFilter ? [] : state.rows;
        },
    }),
}));

vi.mock("@/lib/grace/enrichSearchCatalogWithJev", () => ({
    enrichSearchCatalogWithJev: async (params: Record<string, unknown>) => ({
        args: { ...params, applicatorFilter: "Fine Mist Sprayer" },
        applied: true,
        decisions: { applicator: "filter finemist", family: "", glassColour: "", atomizerFinish: "", capFinish: "" },
        ms: 3,
    }),
}));

describe("Grace tool gateway: Jev safety net and search tiles", () => {
    it("re-runs the request as written when Jev's filter empties it, tells the model, and links every tile", async () => {
        process.env.NEXT_PUBLIC_CONVEX_URL = "https://unit-test.convex.cloud";
        const { executeGraceServerTool } = await import("../src/lib/grace/toolGatewayServer");

        const result = await executeGraceServerTool({
            toolName: "searchCatalog",
            parameters: { searchTerm: "15ml frosted elegant roller", categoryLimit: null, familyLimit: null, applicatorFilter: null },
        });

        expect(state.calls).toHaveLength(2);
        expect(state.calls[0]).toMatchObject({ searchTerm: "15ml frosted elegant roller", applicatorFilter: "Fine Mist Sprayer" });
        expect(state.calls[1].applicatorFilter).toBeUndefined();
        expect(state.calls[1].searchTerm).toBe("15ml frosted elegant roller");

        expect(isGraceToolResult(result)).toBe(true);
        const structured = result as GraceToolResult;
        expect(structured.status).toBe("ok");
        expect(structured.message).toContain("Jev's reading of the request (applicator: filter finemist) matched nothing in the catalogue");
        expect(structured.message).toContain("GBElgFrst15MtlRollGlSh");

        const tiles = (structured.products ?? []) as Array<{ verifiedPdpHref?: string | null; heroImageUrl?: string | null; heroImageKind?: string | null; websiteSku?: string | null }>;
        expect(tiles.map((tile) => tile.websiteSku)).toEqual(["GBElgFrst15MtlRollGlSh", "GBNoHero999"]);
        expect(tiles[0].verifiedPdpHref).toBe("/products/elegant-15ml-frosted-13-415-rollon?sku=GBElgFrst15MtlRollGlSh");
        // The group's released Sunburst hero, on the tile of exactly that SKU.
        expect(tiles[0].heroImageUrl).toMatch(/^\/images\//);
        expect(tiles[0].heroImageKind).toBe("sunburst");
        // No hero for this group: the SKU's own cap-on plate from the plate index.
        expect(tiles[1].verifiedPdpHref).toBe("/products/elegant-30ml-clear-18-415-rollon?sku=GBNoHero999");
        expect(tiles[1].heroImageUrl).toBe("https://blob.example/plates/GBNoHero999-thumb.png");
        expect(tiles[1].heroImageKind).toBe("plate");
        expect(state.plateLookups.at(-1)).toEqual(["GBNoHero999"]);
    });

    it("keeps the raw array contract for returnRaw callers", async () => {
        const { executeGraceServerTool } = await import("../src/lib/grace/toolGatewayServer");
        const raw = await executeGraceServerTool({
            toolName: "searchCatalog",
            parameters: { searchTerm: "15ml frosted elegant roller", returnRaw: true },
        });
        expect(Array.isArray(raw)).toBe(true);
        const rows = raw as Array<{ websiteSku?: string; verifiedPdpHref?: string | null; heroImageUrl?: string | null; heroImageKind?: string | null }>;
        expect(rows.map((row) => row.websiteSku)).toEqual(["GBElgFrst15MtlRollGlSh", "GBNoHero999"]);
        // Raw rows carry their own link and photo too, for showProducts tiles.
        expect(rows[0].verifiedPdpHref).toBe("/products/elegant-15ml-frosted-13-415-rollon?sku=GBElgFrst15MtlRollGlSh");
        expect(rows[0].heroImageUrl).toMatch(/^\/images\//);
        expect(rows[0].heroImageKind).toBe("sunburst");
        expect(rows[1]).toMatchObject({
            verifiedPdpHref: "/products/elegant-30ml-clear-18-415-rollon?sku=GBNoHero999",
            heroImageUrl: "https://blob.example/plates/GBNoHero999-thumb.png",
            heroImageKind: "plate",
        });
    });
});
