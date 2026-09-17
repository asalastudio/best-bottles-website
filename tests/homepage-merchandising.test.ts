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
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CollectionShopping, { CollectionGrid } from "@/components/home/CollectionShopping";

describe("family-first homepage merchandising", () => {
    it("sends every shop-by-family tile to its dedicated landing page", () => {
        expect(homepageFamilyHref("Cylinder")).toBe("/catalog/cylinder");
        expect(homepageFamilyHref("Elegant")).toBe("/catalog/elegant");
        expect(homepageFamilyHref("Circle")).toBe("/catalog/circle");
        expect(homepageFamilyHref("Boston Round")).toBe("/catalog/boston-round");
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

        const html = renderToStaticMarkup(createElement(CollectionGrid));
        for (const key of ["sample-vials", "roll-on-bottles", "dropper-bottles"]) {
            expect(html).toContain(`href="/catalog?shop=${key}"`);
        }
    });

    it("keeps the legacy editorial categories discoverable in the collection directory", () => {
        expect(HOME_EDITORIAL_STORIES.map((story) => story.title)).toEqual([
            "Antique Bulb Sprayers",
            "Cream Jars",
            "Gift Bottles",
        ]);
        expect(HOME_EDITORIAL_STORIES.every((story) => story.image.includes("/editorial-sketches/") && story.image.endsWith(".webp"))).toBe(true);
        expect(HOME_EDITORIAL_STORIES.every((story) => story.href.startsWith("/catalog"))).toBe(true);

        const html = renderToStaticMarkup(createElement(CollectionGrid, { all: true }));
        for (const key of ["glass-spray-bottles", "cream-jars", "decorative-bottles"]) {
            expect(html).toContain(`href="/catalog?shop=${key}"`);
        }
    });

    it("keeps packaging supplies discoverable in the collection directory", () => {
        expect(HOME_ACCESSORY_STORY.title).toBe("Finish the presentation");
        expect(HOME_ACCESSORY_STORY.image).toBe("/assets/editorial-sketches/packaging-accessories-pencil.webp");
        expect(HOME_ACCESSORY_STORY.links.map((link) => link.label)).toEqual([
            "Gift Boxes",
            "Bags & Pouches",
            "Filling Tools",
        ]);

        const html = renderToStaticMarkup(createElement(CollectionGrid, { all: true }));
        expect(html).toContain('href="/catalog?shop=accessories-packaging"');
    });

    it("puts shared search before shopping and families before collections", () => {
        const home = readFileSync("src/components/HomePage.tsx", "utf8");
        const header = readFileSync("src/components/home/ShoppingHeader.tsx", "utf8");
        expect(home).toContain("<ShoppingHeader />");
        expect(home.indexOf("<ShoppingHeader")).toBeLessThan(home.indexOf("<CollectionShopping"));
        expect(header).toContain('role="search"');
        expect(header).toContain('name="search"');
        expect(header).toContain("localizeHref(locale, '/catalog')");
        const html = renderToStaticMarkup(createElement(CollectionShopping, { data: null }));
        expect(html.indexOf('id="family-heading"')).toBeGreaterThan(-1);
        expect(html.indexOf('id="family-heading"')).toBeLessThan(html.indexOf('id="collections-heading"'));
        expect(html).toContain('id="build-your-bottle"');
        expect(html).toContain('href="/matrix"');
    });
});
