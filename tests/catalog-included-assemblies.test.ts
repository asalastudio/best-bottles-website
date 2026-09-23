import { describe, it, expect } from "vitest";
import assemblies from "../convex/catalog-included-assemblies.json";
import { catalogIncludedAssembly } from "../convex/catalogIncludedAssemblies";
import { compatibleFinishComponent, isBuilderCandidate, type CatalogRow } from "@/lib/bottle-builder/model";

describe("exact catalog assemblies without a separately sold loose component", () => {
    it.each(assemblies)("retains only the included hardware for $websiteSku", source => {
        const row = { ...source, category: "Glass Bottle", itemName: "Catalog bottle assembly", resolution: "unknown",
            components: {}, shopifyVariantId: "assembly-variant", shopifySellable: true, stockStatus: "In Stock", webPrice1pc: 1 } as unknown as CatalogRow;
        expect(catalogIncludedAssembly(row)).toEqual(source);
        expect(compatibleFinishComponent(row)?.websiteSku).toBe(source.websiteSku);
        expect(isBuilderCandidate(row)).toBe(true);
        for (const change of [{ graceSku: "different" }, { websiteSku: "another" }, { capacityMl: 60 },
            { color: "Frosted" }, { neckThreadSize: "13-415" }, { category: "Component" },
            { capColor: "not-the-selected-finish" }]) {
            expect(catalogIncludedAssembly({ ...row, ...change })).toBeNull();
            expect(isBuilderCandidate({ ...row, ...change })).toBe(false);
        }
        for (const change of [{ stockStatus: "Out of Stock" }, { shopifySellable: false }, { shopifyVariantId: null }, { webPrice1pc: 0 }])
            expect(isBuilderCandidate({ ...row, ...change })).toBe(false);
        expect(row.components).toEqual({});
        expect(row.shopifyVariantId).toBe("assembly-variant");
    });
});
