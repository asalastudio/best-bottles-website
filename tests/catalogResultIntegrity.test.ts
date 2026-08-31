import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS } from "@/lib/catalogFilters";
import { auditCatalogResult } from "@/lib/catalogResultIntegrity";

describe("catalog result integrity", () => {
    it("flags a 13-415 group under an active 17-415 constraint", () => {
        expect(auditCatalogResult({
            filters: { ...EMPTY_FILTERS, neckThreadSizes: ["17-415"] },
            expectedCount: 1,
            items: [{
                _id: "bad",
                family: "Cylinder",
                capacityMl: 9,
                color: "Amber",
                neckThreadSize: "13-415",
                applicatorTypes: ["Roll-On"],
            }],
        })).toEqual({
            status: "constraint_mismatch",
            expectedCount: 1,
            renderedCount: 1,
            violatingGroupIds: ["bad"],
        });
    });

    it("verifies the exact 9 ml 17-415 roll-on result", () => {
        expect(auditCatalogResult({
            filters: {
                ...EMPTY_FILTERS,
                families: ["Cylinder"],
                capacities: ["9 ml"],
                applicators: ["rollon"],
                neckThreadSizes: ["17-415"],
            },
            expectedCount: 1,
            items: [{
                _id: "good",
                family: "Cylinder",
                capacityMl: 9,
                color: "Clear",
                neckThreadSize: "17-415",
                applicatorTypes: ["Metal Roller Ball", "Roll-On"],
            }],
        })).toMatchObject({ status: "verified", violatingGroupIds: [] });
    });

    it("reports count mismatches separately from constraint mismatches", () => {
        expect(auditCatalogResult({
            filters: EMPTY_FILTERS,
            expectedCount: 2,
            items: [{
                _id: "one",
                family: "Cylinder",
                capacityMl: 9,
                color: "Clear",
                neckThreadSize: "17-415",
                applicatorTypes: [],
            }],
        })).toEqual({
            status: "count_mismatch",
            expectedCount: 2,
            renderedCount: 1,
            violatingGroupIds: [],
        });
    });
});
