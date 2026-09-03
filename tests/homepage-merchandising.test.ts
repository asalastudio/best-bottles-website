import { describe, expect, it } from "vitest";
import {
    HOME_ACCESSORY_STORY,
    HOME_APPLICATION_LINKS,
    HOME_EDITORIAL_STORIES,
    HOME_FAMILY_MOSAIC,
    HOME_SAMPLE_FEATURE,
    homepageFamilyHref,
} from "@/lib/homepageMerchandising";
import { readFileSync } from "node:fs";

describe("family-first homepage merchandising", () => {
    it("gives Cylinder its dedicated family landing page", () => {
        expect(homepageFamilyHref("Cylinder")).toBe("/catalog/cylinder");
        expect(homepageFamilyHref("Boston Round")).toBe("/catalog?families=Boston+Round");
    });

    it("uses the approved editorial family mosaic", () => {
        expect(HOME_FAMILY_MOSAIC.map((family) => family.family)).toEqual([
            "Cylinder",
            "Elegant",
            "Circle",
            "Boston Round",
        ]);
        expect(HOME_FAMILY_MOSAIC[0]).toMatchObject({
            layout: "feature",
            description: "Clean, versatile, made for roll-on, spray, pump, or cap.",
        });
    });

    it("uses the focused pencil-illustrated applicator line", () => {
        expect(HOME_APPLICATION_LINKS.map((application) => application.label)).toEqual([
            "Roll-On",
            "Fine Mist Sprayer",
            "Lotion Pump",
            "Dropper",
            "Reducer",
        ]);
        expect(HOME_APPLICATION_LINKS.every((application) => application.href.startsWith("/catalog"))).toBe(true);
        expect(HOME_APPLICATION_LINKS.every((application) => application.image.endsWith("-pencil.webp"))).toBe(true);

        const home = readFileSync("src/components/HomePage.tsx", "utf8");
        expect(home).toContain("Choose your applicator");
    });

    it("keeps 1–4 mL samples separate from applicator choices", () => {
        expect(HOME_SAMPLE_FEATURE).toMatchObject({
            title: "1–4 mL Samples & Testers",
            image: "/assets/editorial-sketches/samples-testers-pencil-v3.webp",
        });
        expect(HOME_SAMPLE_FEATURE.href).toContain("families=Vial");
        expect(HOME_SAMPLE_FEATURE.href).toContain("capacities=1+ml%2C1.5+ml%2C2+ml%2C4+ml");

        const home = readFileSync("src/components/HomePage.tsx", "utf8");
        expect(home.indexOf("<SampleTestersFeature")).toBeLessThan(home.indexOf("<ApplicationShowcase"));
    });

    it("uses three alternating editorial stories with live copy", () => {
        expect(HOME_EDITORIAL_STORIES.map((story) => story.title)).toEqual([
            "Antique Bulb Sprayers",
            "Cream Jars",
            "Gift Bottles",
        ]);
        expect(HOME_EDITORIAL_STORIES.every((story) => story.image.includes("/editorial-sketches/") && story.image.endsWith(".webp"))).toBe(true);
        expect(HOME_EDITORIAL_STORIES.every((story) => story.href.startsWith("/catalog"))).toBe(true);

        const home = readFileSync("src/components/HomePage.tsx", "utf8");
        expect(home).toContain("Stories From the Collection");
        expect(home.indexOf("<ApplicationShowcase")).toBeLessThan(home.indexOf("<EditorialStories"));
        expect(home.indexOf("<EditorialStories")).toBeLessThan(home.indexOf("<PathChooser"));
    });

    it("keeps packaging supplies in a smaller supporting story", () => {
        expect(HOME_ACCESSORY_STORY.title).toBe("Finish the presentation");
        expect(HOME_ACCESSORY_STORY.image).toBe("/assets/editorial-sketches/packaging-accessories-pencil.webp");
        expect(HOME_ACCESSORY_STORY.links.map((link) => link.label)).toEqual([
            "Gift Boxes",
            "Bags & Pouches",
            "Filling Tools",
        ]);

        const home = readFileSync("src/components/HomePage.tsx", "utf8");
        expect(home.indexOf("<EditorialStories")).toBeLessThan(home.indexOf("<PackagingAccessoriesStory"));
        expect(home.indexOf("<PackagingAccessoriesStory")).toBeLessThan(home.indexOf("<PathChooser"));
    });

    it("moves mobile search below the current hero while desktop search stays in the navbar", () => {
        const home = readFileSync("src/components/HomePage.tsx", "utf8");

        expect(home).toContain('<Navbar variant="home" hideMobileSearch />');
        expect(home).toContain('id="mobile-home-search"');
        expect(home.indexOf("<Hero ")).toBeLessThan(home.indexOf("<MobilePostHeroSearch"));
        expect(home.indexOf("<MobilePostHeroSearch")).toBeLessThan(home.indexOf("<DesignFamilies"));
    });
});
