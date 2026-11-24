import { describe, expect, it } from "vitest";
import {
    activeVolumeTierIndex,
    buildDisplayVolumeTiers,
    cartVolumeNudge,
    formatVolumeQtyRange,
    packOptionLabel,
    packSelectionFromQuantity,
} from "../src/lib/volumePricing";

describe("Baymard volume-tier display", () => {
    it("builds closed quantity ranges with unit price, pack price and checkout vs quote", () => {
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
                packPrice: 0.61,
                savePct: 0,
                saveEach: 0,
                appliesAtCheckout: true,
            },
            {
                minQty: 12,
                maxQty: 143,
                unitPrice: 0.51,
                packPrice: 6.12,
                savePct: 16,
                saveEach: 0.1,
                appliesAtCheckout: false,
            },
            {
                minQty: 144,
                maxQty: null,
                unitPrice: 0.47,
                packPrice: 67.68,
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

describe("legacy Set of menu", () => {
    const tiers = buildDisplayVolumeTiers({
        webPrice1pc: 0.6,
        priceTiers: [
            { minQty: 1, unitPrice: 0.6, totalPrice: 0.6 },
            { minQty: 12, unitPrice: 0.57, totalPrice: 6.84 },
            { minQty: 144, unitPrice: 0.54, totalPrice: 77.76 },
            { minQty: 864, unitPrice: 0.51, totalPrice: 440.64 },
            { minQty: 4320, unitPrice: 0.47, totalPrice: 2021.76 },
        ],
    });
    const usd = (value: number) => `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    it("reads each pack the way the legacy site does, using the published pack total", () => {
        expect(tiers.map(tier => packOptionLabel(tier, usd))).toEqual([
            "Set of 1 – $0.60 each",
            "Set of 12 – $6.84 ($0.57 each)",
            "Set of 144 – $77.76 ($0.54 each)",
            "Set of 864 – $440.64 ($0.51 each)",
            "Set of 4,320 – $2,021.76 ($0.47 each)",   // the published total, not 4,320 × the rounded $0.47
        ]);
    });

    it("reads a total quantity back as packs: whole packs keep their size, anything else is single pieces", () => {
        expect(packSelectionFromQuantity(tiers, 1)).toEqual({ packIndex: 0, packs: 1 });
        expect(packSelectionFromQuantity(tiers, 144)).toEqual({ packIndex: 2, packs: 1 });
        expect(packSelectionFromQuantity(tiers, 288)).toEqual({ packIndex: 2, packs: 2 });
        expect(packSelectionFromQuantity(tiers, 24)).toEqual({ packIndex: 1, packs: 2 });
        expect(packSelectionFromQuantity(tiers, 845)).toEqual({ packIndex: 0, packs: 845 });
    });
});
