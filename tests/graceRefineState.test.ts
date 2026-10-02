import { describe, expect, it } from "vitest";
import {
    applyGraceRefinementRequest,
    inheritGraceRefineDestination,
    graceSearchRefineState,
    formatGraceRefineState,
    graceRefineDestination,
    getGraceRefineState,
    inferGraceBroadenScope,
} from "../src/lib/grace/refineState";
import { familyFinderHref } from "@/lib/products/focused-shopping";
import { readFileSync } from "node:fs";
import { buildAppliedFilterChips } from "@/lib/catalogRefineModel";
import { EMPTY_FILTERS } from "@/lib/catalogFilters";

describe("Grace Refine state", () => {
    it("keeps the catalog client synchronized when Grace replaces the URL", () => {
        const source = readFileSync("src/app/catalog/CatalogClient.tsx", "utf8");
        expect(source).toContain("Sync externally-driven URL changes (including Grace)");
        expect(source).toContain("setFilters(urlState.filters)");
        expect(source).toContain("setActiveResult(initialResult)");
    });

    it("shows an exact capacity Grace applies as a removable chip beside the capacity ranges", () => {
        const source = readFileSync("src/app/catalog/CatalogClient.tsx", "utf8");
        expect(source).toContain("buildAppliedFilterChips(filters)");
        expect(buildAppliedFilterChips({ ...EMPTY_FILTERS, capacities: ["9 ml"] })).toEqual([
            { facet: "capacities", value: "9 ml", label: "Capacity: 9 ml (0.3 oz)" },
        ]);
    });

    it("uses the focused Cylinder route without repeating family as a required choice", () => {
        expect(familyFinderHref("Cylinder", {
            application: "rollon",
            capacities: ["9 ml"],
            rollerMaterials: ["metal"],
        })).toBe("/catalog?category=Glass+Bottle&applicators=rollon&roller=metal&families=Cylinder&capacities=9+ml&sort=capacity-asc");
    });

    it("verifies Grace refinements against the catalog before reporting success", () => {
        const source = readFileSync("src/components/grace/GraceProvider.tsx", "utf8");
        expect(source).toContain("setCatalogRefinements: async");
        expect(source).toContain("const refinementVerification = await callGraceServerTool");
        expect(source).toContain("Verified ${verifiedCount} matching");
    });

    it("keeps a single-family refine on the catalogue with the family in the URL", () => {
        // /catalog/<family> redirects (since #221) onto category=Glass Bottle and
        // drops non-nav applicator sets, so Grace never routes through it.
        const state = getGraceRefineState(new URLSearchParams("families=Cylinder"));
        expect(graceRefineDestination(state)).toBe("/catalog?families=Cylinder&sort=capacity-asc");
        expect(graceRefineDestination(getGraceRefineState(new URLSearchParams("families=Boston+Round"))))
            .toBe("/catalog?families=Boston+Round&sort=capacity-asc");
    });

    it("inherits every active catalog constraint exactly", () => {
        const state = getGraceRefineState(new URLSearchParams(
            "families=Cylinder&capacities=9+ml+%280.3+oz%29&colors=Amber&threads=17-415&applicators=rollon&sort=price-asc&view=line",
        ));

        expect(state.filters).toEqual(expect.objectContaining({
            families: ["Cylinder"],
            // "9 ml (0.3 oz)" in the URL is folded to the facet label so the
            // sidebar checkbox, the chip and Grace all agree.
            capacities: ["9 ml"],
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
        expect(next.filters.capacities).toEqual(["9 ml"]);
        expect(next.filters.colors).toEqual(["Amber"]);
        expect(next.filters.search).toBe("amber cylinder");
    });

    it("turns an exact Grace capacity search into the authoritative capacity facet", () => {
        const current = getGraceRefineState(new URLSearchParams(
            "families=Cylinder&threads=17-415&applicators=rollon",
        ));
        const next = applyGraceRefinementRequest(current, {
            search: "9 ml",
        }, "Show me only 9 ml bottles");

        expect(next.filters.capacities).toEqual(["9 ml"]);
        expect(next.filters.search).toBe("");
        expect(next.filters.neckThreadSizes).toEqual(["17-415"]);
        expect(next.filters.applicators).toEqual(["rollon"]);
    });

    it("routes a Cylinder-only refinement to the V3 family shopping surface", () => {
        const state = getGraceRefineState(new URLSearchParams(
            "families=Cylinder&capacities=9+ml&threads=17-415&applicators=rollon",
        ));

        expect(graceRefineDestination(state)).toBe(
            "/catalog?applicators=rollon&families=Cylinder&capacities=9+ml&threads=17-415&sort=capacity-asc",
        );
    });

    it("keeps cross-family refinements on the master catalog", () => {
        const state = getGraceRefineState(new URLSearchParams(
            "families=Cylinder%2CElegant&capacities=9+ml",
        ));

        expect(graceRefineDestination(state)).toBe(
            "/catalog?families=Cylinder%2CElegant&capacities=9+ml&sort=capacity-asc",
        );
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


it("clears previous Specialty before applying the 6–15ml metal roll-on range", () => {
    const current = getGraceRefineState(new URLSearchParams("threads=specialty&families=Cylinder"));
    const next = applyGraceRefinementRequest(current, { capacities: ["6–15 ml"], applicators: ["rollon"], rollerMaterials: ["metal"] }, "Clear previous filters and show 6–15ml metal roll-ons");
    expect(next.filters.neckThreadSizes).toEqual([]);
    expect(next.filters.families).toEqual([]);
    expect(next.filters.capacities).toEqual(["6-15ml"]);
    expect(next.filters.rollerMaterials).toEqual(["metal"]);
    expect(graceRefineDestination(next)).toContain("roller=metal");
});


it("keeps Specialty and metal on a showProducts catalogue destination", () => {
    const state = getGraceRefineState(new URLSearchParams("threads=specialty&roller=metal&applicators=rollon"));
    const href = inheritGraceRefineDestination("/catalog?families=Cylinder&capacities=28+ml", state);
    const next = getGraceRefineState(new URL(href, "https://catalog.invalid").searchParams);
    expect(next.filters.neckThreadSizes).toEqual(["specialty"]);
    expect(next.filters.rollerMaterials).toEqual(["metal"]);
    expect(next.filters.families).toEqual(["Cylinder"]);
});

it("showProducts passes Refine through its raw search and never navigates on a zero match", () => {
    const source = readFileSync("src/components/grace/GraceProvider.tsx", "utf8");
    const block = source.slice(source.indexOf("showProducts: async"), source.indexOf("showProductPresentation:"));
    expect(block).toContain("refineState: currentRefineState");
    const empty = block.slice(block.indexOf("if (products.length === 0)"), block.indexOf("const capMatch"));
    expect(empty).not.toContain("routerRef.current.push");
    expect(empty).toContain("No verified products matched");
});


it("changes only glass colour across a Cylinder 9ml 17-415 roll-on follow-up", () => {
    const first = graceSearchRefineState(getGraceRefineState(new URLSearchParams()), "Cylinder 9ml Cobalt Blue roll-on 17-415");
    const next = graceSearchRefineState(first, "Make that Amber instead. Keep Cylinder, 9ml, roll-on and 17-415 the same");
    expect(next.filters.colors).toEqual(["Amber"]);
    expect(next.filters.families).toEqual(["Cylinder"]);
    expect(next.filters.capacities).toEqual(["9 ml"]);
    expect(next.filters.neckThreadSizes).toEqual(["17-415"]);
    expect(next.filters.applicators).toEqual(["rollon"]);
    const href = inheritGraceRefineDestination("/catalog?families=Cylinder&search=9ml&applicators=rollon", next);
    const visible = getGraceRefineState(new URL(href, "https://catalog.invalid").searchParams);
    expect(visible.filters.colors).toEqual(["Amber"]);
    expect(visible.filters.neckThreadSizes).toEqual(["17-415"]);
    expect(visible.filters.search).toBe("");
});
