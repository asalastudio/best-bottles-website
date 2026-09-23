import { describe, expect, it } from "vitest";
import {
    framedOccupancyPercent,
    pdpCapacityScale,
    pdpStageFrame,
    pdpStageTransformCss,
    PDP_MAX_FILL_RATIO,
} from "../src/lib/products/pdp-stage-frame";
import {
    circleCapacityTargets,
    PDP_MIN_CAPACITY_MIDW_GAP,
    pdpPublishedPlateScale,
} from "../src/lib/products/pdp-capacity-standards";
import { detachedCapOffset, withDetachedCapOffsets } from "../src/lib/products/kit-frame";

/** Audit 2026-09-20: published Circle plates on the 1000×1100 canvas. */
const CIRCLE_15_CAP_ON = { width: 0.614, height: 0.885 };
const CIRCLE_15_BLK_SHT = { width: 0.643, height: 0.750 };
const CIRCLE_30_CAP_ON = { width: 0.616, height: 0.920 };

describe("Circle capacity standard", () => {
    it("locks a monotonic mid-body width ladder 15 < 30 < 50 < 100", () => {
        const targets = circleCapacityTargets();
        expect(targets[15].midBodyWidthPercent).toBeLessThan(
            (targets[30].midBodyWidthPercent ?? 0) - PDP_MIN_CAPACITY_MIDW_GAP,
        );
        expect(targets[30].midBodyWidthPercent).toBeLessThan(targets[50].midBodyWidthPercent ?? 0);
        expect(targets[50].midBodyWidthPercent).toBeLessThan(targets[100].midBodyWidthPercent ?? 0);
        expect(targets[15].publishedPlateScale).toBe(0.775);
        expect(targets[30].publishedPlateScale).toBeLessThan(1);
    });

    it("uses the locked Circle scales and leaves Boston Round alone", () => {
        expect(pdpCapacityScale("Circle", 15)).toBe(0.775);
        expect(pdpCapacityScale("Circle", 30)).toBe(0.954);
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
        expect(fifteen.midW).toBeLessThan(thirty.midW - PDP_MIN_CAPACITY_MIDW_GAP);
        expect(fifteen.fillH).toBeLessThan(thirty.fillH);
        expect(fifteen.fillH).toBeLessThan(PDP_MAX_FILL_RATIO * 100);
        expect(thirty.fillH).toBeLessThanOrEqual(PDP_MAX_FILL_RATIO * 100 + 0.05);
    });
});

describe("CAP OFF compositing", () => {
    it("never grows the bottle past the locked Circle 15 glass size", () => {
        const assembled = pdpStageFrame({ family: "Circle", capacityMl: 15, view: "assembled" });
        const goldOff = pdpStageFrame({ family: "Circle", capacityMl: 15, view: "capOff" });
        expect(goldOff.scale).toBeLessThanOrEqual(assembled.scale);
        expect(goldOff.scale).toBeLessThan(pdpCapacityScale("Circle", 15));
        const gold = framedOccupancyPercent(CIRCLE_15_CAP_ON, goldOff);
        const black = framedOccupancyPercent(
            CIRCLE_15_BLK_SHT,
            pdpStageFrame({ family: "Circle", capacityMl: 15, view: "capOff" }),
        );
        expect(gold.fillH).toBeLessThan(PDP_MAX_FILL_RATIO * 100);
        expect(black.fillH).toBeLessThan(PDP_MAX_FILL_RATIO * 100);
        expect(gold.midW).toBeLessThan(55);
    });

    it("fits a beside-cap kit without raising the bottle above the lock", () => {
        const parts = [
            { bounds: { left: 180, top: 40, right: 790, bottom: 1060 } },
            { bounds: { left: 820, top: 620, right: 980, bottom: 980 }, exploded: { dx: 0, dy: 0 }, slot: "cap" },
        ];
        const frame = pdpStageFrame({
            family: "Circle",
            capacityMl: 15,
            view: "capOff",
            parts,
        });
        expect(frame.scale).toBeLessThanOrEqual(pdpCapacityScale("Circle", 15));
        const top = parts[0].bounds.top * frame.scale + frame.y * 11;
        const bottom = parts[0].bounds.bottom * frame.scale + frame.y * 11;
        expect(top).toBeGreaterThanOrEqual(40);
        expect(bottom).toBeLessThanOrEqual(1060);
    });

    it("parks a cap to the right with its foot aligned to the glass", () => {
        const cap = {
            slot: "cap",
            bounds: { left: 400, top: 80, right: 600, bottom: 280 },
            exploded: { dx: 0, dy: 0 },
        };
        const offset = detachedCapOffset(cap, { left: 200, top: 200, right: 800, bottom: 1000 });
        expect(offset.dx).toBeGreaterThan(0);
        expect(cap.bounds.bottom + offset.dy).toBe(1000);
        const parked = withDetachedCapOffsets([
            { slot: "body", bounds: { left: 200, top: 200, right: 800, bottom: 1000 }, exploded: { dx: 0, dy: 0 } },
            cap,
        ]);
        expect(parked[1]?.exploded.dx).toBe(offset.dx);
    });

    it("does not reuse an upward exploded offset for a grounded cap-off sidecar", () => {
        const body = { slot: "body", bounds: { left: 350, top: 157, right: 650, bottom: 1060 }, exploded: { dx: 0, dy: 0 } };
        const cap = { slot: "overcap", bounds: { left: 427, top: 71, right: 575, bottom: 295 }, exploded: { dx: 320, dy: -885 } };
        const pump = { slot: "pump", bounds: { left: 430, top: 90, right: 570, bottom: 300 }, exploded: { dx: 0, dy: -1131 } };
        const original = structuredClone([body, cap, pump]);
        const parked = withDetachedCapOffsets([body, cap, pump]);
        expect(parked[1].bounds.bottom + parked[1].exploded.dy).toBe(body.bounds.bottom);
        expect(parked[1].bounds.left + parked[1].exploded.dx).toBeGreaterThan(body.bounds.right);
        expect(parked[0]).toBe(body);
        expect(parked[2]).toBe(pump);
        expect([body, cap, pump]).toEqual(original);
    });

    it("is a no-op CSS transform when scale is identity", () => {
        expect(pdpStageTransformCss({ scale: 1, x: 0, y: 0 })).toBe("none");
        expect(pdpStageTransformCss(pdpStageFrame({ family: "Circle", capacityMl: 15, view: "assembled" }))).toContain("scale(0.775)");
    });
});

describe("scale inversions and overflow", () => {
    it("shrinks Slim 50 so it no longer reads larger than Slim 100", () => {
        expect(pdpPublishedPlateScale("Slim", 50)).toBe(0.4);
        expect(pdpPublishedPlateScale("Slim", 100)).toBe(1);
        expect(78.1 * pdpPublishedPlateScale("Slim", 50)).toBeLessThan(33.7);
    });

    it("corrects Sleek 5>8 and 30>50 mid-body inversions", () => {
        expect(28.9 * pdpPublishedPlateScale("Sleek", 5)).toBeLessThan(21.7);
        expect(25.1 * pdpPublishedPlateScale("Sleek", 30)).toBeLessThan(18.6);
        expect(pdpPublishedPlateScale("Sleek", 8)).toBe(0.95);
    });

    it("separates Empire 50 from 100 and Elegant 60 frosted from 100 clear", () => {
        expect(44.4 * pdpPublishedPlateScale("Empire", 50)).toBeLessThan(44.3);
        expect(pdpPublishedPlateScale("Elegant", 60, "frosted")).toBe(0.8);
        expect(55.4 * 0.8).toBeLessThan(50.1);
        expect(pdpPublishedPlateScale("Elegant", 100, "clear")).toBe(0.95);
    });
});

it("reserves identical framing for assembled and sidecar views without using the sprayer's exploded offset", () => {
    const parts = [
        {slot:"body",bounds:{left:300,top:300,right:700,bottom:1050},exploded:{dx:0,dy:0}},
        {slot:"sprayer",bounds:{left:450,top:100,right:550,bottom:310},exploded:{dx:0,dy:-2000}},
        {slot:"overcap",bounds:{left:440,top:80,right:560,bottom:320},exploded:{dx:300,dy:-2800}},
    ];
    const on=pdpStageFrame({view:"assembled",parts});
    const parked=withDetachedCapOffsets(parts);
    const off=pdpStageFrame({view:"capOff",parts:parked});
    expect(off).toEqual(on);
    expect(on.scale).toBeGreaterThan(.9);
    for (const part of parked) {
        const delta=part.slot==="overcap"?part.exploded:{dx:0,dy:0};
        expect((part.bounds.left+delta.dx)*on.scale+on.x*10).toBeGreaterThanOrEqual(40);
        expect((part.bounds.right+delta.dx)*on.scale+on.x*10).toBeLessThanOrEqual(960);
        expect((part.bounds.top+delta.dy)*on.scale+on.y*11).toBeGreaterThanOrEqual(44);
        expect((part.bounds.bottom+delta.dy)*on.scale+on.y*11).toBeLessThanOrEqual(1056);
    }
});

it("does not zoom a paired photograph when the cap is toggled", () => {
    const common={family:"Circle",capacityMl:100,hasCapOffPlate:true};
    expect(pdpStageFrame({...common,view:"assembled"})).toEqual(pdpStageFrame({...common,view:"capOff"}));
});
