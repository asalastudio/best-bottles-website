import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createProductSlugIndex } from "@/lib/crawl/product-slug-index";
import { NOT_FOUND_REWRITE_PATH, crawlRouteStatus, isDocumentRequest, routeStatusForPath } from "@/lib/crawl/route-status";

const documentRequest = (pathname: string, headers: Record<string, string> = {}) => ({
    pathname,
    method: "GET",
    headers: new Headers(headers),
    searchParams: new URLSearchParams(),
});

describe("route status decided before the page renders", () => {
    it("sends legacy product aliases to the canonical slug permanently", () => {
        expect(routeStatusForPath("/products/atomizer-5ml-slim")).toEqual({ kind: "redirect", pathname: "/products/atomizer-5ml" });
        expect(routeStatusForPath("/products/cylinder-9ml-clear/")).toEqual({ kind: "redirect", pathname: "/products/cylinder-9ml-clear-17-415-rollon" });
    });

    it("answers 404 for source-held product groups", () => {
        for (const slug of ["roll-on-fitment", "dropper-17-415", "cap-closure-22-400"]) {
            expect(routeStatusForPath(`/products/${slug}`)).toEqual({ kind: "not-found" });
        }
    });

    it("asks the catalogue about any other product slug", () => {
        expect(routeStatusForPath("/products/cylinder-9ml-clear-17-415-rollon")).toEqual({ kind: "check-product", slug: "cylinder-9ml-clear-17-415-rollon" });
        expect(routeStatusForPath("/products/cap%20closure")).toEqual({ kind: "check-product", slug: "cap closure" });
        expect(routeStatusForPath("/products/%E0%A4%A")).toEqual({ kind: "pass" });
    });

    it("answers 404 for catalogue family and application paths that are not real", () => {
        expect(routeStatusForPath("/catalog/zzz-not-a-family")).toEqual({ kind: "not-found" });
        expect(routeStatusForPath("/catalog/application")).toEqual({ kind: "not-found" });
        expect(routeStatusForPath("/catalog/application/zzz")).toEqual({ kind: "not-found" });
        expect(routeStatusForPath("/catalog/application/constructor")).toEqual({ kind: "not-found" });
    });

    it("leaves real family, application and every other page alone", () => {
        for (const path of [
            "/catalog/cylinder",
            "/catalog/boston-round",
            "/catalog/Cylinder",
            "/catalog/application/roll-on",
            "/catalog/application/lotion-pump",
            "/catalog",
            "/matrix",
            "/",
            "/products",
            "/blog/neck-finish-numbers-explained",
            NOT_FOUND_REWRITE_PATH,
        ]) {
            expect(routeStatusForPath(path), path).toEqual({ kind: "pass" });
        }
    });
});

describe("catalogue lookup for product pages", () => {
    it("404s an unknown product slug on a full page load", async () => {
        const lookup = vi.fn(async () => false);
        await expect(crawlRouteStatus(documentRequest("/products/zzz-not-a-product"), lookup)).resolves.toEqual({ kind: "not-found" });
        expect(lookup).toHaveBeenCalledWith("zzz-not-a-product");
    });

    it("passes a known slug, and fails open when the catalogue cannot answer", async () => {
        await expect(crawlRouteStatus(documentRequest("/products/atomizer-5ml"), async () => true)).resolves.toEqual({ kind: "pass" });
        await expect(crawlRouteStatus(documentRequest("/products/atomizer-5ml"), async () => null)).resolves.toEqual({ kind: "pass" });
    });

    it("skips the lookup for client-side navigations and prefetches", async () => {
        const lookup = vi.fn(async () => false);
        for (const headers of [{ rsc: "1" }, { "next-router-prefetch": "1", rsc: "1" }] as Array<Record<string, string>>) {
            await expect(crawlRouteStatus(documentRequest("/products/zzz", headers), lookup)).resolves.toEqual({ kind: "pass" });
        }
        await expect(crawlRouteStatus({ ...documentRequest("/products/zzz"), searchParams: new URLSearchParams("_rsc=abc") }, lookup)).resolves.toEqual({ kind: "pass" });
        await expect(crawlRouteStatus({ ...documentRequest("/products/zzz"), method: "POST" }, lookup)).resolves.toEqual({ kind: "pass" });
        expect(lookup).not.toHaveBeenCalled();
        // ...but the data-free decisions still apply to them.
        await expect(crawlRouteStatus(documentRequest("/products/roll-on-fitment", { rsc: "1" }), lookup)).resolves.toEqual({ kind: "not-found" });
    });

    it("treats HEAD like GET", () => {
        expect(isDocumentRequest("HEAD", new Headers(), new URLSearchParams())).toBe(true);
    });
});

describe("product slug index", () => {
    function setup(slugs: string[]) {
        let time = 0;
        const loadAllSlugs = vi.fn(async () => slugs);
        const lookupSlug = vi.fn(async (slug: string) => slug === "new-group");
        const index = createProductSlugIndex({ loadAllSlugs, lookupSlug, now: () => time, ttlMs: 1_000, retryMs: 100, timeoutMs: 50 });
        return { index, loadAllSlugs, lookupSlug, advance: (ms: number) => { time += ms; } };
    }

    it("answers known slugs from one catalogue load", async () => {
        const { index, loadAllSlugs, lookupSlug } = setup(["a", "b"]);
        await expect(index.exists("a")).resolves.toBe(true);
        await expect(index.exists("b")).resolves.toBe(true);
        expect(loadAllSlugs).toHaveBeenCalledTimes(1);
        expect(lookupSlug).not.toHaveBeenCalled();
    });

    it("looks a missing slug up directly, so a group created since the load still opens", async () => {
        const { index, lookupSlug } = setup(["a"]);
        await expect(index.exists("new-group")).resolves.toBe(true);
        await expect(index.exists("new-group")).resolves.toBe(true);
        expect(lookupSlug).toHaveBeenCalledTimes(1);
        await expect(index.exists("zzz")).resolves.toBe(false);
    });

    it("reloads the list after its TTL", async () => {
        const { index, loadAllSlugs, advance } = setup(["a"]);
        await index.exists("a");
        advance(1_001);
        await index.exists("a");
        expect(loadAllSlugs).toHaveBeenCalledTimes(2);
    });

    it("answers null when the catalogue fails or hangs, and backs off before reloading", async () => {
        let time = 0;
        const loadAllSlugs = vi.fn(() => Promise.reject(new Error("convex down")));
        const lookupSlug = vi.fn(() => new Promise<boolean>(() => undefined));
        const index = createProductSlugIndex({ loadAllSlugs, lookupSlug, now: () => time, retryMs: 100, timeoutMs: 20 });
        await expect(index.exists("a")).resolves.toBeNull();
        await expect(index.exists("a")).resolves.toBeNull();
        expect(loadAllSlugs).toHaveBeenCalledTimes(1);
        time += 100;
        await index.exists("a");
        expect(loadAllSlugs).toHaveBeenCalledTimes(2);
    });
});

describe("wiring", () => {
    it("the proxy 308s aliases and rewrites unknown pages to a real 404", () => {
        const proxy = readFileSync("src/proxy.ts", "utf8");
        expect(proxy).toContain("crawlRouteStatus(");
        expect(proxy).toContain("NextResponse.redirect(url, 308)");
        expect(proxy).toContain("NOT_FOUND_REWRITE_PATH");
    });

    it("the product page keeps its own 404 and permanent redirect as the fallback", () => {
        const page = readFileSync("src/app/products/[slug]/page.tsx", "utf8");
        expect(page).toContain("if (!data) notFound();");
        expect(page).toContain("permanentRedirect(redirectTarget)");
        expect(page).toContain("...productPageRobots(data)");
        // One robots tag on a 404: Next adds noindex itself.
        expect(page).not.toMatch(/Product Not Found[^\n]*\n[^\n]*robots/);
    });

    it("/build-your-bottle sends people to the builder at /matrix", () => {
        const config = readFileSync("next.config.ts", "utf8");
        expect(config).toMatch(/source: "\/build-your-bottle",\s*destination: "\/matrix",\s*permanent: true/);
        expect(config).toMatch(/source: "\/es\/build-your-bottle",\s*destination: "\/es\/matrix",\s*permanent: true/);
    });
});
