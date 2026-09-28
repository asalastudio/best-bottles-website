import { describe, expect, it } from "vitest";
import { pdpFallbackMedia, reviewedFallbackBody } from "../src/lib/products/pdp-redesign/fallback-media";

describe("PDP media fallbacks", () => {
    const frosted = {
        websiteSku: "GBElgFrst15SpryGlMatt",
        imageUrl: "https://cdn.shopify.com/sku-frosted.gif",
        family: "Elegant",
        capacityMl: 15,
        color: "Frosted",
        neckThreadSize: "13-415",
    };

    it("reuses the reviewed bare bottle for the exact mould and glass", () => {
        expect(reviewedFallbackBody("elegant-15ml-frosted-13-415-finemist", frosted))
            .toBe("/images/bottle-builder/bodies/elegant-15-frosted-13-415.webp");
        expect(reviewedFallbackBody("elegant-15ml-frosted-13-415-finemist", { ...frosted, neckThreadSize: "17-415" }))
            .toBeNull();
    });

    it("keeps only exact variant media and leaves the raw body as last resort", () => {
        const result = pdpFallbackMedia({
            groupSlug: "elegant-15ml-frosted-13-415-finemist",
            variant: frosted,
            plateImageUrl: "https://blob.example.com/exact-plate.webp",
        });
        expect(result.images).toEqual([
            "https://blob.example.com/exact-plate.webp",
            "https://cdn.shopify.com/sku-frosted.gif",
        ]);
        expect(result.bodyImageUrl).toBe("/images/bottle-builder/bodies/elegant-15-frosted-13-415.webp");
    });

    it("deduplicates exact SKU sources", () => {
        const result = pdpFallbackMedia({
            groupSlug: "elegant-15ml-frosted-13-415-finemist",
            variant: frosted,
            plateImageUrl: frosted.imageUrl,
        });
        expect(result.images).toEqual([frosted.imageUrl]);
    });

    it("recovers the exact blue jar from its local bone hero when the CDN photo fails", () => {
        const result = pdpFallbackMedia({
            groupSlug: "cream-jar-3ml-cobalt-blue",
            variant: { websiteSku: "CJBlu3", imageUrl: "https://cdn.shopify.com/broken.gif",
                family: "Cream Jar", capacityMl: 3, color: "Cobalt Blue", neckThreadSize: "20mm" },
            plateImageUrl: null,
        });
        expect(result.images.at(-1)).toBe("/images/catalog/bone-review/CJBlu3.7c0118ae3871.png");
    });
});
