import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveRobots as serializeRobotsTxt } from "next/dist/build/webpack/loaders/metadata/resolve-route-data";
import { resolveRobots as resolveRobotsMeta } from "next/dist/lib/metadata/resolvers/resolve-basics";
import { NAMED_CRAWLERS, PRIVATE_PATH_PREFIXES, buildRobots, isPrivatePath } from "@/lib/crawl/robots";
import { NOT_IN_SITEMAP, SITEMAP_PAGES, buildPageSitemap, sitemapProductSlugs } from "@/lib/crawl/sitemap";
import { productPageRobots } from "@/lib/products/pdp-robots";
import { DEFAULT_ROBOTS } from "@/lib/seo";

const ORIGIN = "https://www.bestbottles.com";

/** RFC 9309: the group naming the agent (else `*`); the longest matching rule wins, Allow on a tie. */
function isAllowed(robotsTxt: string, agent: string, path: string): boolean {
    const groups: Array<{ agents: string[]; rules: Array<{ allow: boolean; prefix: string }> }> = [];
    let current: (typeof groups)[number] | null = null;
    for (const raw of robotsTxt.split("\n")) {
        const line = raw.trim();
        const match = line.match(/^([A-Za-z-]+):\s*(.*)$/);
        if (!match) continue;
        const [, key, value] = match;
        const field = key.toLowerCase();
        if (field === "user-agent") {
            if (!current || current.rules.length > 0) {
                current = { agents: [], rules: [] };
                groups.push(current);
            }
            current.agents.push(value.toLowerCase());
        } else if ((field === "allow" || field === "disallow") && current) {
            current.rules.push({ allow: field === "allow", prefix: value });
        }
    }
    const group = groups.find((candidate) => candidate.agents.includes(agent.toLowerCase()))
        ?? groups.find((candidate) => candidate.agents.includes("*"));
    if (!group) return true;
    let best: { allow: boolean; prefix: string } | null = null;
    for (const rule of group.rules) {
        if (!rule.prefix || !path.startsWith(rule.prefix)) continue;
        if (!best || rule.prefix.length > best.prefix.length || (rule.prefix.length === best.prefix.length && rule.allow)) best = rule;
    }
    return best ? best.allow : true;
}

describe("robots.txt", () => {
    const robotsTxt = serializeRobotsTxt(buildRobots(ORIGIN));

    it("has one group for every crawler instead of two competing `*` groups", () => {
        expect(robotsTxt.match(/^User-Agent: \*$/gm)).toHaveLength(1);
        // One group: every User-Agent line comes before the first rule.
        const lines = robotsTxt.trim().split("\n");
        const firstRule = lines.findIndex((line) => /^(Allow|Disallow):/.test(line));
        const lastAgent = lines.map((line) => line.startsWith("User-Agent:")).lastIndexOf(true);
        expect(lastAgent).toBeLessThan(firstRule);
        for (const bot of NAMED_CRAWLERS) expect(robotsTxt).toContain(`User-Agent: ${bot}\n`);
    });

    it("lets crawlers fetch scripts, styles and every /_next/image product photo", () => {
        expect(robotsTxt).not.toContain("/_next");
        for (const agent of ["Googlebot", "*", ...NAMED_CRAWLERS]) {
            for (const path of [
                "/",
                "/catalog",
                "/matrix",
                "/products/cylinder-9ml-clear-17-415-rollon",
                "/_next/static/chunks/main.js",
                "/_next/image?url=%2Fassets%2Fhero.png&w=1080&q=75",
                "/blog/neck-finish-numbers-explained",
            ]) {
                expect(isAllowed(robotsTxt, agent, path), `${agent} ${path}`).toBe(true);
            }
        }
    });

    it("blocks the private paths for every crawler, the named AI crawlers included", () => {
        for (const agent of ["Googlebot", "*", ...NAMED_CRAWLERS]) {
            for (const path of [
                "/sign-in",
                "/sign-in/factor-one",
                "/sign-up",
                "/team",
                "/team/products",
                "/portal",
                "/portal/orders",
                "/api/catalog/search",
                "/lab/configurator",
                "/dev/material-lab",
                "/cart",
                "/grace-workspace",
                "/studio",
            ]) {
                expect(isAllowed(robotsTxt, agent, path), `${agent} ${path}`).toBe(false);
            }
        }
    });

    it("names the same origin as the canonical links for Host and both sitemaps", () => {
        const preCutover = serializeRobotsTxt(buildRobots("https://best-bottles-website.vercel.app/"));
        expect(preCutover).toContain("Host: https://best-bottles-website.vercel.app\n");
        expect(preCutover).toContain("Sitemap: https://best-bottles-website.vercel.app/sitemap.xml\n");
        expect(preCutover).toContain("Sitemap: https://best-bottles-website.vercel.app/server-sitemap.xml\n");
        expect(preCutover).not.toContain("bestbottles.com");
    });
});

describe("robots.txt and sitemap routes follow SITE_URL", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it("use NEXT_PUBLIC_SITE_URL, the origin layout.tsx gives metadataBase", async () => {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://best-bottles-website.vercel.app");
        vi.resetModules();
        const [{ SITE_URL }, { default: robots }, { default: sitemap }] = await Promise.all([
            import("@/lib/seo"),
            import("@/app/robots"),
            import("@/app/sitemap"),
        ]);
        expect(SITE_URL).toBe("https://best-bottles-website.vercel.app");
        const rules = robots();
        expect(rules.host).toBe(SITE_URL);
        expect([rules.sitemap].flat().every((url) => url?.startsWith(`${SITE_URL}/`))).toBe(true);
        expect(sitemap().every((entry) => entry.url.startsWith(SITE_URL))).toBe(true);
        expect(readFileSync("src/app/layout.tsx", "utf8")).toContain("metadataBase: new URL(SITE_URL)");
    });

    it("are served by the app, not stale files in public/", () => {
        for (const file of ["public/robots.txt", "public/sitemap.xml", "public/sitemap-0.xml", "next-sitemap.config.js"]) {
            expect(existsSync(file), file).toBe(false);
        }
        const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
        expect(pkg.scripts.postbuild).toBeUndefined();
    });
});

/** Every page route under src/app as a URL pattern ("/catalog/[family]"); route groups dropped. */
function appPageRoutes(dir = "src/app"): string[] {
    const routes: string[] = [];
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
            if (name.startsWith("_") || name.startsWith("@")) continue;
            routes.push(...appPageRoutes(full));
        } else if (/^page\.(tsx|ts|jsx|js)$/.test(name)) {
            const segments = relative("src/app", dir).split(sep).filter((segment) => segment && !/^\(.*\)$/.test(segment));
            routes.push(`/${segments.join("/")}`);
        }
    }
    return routes;
}

describe("page sitemap (/sitemap.xml)", () => {
    const urls = buildPageSitemap(ORIGIN, new Date("2026-10-04T00:00:00Z")).map((entry) => entry.url);
    const paths = urls.map((url) => url.slice(ORIGIN.length) || "/");

    it("lists the catalogue, the builder, collections and bottle families", () => {
        for (const path of ["/", "/catalog", "/matrix", "/collections", "/bottle-families", "/blog", "/about", "/contact"]) {
            expect(paths).toContain(path);
        }
        expect(urls[0]).toBe(ORIGIN);
    });

    it("leaves out lab, dev, staff, account and redirecting pages", () => {
        for (const path of paths) expect(isPrivatePath(path), path).toBe(false);
        for (const path of ["/lab/bottle-3d", "/lab/configurator", "/dev/material-lab", "/collections/boston-round-30ml"]) {
            expect(paths).not.toContain(path);
        }
    });

    it("accounts for every page in src/app, so a new page cannot miss the sitemap unnoticed", () => {
        const routes = appPageRoutes();
        expect(routes.length).toBeGreaterThan(30);
        const listed = new Set(SITEMAP_PAGES.map((page) => page.path));
        const unaccounted = routes.filter((route) => !listed.has(route) && !isPrivatePath(route) && !(route in NOT_IN_SITEMAP));
        expect(unaccounted).toEqual([]);
        // ...and nothing listed points at a page that no longer exists.
        for (const path of listed) expect(routes, path).toContain(path);
    });

    it("never lists a private path in robots.txt's own words", () => {
        for (const prefix of PRIVATE_PATH_PREFIXES) {
            expect(paths.some((path) => path.startsWith(prefix)), prefix).toBe(false);
        }
    });
});

describe("product sitemap (/server-sitemap.xml)", () => {
    const group = (slug: string, extra: Partial<{ variantCount: number; category: string }> = {}) => ({
        _id: `id-${slug}`,
        slug,
        variantCount: extra.variantCount ?? 3,
        category: extra.category ?? "Glass Bottle",
    });

    it("lists only product pages that render a product", () => {
        const groups = [
            group("cylinder-9ml-clear-17-415-rollon"),
            group("atomizer-5ml"),
            // Legacy alias: 308s to atomizer-5ml.
            group("atomizer-5ml-slim"),
            // Source-held: the page answers 404.
            group("roll-on-fitment"),
            group("dropper-17-415"),
            group("cap-closure-22-400"),
            // Every SKU held back: "Product currently unavailable".
            group("cap-closure-PRESS-FIT", { category: "Component" }),
            // Hidden duplicate and an empty group.
            group("cylinder-5.5ml-clear-13-415"),
            group("empty-group", { variantCount: 0 }),
            group("test-group", { category: "Internal" }),
        ];
        const variantRows = [
            {
                groupId: "id-cap-closure-PRESS-FIT",
                variants: [
                    { websiteSku: "CJ30BlkCap", graceSku: "CMP-CLS-BLK-06" },
                    { websiteSku: "CJ30SlCap", graceSku: "CMP-CLS-SLV-02" },
                ],
            },
        ];
        expect(sitemapProductSlugs(groups, variantRows)).toEqual(["cylinder-9ml-clear-17-415-rollon", "atomizer-5ml"]);
    });

    it("keeps a group whose primary SKU is held when another SKU can still be shown", () => {
        const groups = [group("cap-closure-mixed", { category: "Component" })];
        const variantRows = [{
            groupId: "id-cap-closure-mixed",
            variants: [{ websiteSku: "CJ30BlkCap", graceSku: "CMP-CLS-BLK-06" }, { websiteSku: "OK-SKU", graceSku: "OK-GRACE" }],
        }];
        expect(sitemapProductSlugs(groups, variantRows)).toEqual(["cap-closure-mixed"]);
    });

    it("reads journal posts from the document type the blog serves", () => {
        const route = readFileSync("src/app/server-sitemap.xml/route.ts", "utf8");
        const queries = readFileSync("src/sanity/lib/queries.ts", "utf8");
        expect(route).toContain("JOURNAL_SITEMAP_QUERY");
        expect(route).not.toContain("journalPost");
        expect(queries).toMatch(/JOURNAL_SITEMAP_QUERY = `\s*\*\[_type == "journal"/);
    });
});

describe("robots meta tags", () => {
    it("site default carries no index/follow value, so a 404's noindex is the only robots tag", () => {
        const resolved = resolveRobotsMeta(DEFAULT_ROBOTS);
        expect(resolved?.basic).toBeFalsy();
        expect(resolved?.googleBot).toBe("max-video-preview:-1, max-image-preview:large, max-snippet:-1");
        expect(resolved?.googleBot).not.toMatch(/\bindex\b/);
    });

    it("a product with nothing to sell is noindex, follow; a product with SKUs inherits the default", () => {
        expect(resolveRobotsMeta(productPageRobots({ variants: [] }).robots)).toEqual({ basic: "noindex, follow", googleBot: null });
        expect(productPageRobots({ variants: [{}] })).toEqual({});
        expect(productPageRobots(null)).toEqual({});
    });
});
