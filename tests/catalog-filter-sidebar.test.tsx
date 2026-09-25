// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import CatalogFilterSidebar from "@/components/catalog/CatalogFilterSidebar";
import { EMPTY_FILTERS, type CatalogFilters } from "@/lib/catalogFilters";
import type { CatalogSearchResultShape } from "@/lib/catalogSearchFallback";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const facets: CatalogSearchResultShape["facets"] = {
    categories: { "Glass Bottle": 12 },
    collections: {},
    applicators: { rollon: 7, finemist: 3 },
    rollerMaterials: { metal: 7, plastic: 0 },
    families: { Cylinder: 9, Elegant: 3, "Cream Jar": 2, Atomizer: 4 },
    colors: { Clear: 8, Amber: 4 },
    capacities: {
        "5 ml": { label: "5 ml", ml: 5, count: 2 },
        "9 ml": { label: "9 ml", ml: 9, count: 6 },
        "15.5 ml": { label: "15.5 ml", ml: 15.5, count: 1 },
        "30 ml": { label: "30 ml", ml: 30, count: 3 },
    },
    neckThreadSizes: { "17-415": 6, "13-415": 2, "Press-Fit": 1 },
    componentTypes: {},
    priceRange: { min: 0.3, max: 4 },
    shopCollections: { "roll-on-bottles": 7, "dropper-bottles": 0 },
};

let root: Root;
let el: HTMLDivElement;
function render(filters: Partial<CatalogFilters> = {}, onFilterChange = vi.fn(), onAskGrace = vi.fn()) {
    el = document.createElement("div"); document.body.append(el); root = createRoot(el);
    act(() => root.render(<CatalogFilterSidebar facets={facets} filters={{ ...EMPTY_FILTERS, ...filters }}
        onFilterChange={onFilterChange} onAskGrace={onAskGrace} />));
    return { onFilterChange, onAskGrace };
}
const section = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`)!;
const rows = (testId: string) => [...section(testId).querySelectorAll<HTMLLabelElement>('[data-testid="catalog-filter-option"]')];
const click = (target: Element) => act(() => { target.dispatchEvent(new MouseEvent("click", { bubbles: true })); });

afterEach(() => { act(() => root?.unmount()); el?.remove(); });

describe("catalog filter sidebar (design 8a)", () => {
    it("renders the seven sections in the manifest's order, the last two collapsed", () => {
        render();
        const order = [...el.querySelectorAll("section")].map((node) => node.dataset.testid);
        expect(order).toEqual([
            "catalog-filter-family", "catalog-filter-capacity", "catalog-filter-applicator", "catalog-filter-neck",
            "catalog-filter-glass", "catalog-filter-collection", "catalog-filter-price",
        ]);
        const expanded = [...el.querySelectorAll("section h3 button")].map((button) => button.getAttribute("aria-expanded"));
        expect(expanded).toEqual(["true", "true", "true", "true", "true", "false", "false"]);
    });

    it("lists glass families only, sorted by count, and keeps empty options visible but disabled", () => {
        render();
        const families = rows("catalog-filter-family").map((row) => row.textContent);
        expect(families.slice(0, 2)).toEqual(["Cylinder9", "Elegant3"]);
        expect(families.join(" ")).not.toMatch(/Cream Jar|Atomizer/);
        const empty = rows("catalog-filter-family").find((row) => row.textContent?.startsWith("Circle"))!;
        expect(empty.querySelector("input")!.disabled).toBe(true);
        expect(section("catalog-filter-family").textContent).toContain("Show all 22");
    });

    it("counts capacity ranges from the exact sizes, decimals included", () => {
        render();
        expect(rows("catalog-filter-capacity").map((row) => row.textContent)).toEqual([
            "1–5 ml≤0.17 oz2", "6–15 ml0.2–0.5 oz6", "16–30 ml0.5–1 oz4",
            "31–60 ml1–2 oz0", "61–100 ml2–3.4 oz0", "101+ ml3.4+ oz0",
        ]);
    });

    it("toggles a value into the filter it belongs to", () => {
        const { onFilterChange } = render({ applicators: ["finemist"] });
        click(rows("catalog-filter-applicator")[0].querySelector("input")!);
        expect(onFilterChange).toHaveBeenLastCalledWith({ applicators: ["finemist", "rollon"] });
        expect(section("catalog-filter-applicator").querySelector("h3")!.textContent).toContain("(1)");
    });

    it("folds non-standard necks into Specialty and offers Grace for thread questions", () => {
        const { onAskGrace } = render();
        click(section("catalog-filter-neck").querySelector("button[aria-expanded='false']") ?? el);
        expect(section("catalog-filter-neck").textContent).toContain("Not sure which thread? Ask Grace");
        click(el.querySelector('[data-testid="catalog-filter-ask-grace"]')!);
        expect(onAskGrace).toHaveBeenCalledTimes(1);
    });

    it("counts shop collections and sets the shop= collection", () => {
        const { onFilterChange } = render();
        const collection = rows("catalog-filter-collection");
        expect(collection[0].textContent).toBe("Roll-On Bottles7");
        click(collection[0].querySelector("input")!);
        expect(onFilterChange).toHaveBeenLastCalledWith({ shopCollection: "roll-on-bottles" });
    });

    it("offers the glass swatches with photos and a green fallback", () => {
        render();
        const swatches = [...el.querySelectorAll<HTMLButtonElement>('[data-testid="catalog-filter-glass-swatch"]')];
        expect(swatches.map((swatch) => swatch.textContent)).toEqual(["Clear8", "Frosted0", "Cobalt0", "Amber4", "Green0", "Swirl0"]);
        expect(swatches[1].disabled).toBe(true);
        expect((swatches[0].firstElementChild as HTMLElement).style.backgroundImage).toContain("/assets/glass-swatches/clear");
        expect((swatches[4].firstElementChild as HTMLElement).style.background).toContain("rgb(107, 154, 107)");
    });
});
