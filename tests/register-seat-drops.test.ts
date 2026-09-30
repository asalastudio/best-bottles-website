import { describe, expect, it } from "vitest";
import table from "@/lib/register/seat-drops.generated.json";
import { closureDropMm, closureSeatSignature, setSeatDropsEnabled } from "@/lib/register/seat-drops";
import type { LayerGeometry } from "@/lib/register/compose";

type Layer = LayerGeometry & { url: string };
const base: Layer = { slot: "cap", z: "front", explodeIndex: 1, width: 100, height: 100, pxPerMm: 25, anchor: { x: 50, y: 10 }, url: "https://blob/cap-a.png" };

describe("closure seat drops (caps rest on the shoulder, Jordan 2026-09-30)", () => {
    it("keys a closure by its plate and the images that travel with it, not the insert or the dip tube", () => {
        const insert: Layer = { ...base, slot: "roller", url: "https://blob/roller.png" };
        const tube: Layer = { ...base, slot: "diptube", url: "https://blob/tube.png" };
        const behind: Layer = { ...base, z: "behind-body", url: "https://blob/behind.png" };
        const sig = closureSeatSignature("https://blob/plate.png", [base]);
        expect(sig).toMatch(/^[0-9a-f]{14}$/);
        expect(closureSeatSignature("https://blob/plate.png", [base, insert, tube, behind])).toBe(sig);
        expect(closureSeatSignature("https://blob/other-plate.png", [base])).not.toBe(sig);
        expect(closureSeatSignature("https://blob/plate.png", [{ ...base, url: "https://blob/cap-b.png" }])).not.toBe(sig);
        expect(closureSeatSignature("https://blob/plate.png", [insert, tube])).toBeNull();
    });

    it("reads the audited drop, and nothing for an unknown closure or while the audit measures", () => {
        const [signature, entry] = Object.entries((table as { entries: Record<string, { dropMm: number }> }).entries)[0] ?? [];
        expect(closureDropMm("0000000000000")).toBe(0);
        expect(closureDropMm(null)).toBe(0);
        if (!signature) return;
        expect(closureDropMm(signature)).toBe(entry.dropMm);
        setSeatDropsEnabled(false);
        expect(closureDropMm(signature)).toBe(0);
        setSeatDropsEnabled(true);
    });

    it("never lowers a closure by more than the audit allows", () => {
        for (const entry of Object.values((table as { entries: Record<string, { dropMm: number }> }).entries)) {
            expect(entry.dropMm).toBeGreaterThan(0.2);
            expect(entry.dropMm).toBeLessThan(5);
        }
    });
});
