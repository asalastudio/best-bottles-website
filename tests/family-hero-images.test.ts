import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FAMILY_HERO_IMAGES, getFamilyHeroImage } from "@/lib/products/family-hero-images";
import { CATALOG_FAMILIES } from "@/lib/catalogFilters";

describe("family landing-page heroes", () => {
    it("ships every mapped hero as a committed asset with alt text", () => {
        for (const [family, hero] of Object.entries(FAMILY_HERO_IMAGES)) {
            expect(CATALOG_FAMILIES, `${family} is a catalogue family`).toContain(family);
            expect(hero.src.startsWith("/assets/family-heroes/")).toBe(true);
            expect(existsSync(join(process.cwd(), "public", hero.src)), `${hero.src} exists`).toBe(true);
            expect(hero.alt.length).toBeGreaterThan(20);
        }
    });

    it("is the fallback in front of the homepage mosaic on the family page", () => {
        expect(getFamilyHeroImage("Circle")?.src).toBe("/assets/family-heroes/circle.webp");
        expect(getFamilyHeroImage("Vial")).toBeNull();
        const page = readFileSync(join(process.cwd(), "src/app/catalog/[family]/page.tsx"), "utf8");
        expect(page).toContain("getFamilyHeroImage(family)?.src");
        expect(page.indexOf("getFamilyHeroImage(family)?.src")).toBeLessThan(page.indexOf("HOME_FAMILY_MOSAIC.find"));
    });
});
