import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Executive Hub dashboard", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/executive/page.tsx"), "utf8");

    it("presents the Executive Hub as a boss-facing operating dashboard", () => {
        expect(source).toContain("Best Bottles Operating Dashboard");
        expect(source).toContain("Today at a glance");
        expect(source).toContain("Signal board");
        expect(source).toContain("Executive lanes");
    });

    it("keeps the first dashboard panel president-focused and ADHD-friendly", () => {
        expect(source).not.toContain("Board packet");
        expect(source).not.toContain("BOARD PACKET");
        expect(source).toContain("President focus");
        expect(source).toContain("Do next");
        expect(source).toContain("Decision queue");
    });

    it("includes the key executive destinations, including packaging", () => {
        expect(source).toContain("Best Bottles Packaging Studio");
        expect(source).toContain("https://best-bottles-packaging-studio.vercel.app/");
        expect(source).toContain("Sanity Studio");
        expect(source).toContain("Backend Shopify Admin");
        expect(source).toContain("https://admin.shopify.com");
        expect(source).toContain("Vercel Project");
    });

    it("keeps the dashboard grounded in Best Bottles design tokens", () => {
        expect(source).toContain("bg-bone");
        expect(source).toContain("bg-linen");
        expect(source).toContain("text-obsidian");
        expect(source).toContain("border-champagne");
        expect(source).toContain("text-muted-gold");
    });
});
