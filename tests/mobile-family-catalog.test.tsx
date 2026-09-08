// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import MobileFamilyCatalog from "@/components/catalog/MobileFamilyCatalog";
import { EMPTY_FILTERS, type CatalogFilters } from "@/lib/catalogFilters";

vi.mock("@/components/catalog/FocusedProductCard", () => ({
  default: () => null,
}));
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
const onFilters = vi.fn();
const filters: CatalogFilters = {
  ...EMPTY_FILTERS,
  families: ["Cylinder"],
  colors: ["Clear"],
  capacities: ["9 ml"],
  applicators: ["rollon"],
  rollerMaterials: ["metal"],
  search: "bottle",
  priceMax: 10,
};
beforeEach(() => {
  onFilters.mockClear();
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root.render(
      createElement(MobileFamilyCatalog, {
        family: "Cylinder",
        families: [],
        count: 0,
        finderUrl: "/catalog/cylinder",
        filters,
        facets: {
          categories: {},
          collections: {},
          applicators: { rollon: 5, finemist: 2 },
          rollerMaterials: { metal: 2, plastic: 3 },
          families: { Cylinder: 7 },
          colors: { Clear: 3, Amber: 4 },
          capacities: { "9 ml": { label: "9 ml", ml: 9, count: 7 } },
          neckThreadSizes: { "13-415": 4 },
          componentTypes: {},
          priceRange: { min: 0, max: 10 },
        },
        onFilters,
        onProductOpen: vi.fn(),
        updating: false,
        error: null,
        story: "Family story",
        hero: "/example.png",
        heroAlt: "Cylinder",
        onHelp: vi.fn(),
      }),
    ),
  );
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
function click(selector: string) {
  act(() => (host.querySelector(selector) as HTMLElement).click());
}
function select(label: string, value: string) {
  act(() => {
    const el = host.querySelector(
      `select[aria-label="${label}"]`,
    ) as HTMLSelectElement;
    el.value = value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
function button(text: string) {
  act(() =>
    [...host.querySelectorAll("dialog button")]
      .find((e) => e.textContent === text)!
      .dispatchEvent(new MouseEvent("click", { bubbles: true })),
  );
}
it("cancels a draft without changing the catalog and restores the trigger focus", () => {
  click('[aria-haspopup="dialog"]');
  select("Fitment", "spray");
  click('[aria-label="Close filters"]');
  expect(onFilters).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(
    host.querySelector('[aria-haspopup="dialog"]'),
  );
});
it("applies refinements together while preserving glass, price, search and bottle scope", () => {
  click('[aria-haspopup="dialog"]');
  select("Roller material", "plastic");
  button("Show products");
  expect(onFilters).toHaveBeenCalledExactlyOnceWith({
    ...filters,
    rollerMaterials: ["plastic"],
  });
});
it("clears roller material when a different mechanism is selected", () => {
  click('[aria-haspopup="dialog"]');
  select("Fitment", "spray");
  button("Show products");
  expect(onFilters.mock.calls[0][0]).toMatchObject({
    colors: ["Clear"],
    capacities: ["9 ml"],
    rollerMaterials: [],
    families: ["Cylinder"],
  });
});
it("clearing filters keeps the family destination and does not apply until confirmed", () => {
  click('[aria-haspopup="dialog"]');
  button("Clear filters");
  expect(onFilters).not.toHaveBeenCalled();
  button("Show products");
  expect(onFilters).toHaveBeenCalledExactlyOnceWith({
    ...EMPTY_FILTERS,
    families: ["Cylinder"],
  });
});
it("removing size preserves all other refinements and keeps the builder family link", () => {
  click('[aria-label="Remove 9 ml filter"]');
  expect(onFilters).toHaveBeenCalledExactlyOnceWith({
    ...filters,
    capacities: [],
  });
  expect(host.querySelector('a[href^="/matrix"]')?.getAttribute("href")).toBe(
    "/matrix?family=Cylinder&from=finder",
  );
});
