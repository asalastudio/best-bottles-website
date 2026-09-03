import { describe, expect, it } from "vitest";
import {
    buildGraceFinderContext,
    mergePdpContextChange,
    resolveGraceRecommendationHref,
    type PdpContextChange,
} from "@/lib/grace/pageContextEvents";

describe("Grace shopping context", () => {
    it("inherits finder context from the canonical route and query parser", () => {
        expect(buildGraceFinderContext(
            "/catalog/cylinder",
            new URLSearchParams("applicators=rollon&capacities=9+ml&roller=metal"),
        )).toEqual({
            entryMode: "family",
            family: "Cylinder",
            application: "rollon",
            capacities: ["9 ml"],
            rollerMaterials: ["metal"],
            resultUrl: "/catalog/cylinder?applicators=rollon&capacities=9+ml&roller=metal",
        });
    });

    it("merges exact selected PDP website SKU and option values without customer or chat payloads", () => {
        const change: PdpContextChange = {
            websiteSku: "W-CYL-9-ML-MBLK",
            application: "Metal Roll-On Ball",
            glass: "Clear",
            rollerMaterial: "metal",
            finish: "Matte Black",
            pageUrl: "/products/cylinder-9ml?sku=W-CYL-9-ML-MBLK",
        };

        expect(mergePdpContextChange({ pathname: "/products/cylinder-9ml" }, change)).toEqual({
            pathname: "/products/cylinder-9ml",
            pageUrl: "/products/cylinder-9ml?sku=W-CYL-9-ML-MBLK",
            pdpSelection: change,
        });
        expect(Object.keys(change)).not.toContain("messages");
        expect(Object.keys(change)).not.toContain("customer");
    });

    it("keeps broad Grace recommendations in the finder and sends exact resolved products to their PDP", () => {
        expect(resolveGraceRecommendationHref({
            finderHref: "/catalog/application/roll-on",
            exactProduct: null,
        })).toBe("/catalog/application/roll-on");
        expect(resolveGraceRecommendationHref({
            finderHref: "/catalog/application/roll-on",
            exactProduct: { slug: "cylinder-9ml-clear-metal-roll-on" },
        })).toBe("/products/cylinder-9ml-clear-metal-roll-on");
    });
});
