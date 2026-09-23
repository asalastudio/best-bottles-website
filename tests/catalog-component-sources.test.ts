import { describe, expect, it } from "vitest";
import { catalogComponentPool, indexCatalogComponentPools } from "../convex/catalogComponentSources";
import { resolveCompatibleComponents } from "../convex/componentUtils";
import type { Doc } from "../convex/_generated/dataModel";

const part = { graceSku: "CMP-SPR-BLK-18-415", itemName: "Shiny black spray pump" };
const bottle = { family: "Cylinder", category: "Glass Bottle", capacityMl: 25, color: "Clear",
    shape: null, neckThreadSize: "18-415", websiteSku: "GBcyl25SpryShnBlk", components: [] } as unknown as Doc<"products">;
const donor = { ...bottle, websiteSku: "LBCyl25LtnMtSl", components: { Sprayer: [part] } };

describe("catalog component sources for one Cylinder body", () => {
    it("recovers the existing catalog relationship for another assembly of the same bottle", () => {
        const pool = catalogComponentPool(bottle, [bottle, donor]);
        expect(catalogComponentPool(bottle, [bottle, donor], indexCatalogComponentPools([bottle, donor]))).toEqual(pool);
        expect(pool.grouped.Sprayer.map(p => p.graceSku)).toEqual([part.graceSku]);
        expect(pool.sources).toEqual([donor.websiteSku]);
        expect(bottle.components).toEqual([]);
    });
    it("never treats thread equality or a different mould as physical compatibility", () => {
        for (const mismatch of [{ capacityMl: 50 }, { color: "Frosted" }, { family: "Circle" },
            { neckThreadSize: "17-415" }, { category: "Plastic Bottle" }, { shape: "Round" },
            { websiteSku: "LBCyl25__RETIRED__" }]) {
            expect(catalogComponentPool(bottle, [{ ...donor, ...mismatch }]).grouped).toEqual({});
        }
    });
    it("keeps original records, deduplicates sibling parts and rejects wrong-thread imports", () => {
        const own = { ...bottle, components: { Sprayer: [{ ...part, itemName: "Existing identity" }] } };
        const other = { ...donor, components: { Sprayer: [part, { ...part, graceSku: "CMP-SPR-17-415" }] } };
        expect(catalogComponentPool(own, [donor, other]).grouped.Sprayer).toHaveLength(1);
        expect(catalogComponentPool(own, [donor]).grouped.Sprayer[0].itemName).toBe("Existing identity");
    });
    it("still applies roller occupancy rules after recovering the bottle's source relationships", () => {
        const pool = catalogComponentPool(bottle, [donor]);
        const resolved = resolveCompatibleComponents(pool.grouped, null, { ...bottle, applicator: "Metal Roller Ball" });
        expect(resolved.Sprayer).toBeUndefined();
    });
    it("leaves a missing closed-system relationship unresolved instead of inventing a component", () => {
        expect(catalogComponentPool({ ...bottle, neckThreadSize: "16mm", capacityMl: 28 }, [donor]).grouped).toEqual({});
    });
});
