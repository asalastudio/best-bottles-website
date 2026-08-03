import { describe, expect, it } from "vitest";
import {
    applyGraceRefinementRequest,
    formatGraceRefineState,
    getGraceRefineState,
    inferGraceBroadenScope,
} from "../src/lib/grace/refineState";

describe("Grace Refine state", () => {
    it("inherits every active catalog constraint exactly", () => {
        const state = getGraceRefineState(new URLSearchParams(
            "families=Cylinder&capacities=9+ml+%280.3+oz%29&colors=Amber&threads=17-415&applicators=rollon&sort=price-asc&view=line",
        ));

        expect(state.filters).toEqual(expect.objectContaining({
            families: ["Cylinder"],
            capacities: ["9 ml (0.3 oz)"],
            colors: ["Amber"],
            neckThreadSizes: ["17-415"],
            applicators: ["rollon"],
        }));
        expect(state.sort).toBe("price-asc");
        expect(state.view).toBe("line");
    });

    it("preserves 17-415 when Grace adds a color request", () => {
        const current = getGraceRefineState(new URLSearchParams(
            "families=Cylinder&capacities=9+ml+%280.3+oz%29&threads=17-415",
        ));
        const next = applyGraceRefinementRequest(current, {
            search: "amber cylinder",
            colors: ["Amber"],
            neckThreadSizes: ["13-415"],
        }, "Show me amber options");

        expect(next.filters.neckThreadSizes).toEqual(["17-415"]);
        expect(next.filters.capacities).toEqual(["9 ml (0.3 oz)"]);
        expect(next.filters.colors).toEqual(["Amber"]);
        expect(next.filters.search).toBe("amber cylinder");
    });

    it("only removes the dimension the customer explicitly broadens", () => {
        const current = getGraceRefineState(new URLSearchParams(
            "families=Cylinder&capacities=9+ml+%280.3+oz%29&colors=Amber&threads=17-415",
        ));
        const next = applyGraceRefinementRequest(current, {}, "Show me other sizes");

        expect(next.filters.capacities).toEqual([]);
        expect(next.filters.families).toEqual(["Cylinder"]);
        expect(next.filters.colors).toEqual(["Amber"]);
        expect(next.filters.neckThreadSizes).toEqual(["17-415"]);
    });

    it("requires explicit language before broadening the whole search", () => {
        expect(inferGraceBroadenScope("What other colors are available?")).toBe("colors");
        expect(inferGraceBroadenScope("Broaden this search")).toBe("all");
        expect(inferGraceBroadenScope("Show amber cylinders")).toBeNull();
    });

    it("formats all active constraints for the Realtime context", () => {
        const state = getGraceRefineState(new URLSearchParams(
            "families=Cylinder&threads=17-415&colors=Amber",
        ));
        const context = formatGraceRefineState(state);

        expect(context).toContain("Family: Cylinder");
        expect(context).toContain("Glass color: Amber");
        expect(context).toContain("Neck thread: 17-415");
        expect(context).toContain("Do not remove or replace");
    });
});
