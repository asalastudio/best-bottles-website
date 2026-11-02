import { describe, expect, it } from "vitest";
import { catalogIncludedAssembly } from "../convex/catalogIncludedAssemblies";
import { compatibleFinishComponent, isBuilderCandidate, type CatalogRow } from "../src/lib/bottle-builder/model";

const identities = [
    { websiteSku: "GBVGreen2o4BlackCapSht", graceSku: "GB-VIA-CLR-3ML-GRN-S", color: "Green", capColor: "Green", finish: "Black" },
    { websiteSku: "GBVGreen2o4WhtCapSht", graceSku: "GB-GRN-GRN-20ML", color: "Green", capColor: "Green", finish: "White" },
    { websiteSku: "GBVBlu1o9BlackCapSht", graceSku: "GB-VIA-BLU-3ML-BLK-S", color: "Blue", capColor: "Black", finish: "Black" },
];

describe("source-bound 5/8 dram vial builder choices", () => {
    it.each(identities)("offers the exact complete assembly for $websiteSku", identity => {
        const row = { ...identity, family: "Vial", capacityMl: 3, neckThreadSize: "13-425", applicator: null,
            category: "Glass Bottle", components: {}, resolution: "unknown", itemName: "Glass vial with short cap",
            shopifyVariantId: "own-" + identity.websiteSku, shopifySellable: true, stockStatus: "In Stock", webPrice1pc: 1.08 } as unknown as CatalogRow;
        expect(catalogIncludedAssembly(row)?.finish).toBe(identity.finish);
        expect(isBuilderCandidate(row)).toBe(true);
        expect(compatibleFinishComponent(row)?.websiteSku).toBe(identity.websiteSku);
        expect(catalogIncludedAssembly({ ...row, graceSku: "different-product" })).toBeNull();
        expect(catalogIncludedAssembly({ ...row, neckThreadSize: "13-415" })).toBeNull();
        expect(isBuilderCandidate({ ...row, shopifyVariantId: null })).toBe(false);
        expect(row.components).toEqual({});
    });
});
