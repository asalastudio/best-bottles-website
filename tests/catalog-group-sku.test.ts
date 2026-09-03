import { describe, expect, it } from "vitest";
import {
    catalogGroupSkuLabel,
    resolveCatalogGroupSku,
} from "../src/lib/catalogSearchFallback";

describe("resolveCatalogGroupSku", () => {
    it("uses stored primary SKUs when they are present", () => {
        const resolved = resolveCatalogGroupSku(
            "group-1",
            [{ groupId: "group-1", websiteSku: "GB-CYL-CLR-15ML", graceSku: "GBCyl15" }],
            [{ groupId: "group-1", variants: [{ websiteSku: "OTHER", graceSku: "OTHER" }] }],
        );

        expect(resolved).toEqual({
            groupId: "group-1",
            websiteSku: "GB-CYL-CLR-15ML",
            graceSku: "GBCyl15",
        });
        expect(catalogGroupSkuLabel(resolved)).toBe("GB-CYL-CLR-15ML");
    });

    it("falls back to the first variant SKU when primary fields are null", () => {
        const resolved = resolveCatalogGroupSku(
            "group-1",
            [{ groupId: "group-1", websiteSku: null, graceSku: null }],
            [{
                groupId: "group-1",
                variants: [
                    { websiteSku: "GB-CYL-CLR-30ML", graceSku: "GBCyl30" },
                    { websiteSku: "GB-CYL-AMB-30ML", graceSku: "GBCyl30A" },
                ],
            }],
        );

        expect(resolved.websiteSku).toBe("GB-CYL-CLR-30ML");
        expect(resolved.graceSku).toBe("GBCyl30");
        expect(catalogGroupSkuLabel(resolved)).toBe("GB-CYL-CLR-30ML");
    });

    it("skips empty variant SKUs and uses the next populated variant", () => {
        const resolved = resolveCatalogGroupSku(
            "group-1",
            [],
            [{
                groupId: "group-1",
                variants: [
                    { websiteSku: null, graceSku: null },
                    { websiteSku: null, graceSku: "GBCyl50" },
                ],
            }],
        );

        expect(catalogGroupSkuLabel(resolved)).toBe("GBCyl50");
    });

    it("returns a dash when neither primary nor variant SKUs exist", () => {
        expect(catalogGroupSkuLabel(resolveCatalogGroupSku("missing", [], []))).toBe("—");
    });
});
