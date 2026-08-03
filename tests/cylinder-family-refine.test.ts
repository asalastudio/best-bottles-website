import { describe, expect, it } from "vitest";
import type { CylinderFamilyCardModel } from "@/lib/products/cylinder-family-page";
import {
    cylinderRefineChips,
    filterCylinderFamilyCards,
    parseCylinderFamilyRefine,
    sanitizeCylinderFamilyRefine,
    serializeCylinderFamilyRefine,
    summarizeCylinderRefineResults,
    type CylinderFamilyRefineOptions,
} from "@/lib/products/cylinder-family-refine";

const options: CylinderFamilyRefineOptions = {
    capacities: ["9 ml (0.3 oz)", "10 ml (0.34 oz)"],
    colors: ["Amber", "Clear"],
    applicators: ["Roll-On", "Fine Mist Spray", "Lotion Pump"],
    neckThreadSizes: ["13-415", "17-415"],
};

function card(input: {
    id: string;
    capacity: string;
    color: string;
    applicator: "Roll-On" | "Fine Mist Spray" | "Lotion Pump";
    thread: string;
    variants: number;
}): CylinderFamilyCardModel {
    return {
        _id: input.id,
        id: input.id,
        slug: input.id,
        displayName: input.id,
        family: "Cylinder",
        capacity: input.capacity,
        capacityMl: Number(input.capacity.split(" ")[0]),
        color: input.color,
        category: "Glass Bottle",
        bottleCollection: null,
        neckThreadSize: input.thread,
        variantCount: input.variants,
        priceRangeMin: 0.72,
        priceRangeMax: 0.92,
        applicatorTypes: [],
        applicatorSystems: [input.applicator],
    } as CylinderFamilyCardModel;
}

const cards = [
    card({ id: "amber-17", capacity: "9 ml (0.3 oz)", color: "Amber", applicator: "Roll-On", thread: "17-415", variants: 10 }),
    card({ id: "amber-13", capacity: "9 ml (0.3 oz)", color: "Amber", applicator: "Roll-On", thread: "13-415", variants: 8 }),
    card({ id: "clear-spray", capacity: "10 ml (0.34 oz)", color: "Clear", applicator: "Fine Mist Spray", thread: "17-415", variants: 4 }),
];

describe("Cylinder family authoritative Refine state", () => {
    it("round-trips through the main catalog vocabulary so Grace inherits it", () => {
        const state = sanitizeCylinderFamilyRefine(parseCylinderFamilyRefine(new URLSearchParams(
            "families=Cylinder&capacities=9+ml+%280.3+oz%29&colors=Amber&applicators=rollon&threads=17-415&sort=price",
        )), options);

        expect(state).toEqual({
            capacities: ["9 ml (0.3 oz)"],
            colors: ["Amber"],
            applicators: ["Roll-On"],
            neckThreadSizes: ["17-415"],
            sort: "price",
        });
        expect(serializeCylinderFamilyRefine(state).toString()).toBe(
            "families=Cylinder&capacities=9+ml+%280.3+oz%29&colors=Amber&applicators=rollon&threads=17-415&sort=price",
        );
    });

    it("never broadens a selected 17-415 thread into the 13-415 platform", () => {
        const result = filterCylinderFamilyCards(cards, {
            capacities: ["9 ml (0.3 oz)"],
            colors: ["Amber"],
            applicators: ["Roll-On"],
            neckThreadSizes: ["17-415"],
            sort: "capacity",
        });

        expect(result.map((row) => row.id)).toEqual(["amber-17"]);
    });

    it("drops invalid URL values while preserving every valid constraint", () => {
        const state = sanitizeCylinderFamilyRefine(parseCylinderFamilyRefine(new URLSearchParams(
            "capacities=9+ml+%280.3+oz%29,99+ml&colors=Amber,Purple&applicators=rollon,dropper&threads=17-415,99-999",
        )), options);

        expect(state.capacities).toEqual(["9 ml (0.3 oz)"]);
        expect(state.colors).toEqual(["Amber"]);
        expect(state.applicators).toEqual(["Roll-On"]);
        expect(state.neckThreadSizes).toEqual(["17-415"]);
    });

    it("synchronizes group and configuration counts from the filtered rows", () => {
        expect(summarizeCylinderRefineResults(cards.slice(0, 2))).toEqual({
            groupCount: 2,
            configurationCount: 18,
        });
    });

    it("creates removable customer-facing chips for every active constraint", () => {
        expect(cylinderRefineChips({
            capacities: ["9 ml (0.3 oz)"],
            colors: ["Amber"],
            applicators: ["Roll-On"],
            neckThreadSizes: ["17-415"],
            sort: "capacity",
        })).toEqual([
            { dimension: "capacities", value: "9 ml (0.3 oz)", label: "Capacity: 9 ml (0.3 oz)" },
            { dimension: "colors", value: "Amber", label: "Glass: Amber" },
            { dimension: "applicators", value: "Roll-On", label: "Delivery: Roll-On" },
            { dimension: "neckThreadSizes", value: "17-415", label: "Neck: 17-415" },
        ]);
    });
});
