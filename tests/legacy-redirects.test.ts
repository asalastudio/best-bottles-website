/**
 * The legacy → new URL map.
 *
 * These redirects exist to carry the old site's ranking history across the
 * cutover. The failure mode is quiet and expensive: a 301 into a 404 spends
 * the link equity AND shows the visitor an error, and nothing in the build
 * notices. The first version of this map did exactly that — 47 of its 135
 * destinations pointed at pages that were never built, chiefly
 * /collections/<slug>, because collections are catalogue FILTERS
 * (/catalog?shop=<key>) rather than routes.
 *
 * Structural invariants live here. `npm run seo:verify-redirects` does the
 * live HTTP check against a deployment, which is the only way to prove a
 * destination actually answers.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LEGACY_QUERY_REDIRECTS, LEGACY_REDIRECTS, resolveLegacyRedirect } from "../src/lib/seo/legacyRedirects";
import { SHOP_COLLECTIONS } from "../src/lib/shopCollections";

const proxySource = readFileSync(resolve(process.cwd(), "src/proxy.ts"), "utf8");

/** Route prefixes this app does not serve. A destination under one is a 404. */
const NONEXISTENT_PREFIXES = ["/collections/", "/resources/", "/services/", "/legal/"];

describe("legacy redirect map", () => {
    it("carries the whole map, not a sample", () => {
        expect(LEGACY_REDIRECTS.size).toBeGreaterThan(120);
    });

    it("never points at a route family this app does not serve", () => {
        // The exact defect in the original map.
        const broken = [...LEGACY_REDIRECTS.entries()].filter(([, dest]) =>
            NONEXISTENT_PREFIXES.some((prefix) => dest.startsWith(prefix)));
        expect(broken, `destinations under a non-existent route: ${JSON.stringify(broken)}`).toEqual([]);
    });

    it("uses real shop keys for every collection-style destination", () => {
        const keys = new Set<string>(SHOP_COLLECTIONS.map((collection) => collection.key));
        const bad: string[] = [];
        for (const [, dest] of LEGACY_REDIRECTS) {
            const match = /[?&]shop=([^&]+)/.exec(dest);
            if (match && !keys.has(decodeURIComponent(match[1]))) bad.push(dest);
        }
        expect(bad, `unknown shop keys: ${bad.join(", ")}`).toEqual([]);
    });

    it("never redirects to another legacy URL", () => {
        // A chain costs a round trip and search engines stop following after a
        // few, so the equity never reaches the real page.
        const chains = [...LEGACY_REDIRECTS.entries()].filter(([, dest]) => {
            const path = dest.split("?")[0].toLowerCase();
            return LEGACY_REDIRECTS.has(path);
        });
        expect(chains, `redirect chains: ${JSON.stringify(chains)}`).toEqual([]);
    });

    it("never redirects a path to itself", () => {
        const loops = [...LEGACY_REDIRECTS.entries()].filter(([src, dest]) => src === dest.split("?")[0].toLowerCase());
        expect(loops).toEqual([]);
    });

    it("keys are lower-case and query-free", () => {
        for (const key of LEGACY_REDIRECTS.keys()) {
            expect(key, `${key} must be lower-case`).toBe(key.toLowerCase());
            expect(key, `${key} must not carry a query`).not.toContain("?");
            expect(key.startsWith("/"), `${key} must be absolute`).toBe(true);
        }
    });

    it("every destination is an absolute path on this site", () => {
        for (const dest of LEGACY_REDIRECTS.values()) {
            expect(dest.startsWith("/"), `${dest} must be a site-relative path`).toBe(true);
        }
    });
});

describe("resolveLegacyRedirect", () => {
    it("matches regardless of the casing the link was written in", () => {
        // The legacy site used capitalised, keyword-stuffed paths, and they
        // were shared with inconsistent casing.
        const [key, dest] = [...LEGACY_REDIRECTS.entries()][0];
        expect(resolveLegacyRedirect(key)).toBe(dest);
        expect(resolveLegacyRedirect(key.toUpperCase())).toBe(dest);
    });

    it("matches with or without a trailing slash", () => {
        const [key, dest] = [...LEGACY_REDIRECTS.entries()].find(([k]) => !k.endsWith("/"))!;
        expect(resolveLegacyRedirect(`${key}/`)).toBe(dest);
    });

    it("returns null for a path that is not legacy", () => {
        for (const path of ["/catalog", "/products/cylinder-9ml-clear-13-415", "/portal", "/"]) {
            expect(resolveLegacyRedirect(path), `${path} must not redirect`).toBeNull();
        }
    });

    it("leaves the PHP paths the site still serves alone", () => {
        expect(resolveLegacyRedirect("/robots.txt")).toBeNull();
        expect(resolveLegacyRedirect("/sitemap.xml")).toBeNull();
        expect(resolveLegacyRedirect("/cart")).toBeNull();
    });
});

describe("subcategory redirects", () => {
    const VIALS = "/all-bottles/perfume-vials-glass-bottles/perfume-vials-glass-bottles-cobalt-blue-amber-essential-oils-aromatherapy.php";

    it("sends each subcategory where it actually went", () => {
        // These three are the reason the query cannot be stripped: one legacy
        // page, three different destinations.
        expect(resolveLegacyRedirect(VIALS, new URLSearchParams("subcat=64")))
            .toBe("/catalog?shop=sample-vials");
        expect(resolveLegacyRedirect(VIALS, new URLSearchParams("subcat=65")))
            .toBe("/catalog");
        expect(resolveLegacyRedirect(VIALS, new URLSearchParams("subcat=66")))
            .toBe("/catalog/boston-round");
    });

    it("falls back to the page's own destination for an unknown subcategory", () => {
        // A subcat we never mapped must still land somewhere real rather than
        // 404 — the page itself is the honest answer.
        expect(resolveLegacyRedirect(VIALS, new URLSearchParams("subcat=999")))
            .toBe(LEGACY_REDIRECTS.get(VIALS));
    });

    it("still resolves the page when no query is given at all", () => {
        expect(resolveLegacyRedirect(VIALS)).toBe(LEGACY_REDIRECTS.get(VIALS));
    });

    it("keys every query entry on a path the plain map also knows", () => {
        // Otherwise an unknown subcat on that path falls through to a 404.
        for (const key of LEGACY_QUERY_REDIRECTS.keys()) {
            const [path] = key.split("?");
            expect(LEGACY_REDIRECTS.has(path), `${path} missing from the path map`).toBe(true);
        }
    });
});

describe("unmapped legacy URLs", () => {
    it("sends an unmapped /all-bottles page to the catalogue, not the homepage", () => {
        // These used to be next.config catch-alls, which ran BEFORE middleware
        // and swallowed every legacy URL before the specific map could answer.
        expect(resolveLegacyRedirect("/all-bottles/something-we-never-mapped.php")).toBe("/catalog");
        expect(resolveLegacyRedirect("/all-bottles/deep/nested/page")).toBe("/catalog");
    });

    it("sends any other unmapped .php page to the catalogue", () => {
        // The old rule sent these to "/" — a redirect to a page unrelated to
        // the original is a soft 404: no ranking transfers and the visitor
        // starts over.
        expect(resolveLegacyRedirect("/some-old-page.php")).toBe("/catalog");
    });

    it("lets the specific map win over the fallback", () => {
        const [key, dest] = [...LEGACY_REDIRECTS.entries()].find(([k]) => k.startsWith("/all-bottles/"))!;
        expect(resolveLegacyRedirect(key)).toBe(dest);
        expect(resolveLegacyRedirect(key)).not.toBe("/catalog");
    });

    it("leaves modern routes alone", () => {
        for (const path of ["/catalog", "/products/x", "/portal", "/", "/blog"]) {
            expect(resolveLegacyRedirect(path), `${path} must not redirect`).toBeNull();
        }
    });
});

describe("middleware wiring", () => {
    it("answers legacy URLs before doing any auth work", () => {
        const legacyAt = proxySource.indexOf("const legacy = resolveLegacyRedirect");
        const authAt = proxySource.indexOf("isPortalRoute(req)");
        expect(legacyAt, "legacy lookup missing from the middleware").toBeGreaterThan(-1);
        expect(authAt).toBeGreaterThan(-1);
        expect(legacyAt, "legacy redirects must run before the auth branch").toBeLessThan(authAt);
    });

    it("uses 301, not a temporary redirect", () => {
        // A 302/307 tells search engines the old URL is still canonical, so the
        // ranking never transfers.
        expect(proxySource).toContain("301");
    });

    it("carries query parameters through", () => {
        // A legacy link in a live ad still has its utm_* attached; dropping
        // them makes that traffic look like it arrived from nowhere.
        expect(proxySource).toContain("searchParams");
    });
});
