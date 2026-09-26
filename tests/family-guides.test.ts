import { describe, expect, it } from "vitest";
import manifest from "../src/lib/products/family-guides.json";
import { catalogueGuide, familyGuide, formatGuideSize } from "../src/lib/products/family-guides";
import { familyToSlug } from "../src/lib/products/focused-shopping";

describe("family compatibility guides", () => {
    it("formats file sizes the way the download link shows them", () => {
        expect(formatGuideSize(412_144)).toBe("412 KB");
        expect(formatGuideSize(1_415_851)).toBe("1.4 MB");
        expect(formatGuideSize(200)).toBe("1 KB");
    });

    it("returns no guide for a family that has none, so the page shows no link", () => {
        expect(familyGuide("not-a-family")).toBeNull();
    });

    it("keys every published guide by the family page slug", () => {
        const families = manifest.families as Record<string, { url: string; pages: number; bytes: number }>;
        for (const [slug, guide] of Object.entries(families)) {
            expect(slug).toBe(familyToSlug(slug.replace(/-/g, " ")));
            expect(guide.url).toMatch(/^https:\/\//);
            expect(guide.pages).toBeGreaterThan(0);
            expect(familyGuide(slug)).toEqual(guide);
        }
        const catalogue = catalogueGuide();
        if (catalogue) expect(catalogue.url).toMatch(/^https:\/\//);
    });
});
