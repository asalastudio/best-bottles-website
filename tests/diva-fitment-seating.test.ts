import { describe, expect, it } from "vitest";
import seating from "../src/lib/paper-doll/diva-fitment-seating.json";
import manifest from "../src/lib/paper-doll/approved-kits.generated.json";
import { approvedComponentKit, originalApprovedComponentKit, DIVA_SEATING_VERSION } from "../src/lib/paper-doll/approved-component-kits";
import { updatedCylinderKitVersion } from "../src/lib/paper-doll/approved-kit-index";

type Seat = { bodyId: string; glass: string; scale: number; collarCentreX: number; collarFootY: number; neckCentreX: number };
const seats = seating.rows as Record<string, Seat>;
const FITMENT = new Set(["pump", "sprayer", "overcap", "diptube"]);

describe("Diva fitments seated on the shoulder and centred on the neck (2026-11-07)", () => {
    it("resizes the 100 ml and 46 ml frosted fitments and only centres the 30 ml and 46 ml clear ones", () => {
        for (const [sku, seat] of Object.entries(seats)) {
            if (seat.bodyId === "diva-100ml-18-415") {
                // The real cap-on plate is ~11-13% wider than the 4 Nov kit cap.
                expect(seat.scale, sku).toBeGreaterThan(1.1);
                expect(seat.scale, sku).toBeLessThan(1.14);
            } else if (seat.bodyId === "diva-46ml-18-415" && seat.glass === "Frosted") {
                expect(seat.scale, sku).toBeGreaterThanOrEqual(1);
                expect(seat.scale, sku).toBeLessThan(1.06);
            } else {
                // Within 3% of the plate: the size is right; the table only re-centres the collar.
                expect(seat.scale, sku).toBe(1);
                expect(Math.abs(seat.neckCentreX - seat.collarCentreX), sku).toBeGreaterThanOrEqual(1);
            }
            expect(Math.abs(seat.collarCentreX - seat.neckCentreX), sku).toBeLessThan(8);
        }
        expect(Object.values(seats).filter(seat => seat.bodyId === "diva-100ml-18-415")).toHaveLength(13);
        expect(Object.values(seats).some(seat => seat.bodyId === "diva-30ml-18-415")).toBe(true);
    });

    it("scales each fitment about its collar foot, centres the collar on the neck and leaves the glass alone", () => {
        for (const [sku, seat] of Object.entries(seats)) {
            const before = originalApprovedComponentKit(sku)!;
            const after = approvedComponentKit(sku)!;
            expect(after.register?.bodyId).toBe(seat.bodyId);
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

    it("serves the corrected kits under their own version and leaves every other kit untouched", () => {
        for (const sku of Object.keys(seats)) expect(updatedCylinderKitVersion(sku)).toBe(DIVA_SEATING_VERSION);
        const rows = manifest.rows as Record<string, { register?: { bodyId?: string } }>;
        const untouched = Object.keys(rows).filter(sku => rows[sku].register?.bodyId?.startsWith("diva-") && !Object.hasOwn(seats, sku));
        expect(untouched.length).toBeGreaterThan(0);
        for (const sku of [...untouched, "GBDiva100AnSpGl", "GBDiva100RdcrShnGl"]) {
            expect(Object.hasOwn(seats, sku)).toBe(false);
            expect(approvedComponentKit(sku), sku).toEqual(originalApprovedComponentKit(sku));
        }
    });
});
