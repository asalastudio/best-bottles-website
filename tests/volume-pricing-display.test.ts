import { describe, expect, it } from "vitest";
import {
    activeVolumeTierIndex,
    buildDisplayVolumeTiers,
    cartVolumeNudge,
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

describe("cart volume nudge", () => {
    const prices = { webPrice1pc: 2.5, webPrice10pc: 2.25, webPrice12pc: 2, unitPrice: 2.5 };

    it("promises no tier price while checkout bills the flat rate", () => {
        expect(cartVolumeNudge(1, prices, false)).toBeNull();
        expect(cartVolumeNudge(11, prices, false)).toBeNull();
        // The setting is off unless NEXT_PUBLIC_VOLUME_TIERS_HONORED_AT_CHECKOUT=true, as in production today.
        expect(cartVolumeNudge(1, prices)).toBeNull();
    });

    it("names the next break once checkout honours it", () => {
        expect(cartVolumeNudge(1, prices, true)).toEqual({ units: 9, targetQty: 10, price: 2.25, savePct: 10 });
        expect(cartVolumeNudge(10, prices, true)).toEqual({ units: 2, targetQty: 12, price: 2, savePct: 20 });
        expect(cartVolumeNudge(12, prices, true)).toBeNull();
        expect(cartVolumeNudge(1, { webPrice1pc: 2.5, webPrice12pc: 2.5 }, true)).toBeNull();
        expect(cartVolumeNudge(1, { unitPrice: null, webPrice12pc: 2 }, true)).toBeNull();
    });
});
