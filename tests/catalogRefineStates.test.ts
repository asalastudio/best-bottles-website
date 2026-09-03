import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FocusedFinderResults from "@/components/catalog/FocusedFinderResults";
import { buildCatalogSearchArgs } from "@/lib/catalogSearchClient";
import { CYLINDER_CATALOG_SURFACE } from "@/lib/catalogSurface";
import { familyFinderHref } from "@/lib/products/focused-shopping";
import type { GuidedFinderFamily } from "@/lib/products/guided-finder";

describe("catalog Refine states", () => {
    const master = readFileSync(join(process.cwd(), "src/app/catalog/CatalogClient.tsx"), "utf8");
    const cylinderFamilies: GuidedFinderFamily[] = [{
        family: "Cylinder",
        exactProducts: [{
            id: "cylinder-9ml-rollon-variant",
            groupId: "cylinder-9ml-rollon",
            displayName: "9 ml Clear Cylinder Roll-On Bottle",
            imageUrl: null,
            family: "Cylinder",
            capacity: "9 ml",
            color: "Clear",
            application: "Roll-On",
            rollerMaterial: "metal",
            neckFinish: "17-415",
            stockStatus: "In Stock",
            availability: "in-stock",
            caseQuantity: 144,
            webPrice1pc: 0.72,
            startingUnitPrice: 0.72,
            shopifyVariantId: "gid://shopify/ProductVariant/1",
            shopifySellable: true,
            checkoutReady: true,
            href: "/products/cylinder-9ml-rollon",
        }],
    }];

    it("keeps the master typed client and fixes every Cylinder request to its family surface", () => {
        expect(master).toContain("fetchCatalogSearch");
        expect(master).toContain("MASTER_CATALOG_SURFACE");
        expect(buildCatalogSearchArgs({
            surface: CYLINDER_CATALOG_SURFACE,
            filters: { applicators: ["rollon"] },
            sort: "capacity-asc",
            view: "visual",
            limit: 240,
        }).filters).toMatchObject({ families: ["Cylinder"], applicators: ["rollon"] });
    });

    it("keeps prior results marked busy while an authoritative request loads", () => {
        expect(master).toContain("aria-busy={isFetchingCatalog}");
        const cylinder = renderToStaticMarkup(createElement(FocusedFinderResults, {
            families: cylinderFamilies,
            finderUrl: "/catalog/cylinder?applicators=rollon",
            resultCount: 1,
            isUpdating: true,
        }));
        expect(cylinder).toContain('aria-busy="true"');
        expect(cylinder).toContain("9 ml Clear Cylinder Roll-On Bottle");
    });

    it("names active constraints in empty-state recovery", () => {
        expect(master).toContain("activeConstraintSummary");
        const cylinder = renderToStaticMarkup(createElement(FocusedFinderResults, {
            families: [],
            finderUrl: "/catalog/cylinder?capacities=9+ml",
            resultCount: 0,
            recovery: { filterLabel: "9 ml capacity", onRemove: () => undefined },
        }));
        expect(cylinder).toContain("The 9 ml capacity filter conflicts");
        expect(cylinder).toContain("Remove 9 ml capacity filter");
    });

    it("does not claim success on query errors and provides an actual retry", () => {
        expect(master).toContain("Unable to update these results");
        expect(master).toContain("catalogRefineIncident");
        expect(master).toContain("setRetryNonce");
    });

    it("keeps master history commits and emits canonical Cylinder finder URLs", () => {
        expect(master).toContain("router.push(`${pathname}${qs ? `?${qs}` : \"\"}`");
        expect(familyFinderHref("Cylinder", {
            application: "rollon",
            capacities: ["9 ml"],
            rollerMaterials: ["metal"],
        })).toBe("/catalog/cylinder?applicators=rollon&roller=metal&capacities=9+ml");
    });
});
