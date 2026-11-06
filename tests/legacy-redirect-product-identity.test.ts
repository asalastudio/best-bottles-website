import { describe, expect, it } from "vitest";
import evidence from "../docs/seo/legacy-redirect-corrections-2026-10-31.json";
import { resolveLegacyRedirect } from "../src/lib/seo/legacyRedirects";
import { routeStatusForPath } from "../src/lib/crawl/route-status";

describe("legacy product identities verified on 31 October", () => {
    it.each(evidence.rows)("$oldPath resolves to its reviewed identity", (row) => {
        expect(resolveLegacyRedirect(row.oldPath)).toBe(row.target);
        expect(resolveLegacyRedirect(`${row.oldPath.toUpperCase()}/`, new URLSearchParams("utm_source=regression"))).toBe(row.target);
        const target = new URL(row.target, "https://www.bestbottles.com");
        expect(["redirect", "not-found"]).not.toContain(routeStatusForPath(target.pathname).kind);
        if (row.disposition === "corrected-product") {
            expect(target.searchParams.get("sku")).toBe(row.targetSku);
        }
    });

    it("keeps misleading URL words from overruling the legacy product SKU", () => {
        const retained = evidence.rows.filter((row) => row.disposition === "retained-correct");
        expect(retained.map((row) => row.legacySku).sort()).toEqual([
            "GBBstnBlu15BlkDrprGlTrim", "PbClear8ozFlpWh", "PbNat16ozFlpWh",
        ]);
        for (const row of retained) expect(row.target).toBe(row.previousTarget);
    });

    it("does not substitute a black sprayer for the discontinued white tear-off closure", () => {
        expect(resolveLegacyRedirect("/product/aluminum-bottle-can-white-cap-250ml"))
            .toBe("/catalog/aluminum-bottle");
    });
});
