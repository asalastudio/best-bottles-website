import { describe, expect, it } from "vitest";
import {
    applyGraceRefinementRequest,
    formatGraceRefineState,
    graceRefineDestination,
    getGraceRefineState,
    inferGraceBroadenScope,
} from "../src/lib/grace/refineState";
import { readFileSync } from "node:fs";

describe("Grace Refine state", () => {
    it("keeps the catalog client synchronized when Grace replaces the URL", () => {
        const source = readFileSync("src/app/catalog/CatalogClient.tsx", "utf8");
        expect(source).toContain("Sync externally-driven URL changes (including Grace)");
        expect(source).toContain("setFilters(urlState.filters)");
        expect(source).toContain("setActiveResult(initialResult)");
    });

    it("exposes exact capacities in the canonical Refine UI", () => {
        const source = readFileSync("src/app/catalog/CatalogClient.tsx", "utf8");
        expect(source).toContain("Exact capacity");
        expect(source).toContain("toggleArrayFilter(\"capacities\", capacity.label)");
    });

    it("uses the shared accordion Refine presentation on the Cylinder family page", () => {
        const source = readFileSync("src/app/catalog/cylinder/CylinderFamilyPageClient.tsx", "utf8");
        expect(source).toContain('import RefineSection from "@/components/catalog/RefineSection"');
        expect(source).toContain('label: "Capacity", values: options.capacities, defaultOpen: true');
        expect(source).toContain("activeCount={state[group.dimension].length}");
    });

    it("verifies Grace refinements against the catalog before reporting success", () => {
        const source = readFileSync("src/components/grace/GraceProvider.tsx", "utf8");
        expect(source).toContain("setCatalogRefinements: async");
        expect(source).toContain("const refinementVerification = await callGraceServerTool");
        expect(source).toContain("Verified ${verifiedCount} matching");
    });

    it("bridges Cylinder master-catalog results to the V3 family builder", () => {
        const source = readFileSync("src/app/catalog/CatalogClient.tsx", "utf8");
        expect(source).toContain('href="/catalog/cylinder"');
        expect(source).toContain("Open the Cylinder family & builder");
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
            "/catalog/cylinder?applicators=rollon&families=Cylinder&capacities=9+ml&threads=17-415#ready-made",
        );
    });

    it("keeps cross-family refinements on the master catalog", () => {
        const state = getGraceRefineState(new URLSearchParams(
            "families=Cylinder%2CElegant&capacities=9+ml",
        ));

        expect(graceRefineDestination(state)).toBe(
            "/catalog?families=Cylinder%2CElegant&capacities=9+ml",
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
