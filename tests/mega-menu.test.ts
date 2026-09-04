import { describe, expect, it } from "vitest";
import { APPLICATOR_NAV, CAPACITY_RANGES, catalogHref } from "@/lib/catalogFilters";
import { MEGA_MENU_BOTTLE_FAMILIES, MEGA_MENU_PANELS } from "@/lib/megaMenu";
import { applicationFinderHref, familyFinderHref } from "@/lib/products/focused-shopping";

function panelHrefs(id: keyof typeof MEGA_MENU_PANELS): string[] {
    const panel = MEGA_MENU_PANELS[id];
    return [
        ...panel.columns.flatMap((column) => column.links.map((link) => link.href)),
        panel.featured.href,
        ...panel.footerLinks.map((link) => link.href),
    ];
}

function allMegaHrefs(): string[] {
    return (Object.keys(MEGA_MENU_PANELS) as Array<keyof typeof MEGA_MENU_PANELS>)
        .flatMap((id) => panelHrefs(id));
}

describe("mega menu destinations", () => {
    it("sends bottle applicator links into the application finder, not catalog multi-select", () => {
        const links = MEGA_MENU_PANELS.bottles.columns[0]?.links ?? [];
        expect(links.map((link) => [link.label, link.href])).toEqual(
            APPLICATOR_NAV.map((nav) => [nav.label, applicationFinderHref(nav.value)]),
        );
    });

    it("uses catalog family order and family finder hrefs", () => {
        const links = MEGA_MENU_PANELS.bottles.columns[1]?.links ?? [];
        expect(links.slice(0, MEGA_MENU_BOTTLE_FAMILIES.length).map((link) => [link.label, link.href]))
            .toEqual(MEGA_MENU_BOTTLE_FAMILIES.map((family) => [family, familyFinderHref(family)]));
        expect(links.at(-1)).toEqual({
            label: "View all families",
            href: catalogHref({ category: "Glass Bottle" }),
        });
        expect(familyFinderHref("Cylinder")).toBe("/catalog/cylinder");
    });

    it("uses live capacity range tokens instead of hardcoded milliliter lists", () => {
        const links = MEGA_MENU_PANELS.bottles.columns[2]?.links ?? [];
        expect(links.map((link) => link.href)).toEqual(
            CAPACITY_RANGES.map((range) => catalogHref({
                category: "Glass Bottle",
                capacities: [range.value],
            })),
        );
        expect(links[0]?.href).toContain("capacities=miniature");
        expect(links.some((link) => link.href.includes("0.03"))).toBe(false);
    });

    it("filters closures by component type and pairs leftover help with Build a Bottle", () => {
        expect(panelHrefs("closures")).toEqual(expect.arrayContaining([
            catalogHref({ category: "Component", componentType: "Sprayer" }),
            catalogHref({ category: "Component", componentType: "Dropper" }),
            catalogHref({ category: "Component", componentType: "Lotion Pump" }),
            catalogHref({ category: "Component", componentType: "Roll-On" }),
            catalogHref({ category: "Component", componentType: "Reducer" }),
            catalogHref({ category: "Component", componentType: "Cap" }),
            "/matrix",
            "/resources",
            applicationFinderHref("rollon"),
        ]));
        expect(MEGA_MENU_PANELS.closures.featured.href).toBe("/matrix");
    });

    it("uses family and category facets for specialty instead of search queries", () => {
        expect(panelHrefs("specialty")).toEqual(expect.arrayContaining([
            catalogHref({ families: ["Atomizer"] }),
            catalogHref({ category: "Aluminum Bottle" }),
            catalogHref({ families: ["Gift Bag"] }),
            catalogHref({ families: ["Gift Box"] }),
            catalogHref({ category: "Packaging" }),
            catalogHref({ families: ["Decorative"] }),
        ]));
    });

    it("never dumps customers into free-text search or stale product counts", () => {
        const hrefs = allMegaHrefs();
        const labels = Object.values(MEGA_MENU_PANELS).flatMap((panel) => [
            ...panel.columns.flatMap((column) => column.links.map((link) => link.label)),
            ...panel.footerLinks.map((link) => link.label),
        ]);
        expect(hrefs.some((href) => href.includes("search="))).toBe(false);
        expect(labels.some((label) => /\d{2,}/.test(label) && /276|Browse All/.test(label))).toBe(false);
        expect(labels).not.toContain("Browse All 276 Products");
        expect(hrefs).toContain("/matrix");
    });
});
