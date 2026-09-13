import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Team Hub links", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/team/page.tsx"), "utf8");
    const catalog = readFileSync(resolve(process.cwd(), "src/lib/teamHub.ts"), "utf8");

    it("links to Best Bottles Packaging Studio", () => {
        expect(catalog).toContain("Best Bottles Packaging Studio");
        expect(catalog).toContain("https://best-bottles-packaging-studio.vercel.app/");
    });

    it("links to the backend Shopify admin", () => {
        expect(catalog).toContain("Backend Shopify Admin");
        expect(catalog).toContain("https://admin.shopify.com");
    });

    it("links staff to the certificate queue and wholesale accounts", () => {
        // Both surfaces decide a customer's tax status; neither should depend on
        // someone remembering the URL.
        expect(catalog).toContain("Certificate Review Queue");
        expect(catalog).toContain("/team/resale-certificates");
        expect(catalog).toContain("Wholesale Accounts");
        expect(catalog).toContain("/team/portal-accounts");
        expect(catalog).toContain("Create Products");
        expect(catalog).toContain("/team/products/new");
    });

    it("links the other staff surfaces so the hub is the single way in", () => {
        expect(catalog).toContain("Executive Hub");
        expect(catalog).toContain("/executive");
        expect(catalog).toContain("Grace Workspace");
        expect(catalog).toContain("/grace-workspace");
    });

    it("does not expose the Convex Dashboard link", () => {
        expect(catalog).not.toContain("Convex Dashboard");
        expect(catalog).not.toContain("https://dashboard.convex.dev");
        expect(source).not.toContain("Convex Dashboard");
        expect(source).not.toContain("https://dashboard.convex.dev");
    });

    it("does not silently bounce signed-in users back to the storefront", () => {
        expect(source).not.toContain('redirect("/")');
        expect(source).toContain("Team Hub access pending");
    });

    it("aliases /team/new to the Create Products desk", () => {
        const alias = readFileSync(resolve(process.cwd(), "src/app/team/new/page.tsx"), "utf8");
        expect(alias).toContain("/team/products/new");
        expect(alias).toContain("redirect");
    });

    it("lets a denied signed-in user switch to a team email", () => {
        expect(source).toContain("SwitchAccountButton");
        expect(source).toContain("Use another team email");
    });
});
