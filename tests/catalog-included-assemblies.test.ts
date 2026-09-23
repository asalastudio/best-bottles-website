import { describe, it, expect } from "vitest";
import assemblies from "../convex/catalog-included-assemblies.json";
import caps13_415 from "../convex/catalog-included-13-415-caps.json";
import { catalogIncludedAssembly } from "../convex/catalogIncludedAssemblies";
import { compatibleFinishComponent, isBuilderCandidate, type CatalogRow } from "@/lib/bottle-builder/model";

describe("exact catalog assemblies without a separately sold loose component", () => {
    it.each(assemblies)("retains only the included hardware for $websiteSku", source => {
        const row = { ...source, category: "Glass Bottle", itemName: "Catalog bottle assembly", resolution: "unknown",
            components: {}, shopifyVariantId: "assembly-variant", shopifySellable: true, stockStatus: "In Stock", webPrice1pc: 1 } as unknown as CatalogRow;
        expect(catalogIncludedAssembly(row)).toEqual(source);
        expect(compatibleFinishComponent(row)?.websiteSku).toBe(source.websiteSku);
        const excludedFromChooser = source.family === "Cylinder" && ([3.3, 4].includes(source.capacityMl)
            || ([28, 50].includes(source.capacityMl) && source.neckThreadSize === "16mm"));
        expect(isBuilderCandidate(row)).toBe(!excludedFromChooser);
        for (const change of [{ graceSku: "different" }, { websiteSku: "another" }, { capacityMl: 60 },
            { color: source.color === "Frosted" ? "Clear" : "Frosted" }, { neckThreadSize: "13-415" }, { category: "Component" },
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

describe("reviewed short and tall 13-415 cap assemblies", () => {
    it("admits the six lined short caps and white ribbed cap only on their exact listed bottle SKUs", () => {
        expect(caps13_415).toHaveLength(14); // clear and cobalt glass × seven short caps
        for (const source of caps13_415) {
            const row = { ...source, category: "Glass Bottle", itemName: "Listed cap assembly", resolution: "unknown",
                components: {}, shopifyVariantId: "assembly-variant", shopifySellable: true,
                stockStatus: "In Stock", webPrice1pc: 1 } as unknown as CatalogRow;
            expect(catalogIncludedAssembly(row)).toEqual(source);
            expect(compatibleFinishComponent(row)?.websiteSku).toBe(source.websiteSku);
            expect(isBuilderCandidate(row)).toBe(true);
            for (const drift of [{ websiteSku: "another" }, { neckThreadSize: "17-415" }, { color: "Amber" },
                { capColor: "Short Ribbed Black" }, { graceSku: "another" }])
                expect(catalogIncludedAssembly({ ...row, ...drift })).toBeNull();
        }
    });
});
