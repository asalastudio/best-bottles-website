import { describe, expect, it } from "vitest";
import { kitMatchesSelectedSku, kitStageStructureIssues } from "../convex/lib/kitStageValidation";

const baseKit = {
    sku: "GBExample1",
    websiteSku: "GBExample1",
    graceSku: "GR-EX-1",
    plateSha256: "abc",
    canvas: { width: 1000, height: 1100 },
    anchors: { seatY: 200, baselineY: 1100 },
    completeness: "full" as const,
    parts: [
        {
            slot: "body",
            bounds: { left: 100, top: 200, right: 900, bottom: 1000 },
            assembled: { x: 0, y: 0 },
            image: { url: "https://example.test/body.webp", width: 1000, height: 1100 },
            derivation: "psd-layer",
        },
        {
            slot: "cap",
            bounds: { left: 400, top: 50, right: 600, bottom: 250 },
            assembled: { x: 0, y: 0 },
            image: { url: "https://example.test/cap.webp", width: 1000, height: 1100 },
        },
    ],
};

describe("kitMatchesSelectedSku", () => {
    it("matches when the selected Grace SKU equals the kit graceSku even if kit.sku is the website SKU", () => {
        expect(kitMatchesSelectedSku(baseKit, { websiteSku: null, graceSku: "GR-EX-1" })).toBe(true);
    });

    it("rejects a kit whose identities do not intersect the selected SKU", () => {
        expect(kitMatchesSelectedSku(baseKit, { websiteSku: "OTHER", graceSku: "OTHER-GR" })).toBe(false);
    });
});

describe("kitStageStructureIssues", () => {
    it("flags canvas and registration defects the configurator stage cannot paint", () => {
        const issues = kitStageStructureIssues({
            ...baseKit,
            parts: [
                {
                    ...baseKit.parts[0],
                    image: { ...baseKit.parts[0].image, width: 900, height: 1100 },
                },
                baseKit.parts[1],
            ],
        });
        expect(issues.some((issue) => issue.issue === "kit_part_canvas_mismatch")).toBe(true);
    });
});
