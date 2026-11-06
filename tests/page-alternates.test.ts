import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isTranslatedPath, pageAlternates } from "@/i18n/metadata";
import { SITEMAP_PAGES } from "@/lib/crawl/sitemap";
import { SITE_URL } from "@/lib/seo";

const read = (path: string) => readFileSync(path, "utf8");

/** Every page.tsx under src/app, with its URL pattern (route groups dropped). */
function appPages(dir = "src/app"): Array<{ file: string; route: string }> {
    const pages: Array<{ file: string; route: string }> = [];
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
            if (name.startsWith("_") || name.startsWith("@")) continue;
            pages.push(...appPages(full));
        } else if (/^page\.tsx$/.test(name)) {
            const segments = dir.replace(/^src\/app\/?/, "").split("/").filter((s) => s && !/^\(.*\)$/.test(s));
            pages.push({ file: full, route: `/${segments.join("/")}` });
        }
    }
    return pages;
}

describe("pageAlternates: one canonical and hreflang rule for every page", () => {
    it("advertises en/es/x-default only on routes with Spanish copy", () => {
        expect(pageAlternates("/")).toEqual({
            canonical: SITE_URL,
            languages: { en: SITE_URL, es: `${SITE_URL}/es`, "x-default": SITE_URL },
        });
        expect(pageAlternates("/es/catalog")).toEqual({
            canonical: `${SITE_URL}/es/catalog`,
            languages: { en: `${SITE_URL}/catalog`, es: `${SITE_URL}/es/catalog`, "x-default": `${SITE_URL}/catalog` },
        });
        expect(pageAlternates("/catalog/cylinder").languages).toBeDefined();
        expect(pageAlternates("/bottle-families").languages).toBeDefined();
        expect(pageAlternates("/collections").languages).toBeDefined();
    });

    it("canonicalises untranslated routes to their English URL with no hreflang", () => {
        for (const path of ["/about", "/blog/choosing-a-roll-on", "/products/pillar-9ml-clear-17-415-finemist", "/matrix", "/terms"]) {
            expect(pageAlternates(path)).toEqual({ canonical: `${SITE_URL}${path}` });
            // The Spanish URL serves the same English copy, so it consolidates on the English page.
            expect(pageAlternates(`/es${path}`)).toEqual({ canonical: `${SITE_URL}${path}` });
        }
        expect(isTranslatedPath("/catalog/application/roll-on")).toBe(false);
        expect(isTranslatedPath("/es/catalog/application/roll-on")).toBe(false);
    });

    it("lets a redirecting or refining page name the page it stands for", () => {
        expect(pageAlternates("/collections/boston-round-30ml", "/catalog?families=Boston%20Round&search=30ml")).toEqual({
            canonical: `${SITE_URL}/catalog?families=Boston%20Round&search=30ml`,
        });
        expect(pageAlternates("/catalog/application/roll-on", "/catalog?application=roll-on")).toEqual({
            canonical: `${SITE_URL}/catalog?application=roll-on`,
        });
    });

    it("is the only way a page sets alternates, and the root layout follows the same rule", () => {
        const pages = appPages();
        for (const { file } of pages) {
            const source = read(file);
            if (!source.includes("alternates")) continue;
            expect(source, file).toContain("pageAlternates(");
            expect(source, file).not.toContain("buildHreflangAlternates(");
            expect(source, file).not.toMatch(/alternates:\s*\{/);
        }
        const layout = read("src/app/layout.tsx");
        expect(layout).toContain("isTranslatedPath(stripped)");
        expect(layout).not.toContain("isEnglishOnlyPath");
    });

    it("gives every page in the sitemap a canonical", () => {
        const pages = appPages();
        for (const { path } of SITEMAP_PAGES) {
            const page = pages.find((p) => p.route === path);
            expect(page, path).toBeDefined();
            expect(read(page!.file), path).toContain("pageAlternates(");
        }
        // The finder redirects to the catalog without ?guide=1; its canonical is that destination.
        expect(read("src/app/catalog/application/[application]/page.tsx")).toContain("pageAlternates(pathname, canonicalPath)");
    });

    it("keeps cart, portal, sign-in, sign-up and the team hub out of the index", () => {
        for (const layout of [
            "src/app/cart/layout.tsx",
            "src/app/(portal)/layout.tsx",
            "src/app/sign-in/layout.tsx",
            "src/app/sign-up/layout.tsx",
            "src/app/team/layout.tsx",
        ]) {
            expect(existsSync(layout), layout).toBe(true);
            const source = read(layout);
            expect(source, layout).toContain("index: false");
            expect(source, layout).toContain("follow: false");
        }
    });
});
