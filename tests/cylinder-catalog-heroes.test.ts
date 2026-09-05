import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import heroes from "@/lib/products/cylinder-catalog-heroes.json";
import lineage from "../docs/reviews/cylinder-hover-ui-lineage-2026-09-05.json";
import { getCylinderCatalogHero, getCylinderHeroProductHref, getCylinderHeroStyle } from "@/lib/products/cylinder-catalog-heroes";

describe("approved Cylinder hero/hover delivery", () => {
    it("covers exactly 52 populated groups and 104 distinct states", () => {
        expect(heroes).toHaveLength(52);
        expect(new Set(heroes.map(h => h.groupSlug)).size).toBe(52);
        expect(new Set(heroes.flatMap(h => [h.url, h.hoverUrl])).size).toBe(104);
        expect(getCylinderCatalogHero("cylinder-5.5ml-clear-13-415", [])).toBeNull();
    });

    it.each(heroes)("ships locked assets and reviewed framing for $websiteSku", hero => {
        const evidence = lineage.rows.find(r => r.websiteSku === hero.websiteSku)!;
        for (const [i, url] of [hero.url, hero.hoverUrl].entries()) {
            expect(url).toMatch(/^\/images\/catalog\/cylinder-hover\/[a-z0-9.-]+\.webp$/);
            const bytes = readFileSync(`public${url}`);
            expect(createHash("sha256").update(bytes).digest("hex")).toBe(evidence.states[i].sha256);
            expect(bytes.subarray(8, 12).toString()).toBe("WEBP");
            expect(i ? hero.hoverFraming : hero.framing).toEqual(evidence.states[i].transform);
        }
        expect([hero.width, hero.height]).toEqual([2080, 2288]);
        expect(getCylinderCatalogHero(hero.groupSlug, [{ websiteSku: hero.websiteSku }])).toEqual(hero);
        expect(getCylinderHeroStyle(hero).transformOrigin).toBe("0 0");
    });

    it("never substitutes a pictured finish excluded by the active filter", () => {
        const hero = heroes[0];
        expect(getCylinderCatalogHero(hero.groupSlug, [])).toBeNull();
        expect(getCylinderCatalogHero(hero.groupSlug, [{ websiteSku: "different-finish" }])).toBeNull();
        expect(getCylinderCatalogHero("different-family", [{ websiteSku: hero.websiteSku }])).toBeNull();
        expect(getCylinderCatalogHero(hero.groupSlug, [{ websiteSku: hero.websiteSku.toLowerCase() }])).toBeNull();
    });

    it("retains the verified 30 mL route alias only for the exact pictured SKU", () => {
        expect(getCylinderCatalogHero("cylinder-30ml-clear-18-415-finemist", [{ websiteSku: "GBSpry1ozGl" }])?.websiteSku).toBe("GBSpry1ozGl");
        expect(getCylinderCatalogHero("cylinder-30ml-clear-18-415-finemist", [{ websiteSku: "GBSpry1ozSl" }])).toBeNull();
    });

    it("opens the pictured assembly without losing finder context", () => {
        const href = getCylinderHeroProductHref(heroes[0], "/products/bottle?applicator=spray&from=%2Fcatalog%2Fcylinder#details");
        const url = new URL(href, "https://bestbottles.com");
        expect(url.searchParams.get("sku")).toBe(heroes[0].websiteSku);
        expect(url.searchParams.get("from")).toBe("/catalog/cylinder");
        expect(url.searchParams.get("applicator")).toBe("spray");
        expect(url.hash).toBe("#details");
        expect(getCylinderHeroProductHref(null, "/products/other")).toBe("/products/other");
    });

    it("keeps the approved plastic scale and all vintage assemblies attached", () => {
        expect(heroes.find(h=>h.websiteSku==="PbClear4ozFlpWh")!.framing.scale).toBe(0.730013);
        expect(heroes.find(h=>h.websiteSku==="PbClear8ozFlpWh")!.framing.scale).toBe(0.812616);
        expect(heroes.find(h=>h.websiteSku==="PbNat16ozFlpWh")!.framing.scale).toBe(1.1);
        for (const hero of heroes.filter(h=>h.websiteSku.includes("AnSp"))) expect(hero.interaction).toBe("fill-only");
    });
});
