import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ShopThreeWays from "@/components/home/ShopThreeWays";

const render = (props: Parameters<typeof ShopThreeWays>[0]) => renderToStaticMarkup(createElement(ShopThreeWays, props));

describe("homepage Shop three ways", () => {
    it("opens with the heading and a three-way bar that links down to its sections", () => {
        const html = render({ data: null });
        expect(html).toContain("Shop three ways");
        expect(html).toContain("Where would you like to start?");
        expect(html).toContain('<nav aria-label="Ways to shop">');
        expect([...html.matchAll(/href="#(shop-\w+)"/g)].map((m) => m[1])).toEqual(["shop-families", "shop-collections", "shop-build"]);
        expect(html).toContain("01  Find your bottle");
        expect(html).toContain("02  Explore collections");
        expect(html).toContain("03  Build your bottle");
        expect(html).toContain('aria-current="true"');
        expect(html).not.toContain('role="tab"');
    });

    it("stacks families, then collections, then the builder as their own sections", () => {
        const html = render({ data: null });
        const at = (id: string) => html.indexOf(`<section id="${id}"`);
        expect(at("shop-families")).toBeGreaterThan(-1);
        expect(at("shop-families")).toBeLessThan(at("shop-collections"));
        expect(at("shop-collections")).toBeLessThan(at("shop-build"));
        expect(html).toContain("01 · Find your bottle");
        expect(html).toContain("Bottle Families");
        expect(html).toContain("02 · Explore collections");
        expect(html).toContain("03 · Build your bottle");
        expect(html).toContain('id="build-your-bottle"');
    });

    it("links every section to its index or the builder", () => {
        const html = render({ data: null });
        expect(html).toContain('href="/bottle-families"');
        expect(html).toContain("View all bottle families");
        expect(html).toContain('href="/collections"');
        expect(html).toContain("View all collections");
        expect(html).toContain("Open the builder");
        expect(html.match(/href="\/matrix"/g)?.length).toBe(6);
        expect(html).toMatch(/collection-roll-on-bottles-bone-v3\.webp/);
        // Section 03 is Jordan's four-step comp with the pencil-study tiles.
        expect(html).toContain("Four simple steps. Endless possibilities.");
        expect([...html.matchAll(/build-steps\/(step-\d)\.webp/g)].map((m) => m[1])).toEqual(["step-1", "step-2", "step-3", "step-4"]);
        expect(html).toContain("Choose Your Bottle");
        expect(html).toContain("Choose Your Applicator");
        expect(html).toContain("Choose Your Closure");
        expect(html).toContain("Complete Your Bottle");
        expect(html).toContain("Start building");
    });

    it("shows live family counts, and none when counts are unavailable", () => {
        const html = render({ data: null, familyCounts: { Cylinder: 48, "Boston Round": 23 } });
        expect(html).toMatch(/Cylinder<\/span><span[^>]*>48 items</);
        expect(html).toContain("23 items");
        expect(render({ data: null })).not.toContain(" items<");
    });

    it("never hardcodes a family total in the copy", () => {
        expect(render({ data: null })).not.toMatch(/\b(eight|8) bottle families\b/i);
    });
});
