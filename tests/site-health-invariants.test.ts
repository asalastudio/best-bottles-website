import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildRobots } from "@/lib/crawl/robots";
import { buildPageSitemap } from "@/lib/crawl/sitemap";

const read = (path: string) => readFileSync(path, "utf8");

describe("site health invariants", () => {
    it("enables iOS safe-area insets with viewport-fit cover", () => {
        const layout = read("src/app/layout.tsx");
        expect(layout).toContain("export const viewport");
        expect(layout).toContain('viewportFit: "cover"');
    });

    it("registers editorial faces without preloading them on every commerce page", () => {
        const layout = read("src/app/layout.tsx");
        const blog = read("src/app/blog/layout.tsx");
        const fonts = read("src/app/fonts.ts");
        const css = read("src/app/globals.css");
        expect(layout).toContain("brandFace.variable");
        expect(layout).toContain("cormorant.variable");
        expect(layout).toContain("ebGaramond.variable");
        expect(blog).toContain("editorial");
        expect(fonts).toContain('display: "swap"');
        expect(fonts).toContain("preload: false");
        expect(css).toMatch(/\.editorial\s*\{[^}]*--font-serif:\s*var\(--font-eb-garamond\)/);
    });

    it("mounts Sanity Live only while Draft Mode is on", () => {
        const live = read("src/components/SanityLiveVisualEditing.tsx");
        expect(live).toContain("if (!isEnabled) return null");
        expect(live).toContain("<SanityLive />");
        expect(live).toContain("<VisualEditing />");
    });

    it("keeps internal and account routes out of the public sitemap and robots file", () => {
        const robots = buildRobots("https://www.bestbottles.com");
        const sitemapUrls = buildPageSitemap("https://www.bestbottles.com", new Date(0)).map((entry) => entry.url);
        const lab = read("src/app/lab/layout.tsx");
        const dev = read("src/app/dev/layout.tsx");
        const disallow = [robots.rules].flat().flatMap((rule) => [rule.disallow ?? []].flat());
        for (const path of ["/team", "/executive", "/lab/", "/dev/"]) {
            expect(disallow).toContain(path);
            expect(sitemapUrls.some((url) => url.startsWith(`https://www.bestbottles.com${path}`))).toBe(false);
        }
        expect(lab).toContain("index: false");
        expect(dev).toContain("index: false");
    });

    it("clips accidental page-level horizontal overflow without using overflow hidden", () => {
        const css = read("src/app/globals.css");
        expect(css).toContain("overflow-x: clip");
        expect(css).not.toMatch(/html\s*\{[^}]*overflow-x:\s*hidden/);
    });
});
