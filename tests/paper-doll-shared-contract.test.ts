import { describe, expect, it } from "vitest";
import {
    PAPER_DOLL_CANVAS,
    PAPER_DOLL_CANVAS_PRESET,
    PAPER_DOLL_LAYER_HIERARCHY,
    PAPER_DOLL_RELEASE_FIELDS,
    PAPER_DOLL_SLOTS,
    paperDollReleaseState,
} from "@/lib/paper-doll/contract";

describe("shared Paper Doll architecture contract", () => {
    it("keeps every family on the exact 2080×2288 production canvas", () => {
        expect(PAPER_DOLL_CANVAS).toEqual({ width: 2080, height: 2288 });
        expect(PAPER_DOLL_CANVAS_PRESET).toBe("pdp-2080x2288");
    });

    it("registers the supported slots and their customer-visible render hierarchy", () => {
        expect(PAPER_DOLL_SLOTS).toEqual([
            "body",
            "roller",
            "cap",
            "sprayer",
            "overcap",
            "pump",
            "shortcap",
        ]);
        expect(PAPER_DOLL_LAYER_HIERARCHY).toEqual({
            rollon: ["body", "roller", "cap"],
            spray: ["body", "sprayer", "overcap"],
            lotion: ["body", "pump", "overcap"],
            shortcap: ["body", "shortcap"],
        });
    });

    it("requires versioned release metadata before the layered preview can open", () => {
        expect(PAPER_DOLL_RELEASE_FIELDS).toEqual([
            "pipelineVersion",
            "assetRevision",
            "storefrontReady",
        ]);
        expect(paperDollReleaseState({
            pipelineVersion: "pd-2",
            assetRevision: "cyl-9ml-r1",
            storefrontReady: true,
        })).toEqual({ status: "ready" });
        expect(paperDollReleaseState({
            pipelineVersion: "",
            assetRevision: "",
            storefrontReady: false,
        })).toEqual({
            status: "preparing",
            missing: ["pipelineVersion", "assetRevision", "storefrontReady"],
        });
    });
});
