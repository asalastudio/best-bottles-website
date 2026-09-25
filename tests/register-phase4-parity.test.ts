import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Result = {
    websiteSku: string; glass: string; frameSource: string; passes: boolean; checks: Record<string, boolean>;
    seat: { deltaPx: number | null }; foot: { deltaPx: number | null };
    body: { iou: number }; closure: { iou: number }; silhouette: { iou: number };
};
const parity = JSON.parse(readFileSync(resolve(__dirname, "..", "data", "register", "phase4", "parity-pilot.json"), "utf8")) as {
    bodyId: string; frameMode: string; thresholds: Record<string, number>;
    counts: { pilotSkus: number; withLegacyKit: number; withoutLegacyKit: number; pass: number; fail: number };
    withoutLegacyKit: string[]; results: Result[];
};

describe("Phase 4 parity gate (17-415 Cylinder 9 mL)", () => {
    it("covers every pilot SKU that has a legacy kit, framed on that kit's own pixels", () => {
        expect(parity.bodyId).toBe("cylinder-9ml-17-415");
        expect(parity.frameMode).toBe("pixels");
        expect(parity.counts.pilotSkus).toBe(145);
        expect(parity.counts.withLegacyKit + parity.counts.withoutLegacyKit).toBe(145);
        expect(parity.results).toHaveLength(parity.counts.withLegacyKit);
        expect(parity.results.every((r) => r.frameSource === "legacy-kit-pixels")).toBe(true);
        expect(new Set(parity.results.map((r) => r.websiteSku)).size).toBe(parity.results.length);
    });

    it("stands the register's bottle on the legacy seat and foot to the pixel", () => {
        for (const r of parity.results) {
            expect(r.seat.deltaPx, r.websiteSku).toBeLessThanOrEqual(1);
            expect(r.foot.deltaPx, r.websiteSku).toBeLessThanOrEqual(1);
        }
    });

    it("draws the shared clear-glass geometry within 1 % of the legacy clear kits", () => {
        // Clear is the glass the plate geometry was locked on; here the register and the kits share a source photo.
        for (const r of parity.results.filter((r) => r.glass === "Clear")) expect(r.body.iou, r.websiteSku).toBeGreaterThanOrEqual(0.98);
    });

    it("passes every kit at the proposed thresholds, and the counts agree with the rows", () => {
        expect(parity.thresholds).toEqual({ seatPx: 2, footPx: 2, bodyIou: 0.96, closureIou: 0.86, silhouetteIou: 0.94 });
        expect(parity.counts.pass).toBe(parity.results.filter((r) => r.passes).length);
        expect(parity.counts.fail).toBe(0);
        for (const r of parity.results) {
            expect(r.passes).toBe(Object.values(r.checks).every(Boolean));
            expect(r.body.iou).toBeGreaterThanOrEqual(parity.thresholds.bodyIou);
            expect(r.closure.iou).toBeGreaterThanOrEqual(parity.thresholds.closureIou);
            expect(r.silhouette.iou).toBeGreaterThanOrEqual(parity.thresholds.silhouetteIou);
        }
    });
});
