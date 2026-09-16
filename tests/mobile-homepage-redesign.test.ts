import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CollectionShopping from "@/components/home/CollectionShopping";

const read = (path: string) => readFileSync(path, "utf8");

describe("mobile homepage redesign", () => {
    it("keeps cart on the header bag and replaces the tab-bar cart slot with Build", () => {
        const tabs = read("src/components/mobile/MobileTabBar.tsx");
        expect(tabs).toContain('{ key: "home", label: "Home"');
        expect(tabs).toContain('{ key: "catalog", label: "Catalog"');
        expect(tabs).toContain('{ key: "build", label: "Build", icon: Wrench, href: "/matrix" }');
        expect(tabs).toContain('{ key: "grace", label: "Grace"');
        expect(tabs).toContain('{ key: "account", label: "Account"');
        expect(tabs).not.toContain('action: "cart"');
        expect(tabs).not.toContain('label: "Cart"');

        const header = read("src/components/home/ShoppingHeader.tsx");
        expect(header).toContain("ShoppingBag");
        expect(header).toContain("open-cart-drawer");
        expect(header).toContain('placeholder="Search bottles, closures, sizes..."');
        expect(header).toContain('action="/catalog"');
    });

    it("hides Ask Grace from the mobile masthead without removing Grace", () => {
        const header = read("src/components/home/ShoppingHeader.tsx");
        const css = read("src/components/home/CollectionShopping.module.css");
        const tabs = read("src/components/mobile/MobileTabBar.tsx");
        expect(header).toContain("Ask Grace");
        expect(css).toContain(".grace,.searchTrigger,.portal{display:none}");
        expect(tabs).toContain('{ key: "grace", label: "Grace"');
        expect(tabs).toContain("openPanel");
    });

    it("exposes popular families immediately after the hero with real family data", () => {
        const html = renderToStaticMarkup(createElement(CollectionShopping, { data: null }));
        expect(html.indexOf("Popular Families")).toBeGreaterThan(-1);
        expect(html.indexOf('id="family-heading"')).toBeLessThan(html.indexOf('id="collections-heading"'));
        expect(html).toContain("Cylinder");
        expect(html).toContain("Boston Round");
        expect(html).toContain('href="/bottle-families"');
        expect(html).toContain("Beautifully");
        expect(html).toContain("Contained.");
        expect(html).toContain("Glass packaging for fragrance &amp; beauty brands.");
        expect(html).toContain("Shop bottles");
        expect(html).toContain("Build Your Bottle");
        expect(html).not.toContain("Build Your Bottle →");
        expect(html).toContain('href="/matrix"');
        expect(html).toContain('href="/catalog"');
    });

    it("keeps the empire niche overlay composition on phones instead of stacking copy above the art", () => {
        const css = read("src/components/home/CollectionShopping.module.css");
        const hero = read("src/components/home/EmpireFitmentHero.tsx");
        const heroCss = read("src/components/home/EmpireFitmentHero.module.css");
        expect(css).toContain(".hero[data-scene=\"empire-niche\"]{");
        expect(css).toContain("height:clamp(248px,70vw,318px)");
        expect(css).toContain("font-size:clamp(26px,7vw,31px)");
        expect(css).toContain(".families .railWrap .family{");
        expect(hero).toContain("const MOBILE_MAX = 640");
        expect(hero).toContain("const stacked = bw <= STACK_BELOW && !mobile");
        expect(heroCss).toContain("position: absolute");
        expect(heroCss).toContain("caption { display: none");
    });
});
