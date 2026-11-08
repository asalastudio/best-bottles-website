import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import seating from "../src/lib/paper-doll/diva-fitment-seating.json";
import manifest from "../src/lib/paper-doll/approved-kits.generated.json";
import { approvedComponentKit, originalApprovedComponentKit } from "../src/lib/paper-doll/approved-component-kits";
import { DIVA_KIT_VERSION } from "../src/lib/paper-doll/diva-kit-corrections";
import overcapTops from "../src/lib/paper-doll/diva-overcap-tops.json";
import { updatedCylinderKitVersion } from "../src/lib/paper-doll/approved-kit-index";

type Seat = { bodyId: string; glass: string; scale: number; collarCentreX: number; collarFootY: number; neckCentreX: number };
type Box = { x: number; y: number; width: number; height: number };
const seats = seating.rows as Record<string, Seat>;
const tops = overcapTops.rows as Record<string, { image: { url: string; width: number; height: number }; box: Box }>;
/** The overcap box the seating starts from: the restored-top box where there is one. */
const startBox = (sku: string, slot: string, box: Box) => slot === "overcap" && tops[sku] ? tops[sku].box : box;
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
                const from = startBox(sku, part.slot, original.box);
                expect(part.box!.width).toBeCloseTo(from.width * seat.scale, 6);
                expect(part.box!.height).toBeCloseTo(from.height * seat.scale, 6);
                // Scaled about the collar foot (same row) and shifted so the collar's centre is the neck's centre.
                expect(part.box!.y + part.box!.height - seat.collarFootY).toBeCloseTo((from.y + from.height - seat.collarFootY) * seat.scale, 6);
                expect(part.box!.x).toBeCloseTo(seat.neckCentreX + (from.x - seat.collarCentreX) * seat.scale, 6);
            }
        }
    });

    it("serves the corrected kits under their own version and leaves every other kit untouched", () => {
        for (const sku of Object.keys(seats)) expect(updatedCylinderKitVersion(sku)).toBe(DIVA_KIT_VERSION);
        const rows = manifest.rows as Record<string, { register?: { bodyId?: string } }>;
        const untouched = Object.keys(rows).filter(sku => rows[sku].register?.bodyId?.startsWith("diva-") && !Object.hasOwn(seats, sku) && !Object.hasOwn(tops, sku));
        expect(untouched.length).toBeGreaterThan(0);
        for (const sku of [...untouched, "GBDiva100AnSpGl", "GBDiva100RdcrShnGl"]) {
            expect(Object.hasOwn(seats, sku)).toBe(false);
            expect(approvedComponentKit(sku), sku).toEqual(originalApprovedComponentKit(sku));
        }
    });

    it("gives every cut Diva overcap back its top: same width, centre and rim, a little taller", () => {
        expect(Object.keys(tops).length).toBeGreaterThanOrEqual(40);
        for (const [sku, top] of Object.entries(tops)) {
            const before = originalApprovedComponentKit(sku)!.parts.find(part => part.slot === "overcap")!;
            expect(top.image.url).toMatch(/^\/images\/diva-overcaps-2026-11-07\/[0-9a-f]{16}\.[0-9a-f]{12}\.webp$/);
            expect(existsSync(`public${top.image.url}`), top.image.url).toBe(true);
            // The rebuilt cap comes from the real cap-on photograph of the same finish and only restores the top.
            expect(top.box.y + top.box.height).toBeGreaterThan(before.box!.y + before.box!.height - 8);
            expect(top.box.y + top.box.height).toBeLessThan(before.box!.y + before.box!.height + 8);
            // Centred on the cap itself; an old box can sit a few px off it where its cut-out kept stray corner pixels.
            expect(Math.abs((top.box.x + top.box.width / 2) - (before.box!.x + before.box!.width / 2))).toBeLessThan(10);
            const after = approvedComponentKit(sku)!.parts.find(part => part.slot === "overcap")!;
            expect(after.image.url).toBe(top.image.url);
            expect(after.image2x).toBeNull();
        }
    });
});
