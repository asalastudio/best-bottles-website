import { describe, expect, it } from "vitest";
import {
    framedOccupancyPercent,
    pdpCapacityScale,
    pdpStageFrame,
    pdpStageTransformCss,
    PDP_MAX_FILL_RATIO,
} from "../src/lib/products/pdp-stage-frame";

/** Audit 2026-09-20: published Circle plates on the 1000×1100 canvas. */
const CIRCLE_15_CAP_ON = { width: 0.614, height: 0.885 };
const CIRCLE_15_BLK_SHT = { width: 0.643, height: 0.750 };
const CIRCLE_30_CAP_ON = { width: 0.616, height: 0.920 };

describe("Circle capacity scale", () => {
    it("uses the approved 15 ml hero scale and leaves 30 ml at 1", () => {
        expect(pdpCapacityScale("Circle", 15)).toBe(0.775);
        expect(pdpCapacityScale("Circle", 30)).toBe(1);
        expect(pdpCapacityScale("Boston Round", 15)).toBe(1);
    });

    it("makes Circle 15 ml materially smaller than 30 ml after framing", () => {
        const fifteen = framedOccupancyPercent(
            CIRCLE_15_CAP_ON,
            pdpStageFrame({ family: "Circle", capacityMl: 15, view: "assembled" }),
        );
        const thirty = framedOccupancyPercent(
            CIRCLE_30_CAP_ON,
            pdpStageFrame({ family: "Circle", capacityMl: 30, view: "assembled" }),
        );
        expect(fifteen.midW).toBeLessThan(thirty.midW - 8);
        expect(fifteen.fillH).toBeLessThan(thirty.fillH - 8);
        expect(fifteen.fillH).toBeLessThan(PDP_MAX_FILL_RATIO * 100);
    });
});

describe("CAP OFF fit", () => {
    it("keeps Circle 15 gold/silver and black-short inside the 10:11 stage", () => {
        const goldOff = pdpStageFrame({ family: "Circle", capacityMl: 15, view: "capOff" });
        const blackOff = pdpStageFrame({ family: "Circle", capacityMl: 15, view: "capOff" });
        const gold = framedOccupancyPercent(CIRCLE_15_CAP_ON, goldOff);
        const black = framedOccupancyPercent(CIRCLE_15_BLK_SHT, blackOff);
        expect(gold.fillH).toBeLessThan(PDP_MAX_FILL_RATIO * 100);
        expect(black.fillH).toBeLessThan(PDP_MAX_FILL_RATIO * 100);
        expect(gold.midW).toBeLessThan(55);
        expect(goldOff.scale).toBeLessThan(pdpCapacityScale("Circle", 15));
    });

    it("shrinks a beside-cap kit whose union overflows the canvas", () => {
        const parts = [
            { bounds: { left: 180, top: 40, right: 790, bottom: 1060 } },
            { bounds: { left: 820, top: 620, right: 980, bottom: 980 } },
        ];
        const frame = pdpStageFrame({
            family: "Circle",
            capacityMl: 15,
            view: "capOff",
            parts,
        });
        expect(frame.scale).toBeLessThan(0.775);
        const top = parts[0].bounds.top * frame.scale + frame.y * 11;
        const bottom = parts[0].bounds.bottom * frame.scale + frame.y * 11;
        expect(top).toBeGreaterThanOrEqual(40);
        expect(bottom).toBeLessThanOrEqual(1060);
    });

    it("is a no-op CSS transform when scale is identity", () => {
        expect(pdpStageTransformCss({ scale: 1, x: 0, y: 0 })).toBe("none");
        expect(pdpStageTransformCss(pdpStageFrame({ family: "Circle", capacityMl: 15, view: "assembled" }))).toContain("scale(0.775)");
    });
});
