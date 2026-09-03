import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readRepoFile(path: string) {
    return readFileSync(join(root, path), "utf8");
}

describe("June 15 launch readiness guardrails", () => {
    it("standardizes npm and launch domain configuration", () => {
        const pkg = JSON.parse(readRepoFile("package.json")) as { packageManager?: string };
        const seo = readRepoFile("src/lib/seo.ts");
        const envExample = readRepoFile(".env.example");

        expect(pkg.packageManager).toBe("npm@10.9.8");
        expect(existsSync(join(root, "package-lock.json"))).toBe(true);
        expect(existsSync(join(root, "pnpm-lock.yaml"))).toBe(false);
        expect(seo).toContain('PRODUCTION_SITE_URL = "https://www.bestbottles.com"');
        expect(seo).toContain('process.env.VERCEL_ENV === "production"');
        expect(seo).toContain("NEXT_PUBLIC_SITE_URL must be https://www.bestbottles.com");
        expect(seo).not.toContain("https://bestbottles.company");
        expect(envExample).toContain("NEXT_PUBLIC_SITE_URL=https://www.bestbottles.com");
    });

    it("emits production verification tags and required public SEO assets", () => {
        const layout = readRepoFile("src/app/layout.tsx");

        expect(layout).toContain("laASiYMkfPY-XhBRUD49XRJWN-BnmP2YweGBcmm2Fjc");
        expect(layout).toContain("msvalidate.01");
        expect(layout).toContain("DD2ECFD7F20F418A4A67662DFC0D0B03");
        expect(existsSync(join(root, "public/og-default.png"))).toBe(true);
        expect(existsSync(join(root, "public/logo.png"))).toBe(true);
        expect(readRepoFile("public/llms.txt")).toContain("Canonical domain");
    });

    it("keeps launch-noise and private routes out of public sitemap surfaces", () => {
        const sitemapConfig = readRepoFile("next-sitemap.config.js");

        for (const route of [
            "/api/*",
            "/portal/*",
            "/studio/*",
            "/sign-in/*",
            "/sign-up/*",
            "/example",
            "/fitment-demo",
            "/tech-stack",
            "/cart",
            "/grace-workspace",
        ]) {
            expect(sitemapConfig).toContain(route);
        }
    });

    it("adds route-specific canonical metadata to launch pages", () => {
        const expectations = [
            ["src/app/catalog/page.tsx", "`${SITE_URL}/catalog`"],
            ["src/app/about/page.tsx", "`${SITE_URL}/about`"],
            ["src/app/blog/page.tsx", "`${SITE_URL}/blog`"],
            ["src/app/resources/page.tsx", "`${SITE_URL}/resources`"],
            ["src/app/contact/page.tsx", "`${SITE_URL}/contact`"],
            ["src/app/request-quote/page.tsx", "`${SITE_URL}/request-quote`"],
            ["src/app/request-sample/page.tsx", "`${SITE_URL}/request-sample`"],
            ["src/app/blog/[slug]/page.tsx", "`${SITE_URL}/blog/${slug}`"],
            ["src/app/collections/boston-round-30ml/page.tsx", "`${SITE_URL}/catalog?families=Boston%20Round&search=30ml`"],
        ];

        for (const [path, canonical] of expectations) {
            const source = readRepoFile(path);
            expect(source).toContain("alternates");
            expect(source).toContain(canonical);
        }
    });

    it("marks demo-only public pages noindex for launch", () => {
        for (const path of [
            "src/app/example/page.tsx",
            "src/app/fitment-demo/page.tsx",
            "src/app/tech-stack/page.tsx",
        ]) {
            const layoutPath = path.replace("/page.tsx", "/layout.tsx");
            const source = [
                readRepoFile(path),
                existsSync(join(root, layoutPath)) ? readRepoFile(layoutPath) : "",
            ].join("\n");
            expect(source).toContain("robots");
            expect(source).toContain("index: false");
            expect(source).toContain("follow: false");
        }
    });

    it("rate limits public API routes with stable route keys", () => {
        const expectations = [
            ["src/app/api/catalog/search/route.ts", 'route: "catalog-search"'],
            ["src/app/api/shopify/resolve-variants/route.ts", 'route: "shopify-resolve-variants"'],
            ["src/app/api/voice/transcribe/route.ts", 'route: "voice-transcribe"'],
        ];

        for (const [path, routeKey] of expectations) {
            const source = readRepoFile(path);
            expect(source).toContain("enforceGraceRateLimit");
            expect(source).toContain(routeKey);
            expect(source).toContain("return rateLimited");
        }
    });

    it("keeps launch accessibility labels on key lead and catalog controls", () => {
        const footer = readRepoFile("src/components/Footer.tsx");
        const catalog = readRepoFile("src/app/catalog/CatalogClient.tsx");

        expect(footer).toContain('aria-label="Email address"');
        expect(catalog).toContain('aria-label={`Filter by ${label}`}');
        expect(catalog).toContain('aria-label="Sort catalog results"');
        expect(catalog).toContain('aria-label="Sort visible catalog results"');
    });
});
