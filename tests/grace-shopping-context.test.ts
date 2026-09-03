import { readFileSync } from "node:fs";
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

        expect(mergePdpContextChange({
            pathname: "/products/cylinder-9ml",
            pageUrl: "/products/cylinder-9ml?sku=W-CYL-9-ML-MBLK",
        }, change)).toEqual({
            pathname: "/products/cylinder-9ml",
            pageUrl: "/products/cylinder-9ml?sku=W-CYL-9-ML-MBLK",
            pdpSelection: change,
        });
        expect(Object.keys(change)).not.toContain("messages");
        expect(Object.keys(change)).not.toContain("customer");
    });

    it("keeps the current route and query authoritative over stale or prefix-related PDP events", () => {
        const current = {
            pathname: "/products/cylinder-9ml",
            pageUrl: "/products/cylinder-9ml?sku=CURRENT",
        };
        const staleQuery: PdpContextChange = {
            websiteSku: "OLD",
            pageUrl: "/products/cylinder-9ml?sku=OLD",
        };
        const prefixRelated: PdpContextChange = {
            websiteSku: "PREFIX",
            pageUrl: "/products/cylinder-9ml-deluxe?sku=PREFIX",
        };

        expect(mergePdpContextChange(current, staleQuery)).toEqual(current);
        expect(mergePdpContextChange(current, prefixRelated)).toEqual(current);
    });

    it("redelivers PDP context when an unchanged selection receives a current URL", () => {
        const productClient = readFileSync("src/app/products/[slug]/ProductDetailClient.tsx", "utf8");
        const provider = readFileSync("src/components/grace/GraceProvider.tsx", "utf8");

        expect(productClient).toContain("pageUrl: change.pageUrl");
        expect(productClient).toContain("[group?.color, selectedPdpPageUrl, selectedVariant]");
        expect(provider).toContain("const pageUrlRef = useRef(pageUrl);\n    pageUrlRef.current = pageUrl;");
        expect(provider).toContain("current?.pageUrl === pageUrl ? current : null");
        expect(provider).not.toContain("pdpContextChange.pageUrl.startsWith(pathname)");
    });

    it("keeps broad Grace recommendations in the finder and sends exact resolved products to their PDP", () => {
        const provider = readFileSync("src/components/grace/GraceProvider.tsx", "utf8");
        expect(resolveGraceRecommendationHref({
            finderHref: "/catalog/application/roll-on",
            exactProduct: null,
        })).toBe("/catalog/application/roll-on");
        expect(resolveGraceRecommendationHref({
            finderHref: "/catalog/application/roll-on",
            exactProduct: { slug: "cylinder-9ml-clear-metal-roll-on", websiteSku: "WEB-9ML-BLK" },
        })).toBe("/products/cylinder-9ml-clear-metal-roll-on?sku=WEB-9ML-BLK");
        expect(resolveGraceRecommendationHref({
            finderHref: "/catalog",
            exactProduct: { slug: "cylinder-9ml-17-415", graceSku: "GB-CYL-9-17-415" },
        })).toBe("/products/cylinder-9ml-clear-17-415-rollon?sku=GB-CYL-9-17-415");
        expect(provider).toContain("exactProduct: directProduct");
        expect(provider).toContain("const canonicalSlug = getCanonicalProductSlug(rawSlug)");
    });
});
