import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Layer = { slot: string; width: number; height: number; pxPerMm: number; anchor: { x: number; y: number }; z: string };
const m = JSON.parse(readFileSync(resolve(__dirname, "..", "data", "register", "phase3", "pilot-measurements.json"), "utf8")) as {
    bodyId: string;
    scaleBasis: { gatePct: number };
    plates: { glass: string; width: number; height: number; pxPerMm: number; anchors: { axisX: number; seatY: number; shoulderY: number; baselineY: number }; checks: { heightErrorPct: number; passes: boolean } }[];
    components: { componentId: string; type: string; layers: Layer[]; checks: { registrationIoU?: number; clippedAtRim?: boolean } }[];
};

describe("Phase 3 pilot measurements (17-415 Cylinder 9 mL)", () => {
    it("has one plate per glass with ordered anchors inside the image", () => {
        expect(m.plates.map(p => p.glass).sort()).toEqual(["Amber", "Clear", "Cobalt Blue", "Frosted", "Swirl"]);
        for (const p of m.plates) {
            const a = p.anchors;
            expect(a.seatY).toBeLessThan(a.shoulderY);
            expect(a.shoulderY).toBeLessThan(a.baselineY);
            expect(a.baselineY).toBeLessThanOrEqual(p.height);
            expect(a.axisX).toBeGreaterThan(0.4 * p.width);
            expect(a.axisX).toBeLessThan(0.6 * p.width);
            expect(p.checks.passes).toBe(Math.abs(p.checks.heightErrorPct) <= m.scaleBasis.gatePct);
        }
    });

    it("flags the Amber and Cobalt photos, which are slimmer than the fitted silhouette", () => {
        expect(m.plates.filter(p => !p.checks.passes).map(p => p.glass).sort()).toEqual(["Amber", "Cobalt Blue"]);
    });

    it("measures all 19 pilot components and both roller inserts", () => {
        expect(m.components).toHaveLength(21);
        expect(m.components.filter(c => c.componentId.startsWith("LIB-")).map(c => c.componentId).sort()).toEqual(["LIB-17-415-MtlRollon", "LIB-17-415-PlsticRollon"]);
    });

    it("registers every library component against its capped master photo", () => {
        for (const c of m.components.filter(c => !c.componentId.startsWith("LIB-"))) {
            expect(c.checks.registrationIoU, c.componentId).toBeGreaterThanOrEqual(0.9);
        }
    });

    it("gives every layer a scale and an anchor that lands on the rim", () => {
        for (const c of m.components) {
            expect(c.layers.length, c.componentId).toBeGreaterThan(0);
            for (const l of c.layers) {
                expect(l.pxPerMm).toBeGreaterThan(5);
                expect(l.anchor.x).toBeGreaterThan(0);
                expect(l.anchor.x).toBeLessThan(l.width);
                if (c.type === "roller-insert") expect(l.z).toBe("behind-body");
            }
            if (c.type === "fine-mist-sprayer") expect(c.layers.map(l => l.slot)).toEqual(["sprayer", "collar", "overcap"]);
            if (c.type === "lotion-pump") expect(c.layers.map(l => l.slot).filter(s => s === "collar")).toHaveLength(1);
        }
        expect(m.components.find(c => c.componentId === "LIB-17-415-MtlRollon")?.checks.clippedAtRim).toBe(true);
    });
});
