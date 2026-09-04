import { describe, expect, it } from "vitest";
import {
    activeVolumeTierIndex,
    buildDisplayVolumeTiers,
    formatVolumeQtyRange,
} from "../src/lib/volumePricing";

describe("Baymard volume-tier display", () => {
    it("builds closed quantity ranges with unit price and checkout vs quote", () => {
        const tiers = buildDisplayVolumeTiers({
            webPrice1pc: 0.61,
            priceTiers: [
                { minQty: 1, unitPrice: 0.61 },
                { minQty: 12, unitPrice: 0.51 },
                { minQty: 144, unitPrice: 0.47 },
            ],
        });

        expect(tiers).toEqual([
            {
                minQty: 1,
                maxQty: 11,
                unitPrice: 0.61,
                savePct: 0,
                saveEach: 0,
                appliesAtCheckout: true,
            },
            {
                minQty: 12,
                maxQty: 143,
                unitPrice: 0.51,
                savePct: 16,
                saveEach: 0.1,
                appliesAtCheckout: false,
            },
            {
                minQty: 144,
                maxQty: null,
                unitPrice: 0.47,
                savePct: 23,
                saveEach: 0.14,
                appliesAtCheckout: false,
            },
        ]);
        expect(formatVolumeQtyRange(1, 11)).toBe("1–11");
        expect(formatVolumeQtyRange(144, null)).toBe("144+");
        expect(activeVolumeTierIndex(tiers, 12)).toBe(1);
    });

    it("falls back to the 10/12 pair when the published ladder is missing", () => {
        const tiers = buildDisplayVolumeTiers({
            webPrice1pc: 1,
            webPrice10pc: 0.8,
            webPrice12pc: 0.7,
        });

        expect(tiers.map((tier) => tier.minQty)).toEqual([1, 10, 12]);
        expect(tiers[1]?.maxQty).toBe(11);
        expect(tiers[2]?.appliesAtCheckout).toBe(false);
    });

    it("hides a single 1-pc rate so the table is never a one-row decoration", () => {
        expect(buildDisplayVolumeTiers({ webPrice1pc: 0.61 })).toEqual([]);
    });
});
