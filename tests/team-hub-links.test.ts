import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Team Hub links", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/team/page.tsx"), "utf8");

    it("links to Best Bottles Packaging Studio", () => {
        expect(source).toContain("Best Bottles Packaging Studio");
        expect(source).toContain("https://best-bottles-packaging-studio.vercel.app/");
    });

    it("links to the backend Shopify admin", () => {
        expect(source).toContain("Backend Shopify Admin");
        expect(source).toContain("https://admin.shopify.com");
    });

    it("does not expose the Convex Dashboard link", () => {
        expect(source).not.toContain("Convex Dashboard");
        expect(source).not.toContain("https://dashboard.convex.dev");
    });

    it("does not silently bounce signed-in users back to the storefront", () => {
        expect(source).not.toContain('redirect("/")');
        expect(source).toContain("Team Hub access pending");
    });

    it("lets a denied signed-in user switch to a team email", () => {
        expect(source).toContain("SwitchAccountButton");
        expect(source).toContain("Use another team email");
    });
});
