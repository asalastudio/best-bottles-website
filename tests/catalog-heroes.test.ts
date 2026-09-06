import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import heroes from "@/lib/products/catalog-heroes.json";
import evidence from "../docs/reviews/catalog-hero-integration.json";
import { getCatalogHero, getProductHero, getCatalogHeroProductHref, getCatalogHeroStyle } from "@/lib/products/catalog-heroes";

describe("catalog empty hero assignments", () => {
    it("ships only ready exact SKUs and preserves held revisions", () => {
        expect(heroes).toHaveLength(325);
        expect(new Set(heroes.map(h => h.websiteSku)).size).toBe(325);
        for (const row of evidence.held) expect(getProductHero(row.sku)).toBeNull();
        expect(getProductHero("GBAtom10Gl")?.presentation).toBe("Capped + uncovered + loose cap");
        expect(getProductHero("gbatom10gl")).toBeNull();
    });
    it.each(heroes)("delivers registered static artwork for $websiteSku", hero => {
        const row = evidence.rows.find(r => r.websiteSku === hero.websiteSku)!;
        expect(createHash("sha256").update(readFileSync(`public${hero.url}`)).digest("hex")).toBe(row.assetSha256);
        expect(hero.url).not.toMatch(/filled|hover/);
        expect(getCatalogHero(hero.groupSlug, [{ websiteSku: hero.websiteSku }])).toEqual(hero);
        expect(getCatalogHero("wrong-group", [{ websiteSku: hero.websiteSku }])).toBeNull();
        expect(getCatalogHeroStyle(hero).transform).toContain(`scale(${hero.framing.scale})`);
    });
    it("never borrows a finish removed by a filter", () => {
        const h = heroes[0];
        expect(getCatalogHero(h.groupSlug, [])).toBeNull();
        expect(getCatalogHero(h.groupSlug, [{ websiteSku: "unknown" }])).toBeNull();
    });
    it("links the pictured SKU and preserves browsing context", () => {
        const h = heroes[0];
        const url = new URL(getCatalogHeroProductHref(h, `/products/${h.groupSlug}?from=%2Fcatalog%2Felegant&applicator=spray#details`), "https://bestbottles.com");
        expect(url.searchParams.get("sku")).toBe(h.websiteSku);
        expect(url.searchParams.get("from")).toBe("/catalog/elegant");
        expect(url.hash).toBe("#details");
    });
});
