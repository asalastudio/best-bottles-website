import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    search: vi.fn(),
    sanityFetch: vi.fn(),
}));

vi.mock("@/lib/graceRateLimitServer", () => ({ enforceGraceRateLimit: async () => null }));
vi.mock("@/lib/catalogServer", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/lib/catalogServer")>(),
    searchCatalogServer: mocks.search,
    withCatalogHeroes: <T,>(result: T) => result,
}));
// unstable_cache as a pass-through: these tests check what is fetched and when it fails, not Next's cache.
vi.mock("next/cache", () => ({ unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }));
vi.mock("@/sanity/lib/client", () => ({ client: { fetch: mocks.sanityFetch }, clientNoCdn: { fetch: mocks.sanityFetch }, isSanityConfigured: true }));

import { POST } from "@/app/api/catalog/search/route";
import { getMegaMenuPanels } from "@/sanity/lib/queries";
import { publishPdpGroup, readPdpGroup, subscribePdpGroup, type PdpGroupSnapshot } from "@/lib/grace/pageContextEvents";

const searchRequest = (limit: number) => new Request("http://localhost/api/catalog/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filters: { category: "Glass Bottle" }, sort: "featured", view: "visual", limit, cursor: null }),
}) as never;

describe("catalog search API limit", () => {
    beforeEach(() => mocks.search.mockReset().mockResolvedValue({ items: [], facets: {}, totalCount: 0, nextCursor: null, primarySkus: [], variantPreviewRows: [] }));

    it("accepts the finders' 240-row page that it rejected with HTTP 400 before", async () => {
        const response = await POST(searchRequest(240));
        expect(response.status).toBe(200);
        expect(mocks.search).toHaveBeenCalledWith(expect.objectContaining({ limit: 240 }));
    });

    it("still rejects anything above 240 or below 1", async () => {
        expect((await POST(searchRequest(241))).status).toBe(400);
        expect((await POST(searchRequest(0))).status).toBe(400);
        expect(mocks.search).not.toHaveBeenCalled();
    });

    it("matches what the family and application finders ask for", () => {
        for (const path of ["src/app/catalog/[family]/FamilyPageClient.tsx", "src/app/catalog/application/[application]/ApplicationFinderClient.tsx"]) {
            const limits = [...readFileSync(path, "utf8").matchAll(/limit: (\d+)/g)].map((match) => Number(match[1]));
            expect(limits.length, path).toBeGreaterThan(0);
            expect(Math.max(...limits), path).toBeLessThanOrEqual(240);
        }
    });
});

describe("mega menu fetch", () => {
    beforeEach(() => mocks.sanityFetch.mockReset());

    it("returns the panels, and null without caching the failure when Sanity is down", async () => {
        const panels = [{ title: "Bottles" }];
        mocks.sanityFetch.mockRejectedValueOnce(new Error("Sanity unavailable")).mockResolvedValueOnce({ megaMenuPanels: panels });
        expect(await getMegaMenuPanels()).toBeNull();
        // The failure threw inside the cached loader, so the next request asks Sanity again.
        expect(await getMegaMenuPanels()).toEqual(panels);
        expect(mocks.sanityFetch).toHaveBeenCalledTimes(2);
    });

    it("is cached for five minutes in the root layout", () => {
        const source = readFileSync("src/sanity/lib/queries.ts", "utf8");
        expect(source).toContain("MEGA_MENU_REVALIDATE_SECONDS = 300");
        expect(source).toMatch(/unstable_cache\(\s*async \(\) => \{\s*const result = await client\.fetch/);
    });
});

describe("the PDP group Grace reads", () => {
    const snapshot = (slug: string): PdpGroupSnapshot => ({ slug, group: { displayName: slug, category: "Glass Bottle" }, variants: [{ capColor: "Black" }] });

    it("publishes the group the page rendered and notifies subscribers", () => {
        const listener = vi.fn();
        const stop = subscribePdpGroup(listener);
        const first = snapshot("cylinder-9ml-clear-17-415-finemist");
        publishPdpGroup(first);
        expect(readPdpGroup()).toBe(first);
        publishPdpGroup(first);
        expect(listener).toHaveBeenCalledTimes(1);
        stop();
        publishPdpGroup(snapshot("pillar-9ml-clear-17-415-finemist"));
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("is what Grace uses, with the Convex query only for a page that published nothing for its slug", () => {
        const provider = readFileSync("src/components/grace/GraceProvider.tsx", "utf8");
        expect(provider).toContain("useSyncExternalStore(subscribePdpGroup, readPdpGroup, () => null)");
        expect(provider).toContain('useQuery(api.products.getProductGroup, productSlug && !pagePdpGroup ? { slug: productSlug } : "skip")');
        for (const page of ["src/components/pdp/PdpRedesignPage.tsx", "src/app/products/[slug]/ProductDetailClient.tsx"]) {
            expect(readFileSync(page, "utf8"), page).toContain("publishPdpGroup(");
        }
    });
});

describe("product page props", () => {
    it("never serialise variant components to the browser", () => {
        const page = readFileSync("src/app/products/[slug]/page.tsx", "utf8");
        expect(page).toContain("variants: forBrowser(data.variants)");
        expect(page).toContain("initialData: { ...data, variants: forBrowser(data.variants) }");
        expect(page).toContain("descriptions: resolveItemDescriptions(data.variants)");
    });
});
