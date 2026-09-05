import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import heroes from "@/lib/products/cylinder-catalog-heroes.json";
import lineage from "../docs/reviews/cylinder-catalog-hero-lineage-2026-09-04.json";
import { getCylinderCatalogHero, getCylinderHeroFraming, CYLINDER_HERO_BASELINE } from "@/lib/products/cylinder-catalog-heroes";

describe("approved Cylinder catalog photography", () => {
    it("covers 52 populated groups with unique exact assemblies and leaves the empty group alone", () => {
        expect(heroes).toHaveLength(52);
        expect(new Set(heroes.map((hero) => hero.groupSlug)).size).toBe(52);
        expect(new Set(heroes.map((hero) => hero.websiteSku)).size).toBe(52);
        expect(getCylinderCatalogHero(lineage.emptyGroup, [])).toBeNull();
        expect(getCylinderCatalogHero("cylinder-5.5ml-clear-13-415", [])).toBeNull();
    });

    it.each(heroes)("ships the approved bytes, dimensions and lineage for $websiteSku", (hero) => {
        const source = lineage.rows.find((row) => row.groupSlug === hero.groupSlug);
        expect(source?.websiteSku).toBe(hero.websiteSku);
        expect(hero.url).toMatch(/^\/images\/catalog\/cylinder\/[a-z0-9.-]+\.png$/);
        const bytes = readFileSync(`public${hero.url}`);
        const hash = createHash("sha256").update(bytes).digest("hex");
        expect(hash).toBe(source?.outputSha256);
        expect(hero.url).toContain(hash.slice(0, 12));
        expect(bytes.subarray(1, 4).toString()).toBe("PNG");
        expect(bytes.readUInt32BE(16)).toBe(hero.width);
        expect(bytes.readUInt32BE(20)).toBe(hero.height);
        expect(hero.width / hero.height).toBeCloseTo(10 / 11, 2);
        expect(getCylinderCatalogHero(hero.groupSlug, [{ websiteSku: hero.websiteSku }])).toEqual(hero);
    });

    it("does not attach a hero to a renamed family, missing assembly or approximate SKU", () => {
        const hero = heroes[0];
        expect(getCylinderCatalogHero("different-family", [{ websiteSku: hero.websiteSku }])).toBeNull();
        expect(getCylinderCatalogHero(hero.groupSlug, [])).toBeNull();
        expect(getCylinderCatalogHero(hero.groupSlug, [{ websiteSku: hero.websiteSku.toLowerCase() }])).toBeNull();
        expect(getCylinderCatalogHero(hero.groupSlug, [{ websiteSku: "retired-alias" }])).toBeNull();
    });

    it("supports the verified preview 30 mL route only when its exact assembly is present", () => {
        const slug = "cylinder-30ml-clear-18-415-finemist";
        const canonical = heroes.find((hero) => hero.websiteSku === "GBSpry1ozGl")!;
        expect(getCylinderCatalogHero(slug, [{ websiteSku: "GBSpry1ozGl" }]))
            .toEqual({ ...canonical, groupSlug: slug });
        expect(getCylinderCatalogHero(slug, [{ websiteSku: "GBSpry1ozSl" }])).toBeNull();
    });

    it("puts every photographed bottle on the same responsive baseline", () => {
        for (const hero of heroes) {
            const { scale, translateY, inset, imageHeightFraction } = getCylinderHeroFraming(hero);
            const renderedBase = (inset + hero.framing.baselineY * imageHeightFraction) * scale + translateY;
            expect(renderedBase).toBeCloseTo(CYLINDER_HERO_BASELINE, 8);
            expect(scale).toBeGreaterThan(0.5);
            expect(scale).toBeLessThan(1.4);
        }
    });

    it("keeps all five 100 mL glass bodies the same displayed height", () => {
        const hundred = heroes.filter((hero) => hero.groupSlug.startsWith("cylinder-100ml-"));
        expect(hundred).toHaveLength(5);
        for (const hero of hundred) {
            const f = getCylinderHeroFraming(hero);
            const bodyHeight = (hero.framing.baselineY - hero.framing.anchorTopY!) * f.imageHeightFraction * f.scale;
            expect(bodyHeight).toBeCloseTo(0.58, 8);
        }
    });

    it("uses verified assembled heights for the plastic bottle size relationship", () => {
        const small = heroes.find((hero) => hero.websiteSku === "PbClear4ozFlpWh")!;
        const medium = heroes.find((hero) => hero.websiteSku === "PbClear8ozFlpWh")!;
        const large = heroes.find((hero) => hero.websiteSku === "PbNat16ozFlpWh")!;
        expect(small.framing.targetHeight! / medium.framing.targetHeight!).toBeCloseTo(124 / 159, 8);
        expect(medium.framing.targetHeight! / large.framing.targetHeight!).toBeCloseTo(159 / 194, 8);
    });
});
