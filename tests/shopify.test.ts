/**
 * Shopify Utilities — Unit Tests
 *
 * Tests checkout URL building, domain parsing, and edge cases
 * that directly affect the purchase flow.
 */

import { describe, expect, it, vi, beforeEach, afterAll } from "vitest";
import { buildCheckoutUrl, getShopifyDomain, type CheckoutLineItem } from "../src/lib/shopify";

// ─── getShopifyDomain ───────────────────────────────────────────────────────

describe("getShopifyDomain", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    it("returns raw domain when no protocol", () => {
        process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN = "best-bottles.myshopify.com";
        expect(getShopifyDomain()).toBe("best-bottles.myshopify.com");
    });

    it("strips https:// prefix", () => {
        process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN = "https://best-bottles.myshopify.com";
        expect(getShopifyDomain()).toBe("best-bottles.myshopify.com");
    });

    it("strips http:// prefix", () => {
        process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN = "http://best-bottles.myshopify.com";
        expect(getShopifyDomain()).toBe("best-bottles.myshopify.com");
    });

    it("strips trailing slash", () => {
        process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN = "best-bottles.myshopify.com/";
        expect(getShopifyDomain()).toBe("best-bottles.myshopify.com");
    });

    it("strips both protocol and trailing slash", () => {
        process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN = "https://best-bottles.myshopify.com/";
        expect(getShopifyDomain()).toBe("best-bottles.myshopify.com");
    });

    it("returns empty string when env var is not set", () => {
        delete process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
        expect(getShopifyDomain()).toBe("");
    });

    afterAll(() => {
        process.env = originalEnv;
    });
});

// ─── buildCheckoutUrl ───────────────────────────────────────────────────────

describe("buildCheckoutUrl", () => {
    beforeEach(() => {
        process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN = "best-bottles.myshopify.com";
    });

    it("builds URL for a single item", () => {
        const items: CheckoutLineItem[] = [{ variantId: "12345", quantity: 1 }];
        const url = buildCheckoutUrl(items);
        expect(url).toBe("https://best-bottles.myshopify.com/cart/12345:1");
    });

    it("builds URL for multiple items", () => {
        const items: CheckoutLineItem[] = [
            { variantId: "11111", quantity: 2 },
            { variantId: "22222", quantity: 5 },
            { variantId: "33333", quantity: 144 },
        ];
        const url = buildCheckoutUrl(items);
        expect(url).toBe("https://best-bottles.myshopify.com/cart/11111:2,22222:5,33333:144");
    });

    it("handles empty items array", () => {
        const url = buildCheckoutUrl([]);
        expect(url).toBe("https://best-bottles.myshopify.com/cart/");
    });

    it("handles large B2B quantities", () => {
        const items: CheckoutLineItem[] = [{ variantId: "99999", quantity: 5000 }];
        const url = buildCheckoutUrl(items);
        expect(url).toBe("https://best-bottles.myshopify.com/cart/99999:5000");
    });

    it("preserves variant ID as string (not parsed as number)", () => {
        // Shopify variant IDs can be very large — must stay as string
        const items: CheckoutLineItem[] = [{ variantId: "49876543210987", quantity: 1 }];
        const url = buildCheckoutUrl(items);
        expect(url).toContain("49876543210987:1");
    });
});

// ─── UX-critical: checkout flow scenarios ───────────────────────────────────

describe("UX: checkout flow scenarios", () => {
    beforeEach(() => {
        process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN = "best-bottles.myshopify.com";
    });

    it("typical B2B order: 3 products at volume quantities", () => {
        const items: CheckoutLineItem[] = [
            { variantId: "40001", quantity: 144 },  // 1 gross of bottles
            { variantId: "40002", quantity: 144 },  // matching closures
            { variantId: "40003", quantity: 10 },   // sample components
        ];
        const url = buildCheckoutUrl(items);
        expect(url).toMatch(/^https:\/\/best-bottles\.myshopify\.com\/cart\//);
        expect(url).toContain("40001:144");
        expect(url).toContain("40002:144");
        expect(url).toContain("40003:10");
    });

    it("single sample order", () => {
        const items: CheckoutLineItem[] = [{ variantId: "50001", quantity: 1 }];
        const url = buildCheckoutUrl(items);
        expect(url).toMatch(/\/cart\/50001:1$/);
    });
});
