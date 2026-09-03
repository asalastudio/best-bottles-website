import { describe, expect, it } from "vitest";
import { buildFocusedPdpRelations, type ProductGroupRelationSource } from "@/lib/products/pdp-relations";

function group(overrides: Partial<ProductGroupRelationSource> = {}): ProductGroupRelationSource {
    return {
        slug: "elegant-30ml-clear-rollon",
        displayName: "Elegant 30 ml Clear Roll-On",
        family: "Elegant",
        capacity: "30 ml",
        capacityMl: 30,
        color: "Clear",
        neckThreadSize: "18-415",
        applicatorTypes: ["Metal Roller Ball"],
        heroImageUrl: null,
        priceRangeMin: 1.25,
        variantCount: 1,
        ...overrides,
    };
}

describe("buildFocusedPdpRelations", () => {
    it("puts same-application capacities only in the size relation", () => {
        const current = group();
        const larger = group({
            slug: "elegant-50ml-clear-rollon",
            displayName: "Elegant 50 ml Clear Roll-On",
            capacity: "50 ml",
            capacityMl: 50,
        });

        const result = buildFocusedPdpRelations(current, [current, larger]);

        expect(result.currentApplication).toBe("rollon");
        expect(result.sameApplicationSizes.map((relation) => relation.slug)).toEqual([
            current.slug,
            larger.slug,
        ]);
        expect(result.otherApplications).toEqual([]);
    });

    it("puts a different dispensing application only in other applications", () => {
        const current = group();
        const spray = group({
            slug: "elegant-30ml-clear-perfumespray",
            displayName: "Elegant 30 ml Clear Perfume Spray",
            applicatorTypes: ["Perfume Spray Pump"],
        });

        const result = buildFocusedPdpRelations(current, [current, spray]);

        expect(result.sameApplicationSizes.map((relation) => relation.slug)).toEqual([current.slug]);
        expect(result.otherApplications).toEqual([
            expect.objectContaining({
                slug: spray.slug,
                application: "spray",
                applicationLabel: "Fine Mist & Spray",
                isCurrent: false,
            }),
        ]);
    });

    it("marks the current canonical group once even when the source repeats it", () => {
        const current = group();

        const result = buildFocusedPdpRelations(current, [current, { ...current }, current]);

        expect(result.sameApplicationSizes).toHaveLength(1);
        expect(result.sameApplicationSizes[0]).toMatchObject({
            slug: current.slug,
            isCurrent: true,
        });
        expect(result.otherApplications).toEqual([]);
    });

    it("keeps a different neck finish as an accurately labeled size alternative", () => {
        const current = group();
        const differentNeck = group({
            slug: "elegant-50ml-clear-20-410-rollon",
            displayName: "Elegant 50 ml Clear Roll-On",
            capacity: "50 ml",
            capacityMl: 50,
            neckThreadSize: "20-410",
        });

        const result = buildFocusedPdpRelations(current, [current, differentNeck]);
        const alternate = result.sameApplicationSizes[1];

        expect(alternate).toMatchObject({
            slug: differentNeck.slug,
            neckThreadSize: "20-410",
            neckThreadLabel: "20-410 neck finish",
        });
        expect(JSON.stringify(alternate).toLowerCase()).not.toContain("compatible");
        expect(result.otherApplications).toEqual([]);
    });

    it("deduplicates by canonical slug rather than display name or color", () => {
        const current = group();
        const first = group({
            slug: "elegant-50ml-clear-rollon",
            displayName: "Elegant Bottle",
            capacity: "50 ml",
            capacityMl: 50,
        });
        const distinctCanonicalGroup = group({
            slug: "elegant-50ml-clear-20-410-rollon",
            displayName: "Elegant Bottle",
            capacity: "50 ml",
            capacityMl: 50,
            neckThreadSize: "20-410",
        });

        const result = buildFocusedPdpRelations(current, [
            current,
            first,
            { ...first },
            distinctCanonicalGroup,
        ]);

        expect(result.sameApplicationSizes.map((relation) => relation.slug).sort()).toEqual([
            current.slug,
            first.slug,
            distinctCanonicalGroup.slug,
        ].sort());
    });

    it("derives relations for non-Cylinder families from the same product truth", () => {
        const current = group({
            slug: "boston-round-30ml-amber-dropper",
            displayName: "Boston Round 30 ml Amber Dropper",
            family: "Boston Round",
            color: "Amber",
            applicatorTypes: ["Dropper"],
        });
        const larger = group({
            slug: "boston-round-60ml-amber-dropper",
            displayName: "Boston Round 60 ml Amber Dropper",
            family: "Boston Round",
            capacity: "60 ml",
            capacityMl: 60,
            color: "Amber",
            applicatorTypes: ["Dropper"],
        });

        const result = buildFocusedPdpRelations(current, [current, larger]);

        expect(result.currentApplication).toBe("dropper");
        expect(result.sameApplicationSizes.map((relation) => relation.slug)).toEqual([
            current.slug,
            larger.slug,
        ]);
    });
});
