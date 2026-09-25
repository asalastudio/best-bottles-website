import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Layer = { slot: string; width: number; height: number; pxPerMm: number; anchor: { x: number; y: number }; z: string };
const m = JSON.parse(readFileSync(resolve(__dirname, "..", "data", "register", "phase3", "pilot-measurements.json"), "utf8")) as {
    bodyId: string;
    scaleBasis: { gatePct: number };
    plates: { glass: string; width: number; height: number; pxPerMm: number; anchors: { axisX: number; seatY: number; shoulderY: number; baselineY: number }; checks: { widthErrorPct: number; passes: boolean; approvable: boolean; acceptedBy: string | null } }[];
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
            expect(p.checks.passes).toBe(Math.abs(p.checks.widthErrorPct) <= m.scaleBasis.gatePct);
        }
    });

    it("stands every glass at the same height (Jordan 2026-09-25)", () => {
        const heights = m.plates.map(p => (p.anchors.baselineY - p.anchors.seatY) / p.pxPerMm);
        for (const h of heights) expect(h).toBeCloseTo(heights[0], 1);
    });

    it("uses the approved Sunburst plates: one geometry, so every glass has the same size and anchors", () => {
        const first = m.plates[0];
        for (const p of m.plates) {
            expect(p.file).toMatch(/^sunburst\/final\//);
            expect([p.width, p.height]).toEqual([first.width, first.height]);
            expect(p.anchors).toEqual(first.anchors);
            expect(p.checks.passes).toBe(true);
            expect(p.checks.approvable).toBe(true);
        }
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
