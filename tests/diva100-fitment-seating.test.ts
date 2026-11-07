import { describe, expect, it } from "vitest";
import seating from "../src/lib/paper-doll/diva100-fitment-seating.json";
import { approvedComponentKit, originalApprovedComponentKit, DIVA100_SEATING_VERSION } from "../src/lib/paper-doll/approved-component-kits";
import { updatedCylinderKitVersion } from "../src/lib/paper-doll/approved-kit-index";

type Seat = { scale: number; collarCentreX: number; collarFootY: number; neckCentreX: number };
const seats = seating.rows as Record<string, Seat>;
const FITMENT = new Set(["pump", "sprayer", "overcap", "diptube"]);

describe("Diva 100 ml fitments seated on the shoulder (2026-11-07)", () => {
    it("covers all six lotion-pump and six fine-mist finishes plus the clear-overcap pump", () => {
        expect(Object.keys(seats).filter(sku => sku.startsWith("LBDiva100Ltn"))).toHaveLength(7);
        expect(Object.keys(seats).filter(sku => sku.startsWith("GBDiva100Spry"))).toHaveLength(6);
        for (const seat of Object.values(seats)) {
            // Each SKU's own cap-on plate is ~11-13% wider than the kit's cap; nothing outside that band is plausible.
            expect(seat.scale).toBeGreaterThan(1.08);
            expect(seat.scale).toBeLessThan(1.16);
            expect(Math.abs(seat.collarCentreX - seat.neckCentreX)).toBeLessThan(4);
        }
    });

    it("scales each fitment about its collar foot, centres the collar on the neck and leaves the glass alone", () => {
        for (const [sku, seat] of Object.entries(seats)) {
            const before = originalApprovedComponentKit(sku)!;
            const after = approvedComponentKit(sku)!;
            expect(after.parts).toHaveLength(before.parts.length);
            for (const [index, part] of after.parts.entries()) {
                const original = before.parts[index];
                if (!FITMENT.has(part.slot) || !original.box) {
                    expect(part).toEqual(original);
                    continue;
                }
                expect(part.box!.width).toBeCloseTo(original.box.width * seat.scale, 6);
                expect(part.box!.height).toBeCloseTo(original.box.height * seat.scale, 6);
                // Scaled about the collar foot (same row) and shifted so the collar's centre is the neck's centre.
                expect(part.bounds.bottom - seat.collarFootY).toBeCloseTo((original.bounds.bottom - seat.collarFootY) * seat.scale, 6);
                expect(part.box!.x).toBeCloseTo(seat.neckCentreX + (original.box.x - seat.collarCentreX) * seat.scale, 6);
            }
        }
    });

    it("serves the seated kits under their own version and leaves every other kit untouched", () => {
        for (const sku of Object.keys(seats)) expect(updatedCylinderKitVersion(sku)).toBe(DIVA100_SEATING_VERSION);
        for (const sku of ["GBDiva100AnSpGl", "GBDiva100RdcrShnGl", "LBDiva30LtnMtGl", "GBDiva46SpryMtGl"]) {
            expect(Object.hasOwn(seats, sku)).toBe(false);
            if (originalApprovedComponentKit(sku)) expect(approvedComponentKit(sku)).toEqual(originalApprovedComponentKit(sku));
        }
    });
});
