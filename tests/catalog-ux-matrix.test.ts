import { describe, expect, it } from "vitest";
import {
    CATALOG_UX_CASES,
    CATALOG_UX_REQUIRED_COVERAGE,
    catalogUxCaseById,
} from "@/lib/products/catalog-ux-matrix";

describe("catalog-wide UX verification matrix", () => {
    it("covers every approved family and platform architecture", () => {
        const tags = new Set(CATALOG_UX_CASES.flatMap((testCase) => testCase.coverageTags));

        for (const required of CATALOG_UX_REQUIRED_COVERAGE) expect(tags.has(required)).toBe(true);
        expect(new Set(CATALOG_UX_CASES.map((testCase) => testCase.architecture))).toEqual(
            new Set(["paper-doll", "conventional"]),
        );
    });

    it("keeps the golden 17-415 platform distinct from the conventional 13-415 product", () => {
        const golden = catalogUxCaseById("cylinder-9ml-17-415-paper-doll");
        const conventional = catalogUxCaseById("cylinder-9ml-13-415-conventional");

        expect(golden.expected).toMatchObject({ capacityMl: 9, neckThreadSize: "17-415" });
        expect(golden.entryPath).toContain("/products/cylinder-9ml-17-415");
        expect(conventional.expected).toMatchObject({ capacityMl: 9, neckThreadSize: "13-415" });
        expect(conventional.entryPath).not.toContain("cylinder-9ml-17-415");
    });

    it("covers delivery, sellability, stock, and incompatible-combination outcomes", () => {
        const tags = new Set(CATALOG_UX_CASES.flatMap((testCase) => testCase.coverageTags));
        const sellability = new Set(CATALOG_UX_CASES.map((testCase) => testCase.expected.sellability));

        for (const tag of ["bottle-only", "roll-on", "fine-mist", "lotion-pump", "out-of-stock", "incompatible"] as const) {
            expect(tags.has(tag)).toBe(true);
        }
        expect(sellability).toEqual(new Set(["checkout", "quote", "unavailable"]));
    });

    it("keeps the matrix immutable and gives every case desktop and mobile checks", () => {
        expect(Object.isFrozen(CATALOG_UX_CASES)).toBe(true);
        for (const testCase of CATALOG_UX_CASES) {
            expect(Object.isFrozen(testCase)).toBe(true);
            expect(testCase.manualChecks.desktop.length).toBeGreaterThan(0);
            expect(testCase.manualChecks.mobile.length).toBeGreaterThan(0);
            expect(testCase.expected.urlState.length).toBeGreaterThan(0);
        }
    });
});
