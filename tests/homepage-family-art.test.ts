import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FAMILY_ART, FAMILY_ART_DESKTOP, familyCardSources } from "@/lib/homepageFamilyArt";

describe("homepage family card art", () => {
    it("leads the rail with Cylinder, Boston Round, Round, then Circle", () => {
        expect(Object.keys(FAMILY_ART).slice(0, 4)).toEqual([
            "Cylinder",
            "Boston Round",
            "Round",
            "Circle",
        ]);
    });

    it("uses 3:4 lineups on desktop and nearly-square v4 crops on mobile", () => {
        expect(familyCardSources("Cylinder")).toEqual({
            desktop: "/assets/homepage/family-cylinder-desktop-v4.webp",
            mobile: "/assets/homepage/family-cylinder-mobile-v4.webp",
        });
        expect(familyCardSources("Boston Round")).toEqual({
            desktop: "/assets/homepage/family-boston-round-desktop-v4.webp",
            mobile: "/assets/homepage/family-boston-round-mobile-v4.webp",
        });
        expect(familyCardSources("Round")).toEqual({
            desktop: "/assets/homepage/family-round-desktop-v4.webp",
            mobile: "/assets/homepage/family-round-mobile-v4.webp",
        });
        expect(familyCardSources("Circle")).toEqual({
            desktop: "/assets/homepage/family-circle-desktop-v4.webp",
            mobile: "/assets/homepage/family-circle-mobile-v4.webp",
        });
        expect(familyCardSources("Elegant")).toEqual({
            desktop: "/assets/homepage/family-elegant-bone-v3.webp",
            mobile: "/assets/homepage/family-elegant-bone-v3.webp",
        });
        expect(familyCardSources("Tulip")).toBeNull();
        expect(familyCardSources("Cylinder", "https://cdn.example/cms.jpg")).toEqual({
            desktop: "https://cdn.example/cms.jpg",
            mobile: "https://cdn.example/cms.jpg",
        });
        for (const file of Object.values(FAMILY_ART_DESKTOP)) {
            expect(existsSync(`public/assets/homepage/${file}.webp`)).toBe(true);
        }
        for (const family of ["Cylinder", "Boston Round", "Round", "Circle"] as const) {
            expect(existsSync(`public/assets/homepage/${FAMILY_ART[family]}.webp`)).toBe(true);
        }
    });
});
