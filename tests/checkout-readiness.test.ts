import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
    checkoutUnavailableMessage,
    isCheckoutReady,
    quoteOnlyCartMessage,
    removeBlockedCheckoutItems,
    splitCheckoutItems,
    unavailableCheckoutMessage,
    unmatchedCheckoutMessage,
} from "../src/lib/checkout";

describe("checkout readiness helpers", () => {
    it("treats explicit eligibility or a stored Shopify variant ID as checkout-ready", () => {
        expect(isCheckoutReady({ graceSku: "A", checkoutEligible: true })).toBe(true);
        expect(isCheckoutReady({ graceSku: "B", checkoutEligible: false })).toBe(false);
        expect(isCheckoutReady({ graceSku: "C" })).toBe(false);
        expect(isCheckoutReady({ graceSku: "D", shopifyVariantId: "gid://shopify/ProductVariant/123" })).toBe(true);
        expect(isCheckoutReady({ graceSku: "E", checkoutEligible: false, shopifyVariantId: "gid://shopify/ProductVariant/456" })).toBe(true);
    });

    it("splits verified checkout items from quote-only items", () => {
        const result = splitCheckoutItems([
            { graceSku: "READY", checkoutEligible: true },
            { graceSku: "STORED_ID", shopifyVariantId: "gid://shopify/ProductVariant/123" },
            { graceSku: "QUOTE", checkoutEligible: false },
            { graceSku: "UNKNOWN" },
        ]);

        expect(result.checkoutReadyItems.map((i) => i.graceSku)).toEqual(["READY", "STORED_ID"]);
        expect(result.quoteOnlyItems.map((i) => i.graceSku)).toEqual(["QUOTE", "UNKNOWN"]);
    });

    it("removes quote-only or unresolved SKUs once Shopify can open for verified items", () => {
        const result = removeBlockedCheckoutItems(
            [
                { graceSku: "READY", checkoutEligible: true },
                { graceSku: "QUOTE", checkoutEligible: false },
                { graceSku: "UNMATCHED", checkoutEligible: true },
            ],
            ["QUOTE", "UNMATCHED"],
        );

        expect(result.map((i) => i.graceSku)).toEqual(["READY"]);
    });

    it("keeps checkout failure messages buyer-oriented", () => {
        expect(quoteOnlyCartMessage(["A"])).toContain("need a quote");
        expect(unmatchedCheckoutMessage(["A", "B"])).toContain("Shopify could not match");
        expect(unavailableCheckoutMessage(["A"])).toContain("unavailable for online checkout");
        expect(checkoutUnavailableMessage()).toContain("Request Quote");
    });
});

describe("checkout buying-path guardrails", () => {
    it("has a real /cart page with a direct checkout CTA", () => {
        const cartPage = readFileSync("src/app/cart/page.tsx", "utf8");

        expect(cartPage).toContain("Your Cart");
        expect(cartPage).toContain("cart-page-checkout-button");
        expect(cartPage).not.toContain("Request Quote for This Cart");
        expect(cartPage).toContain("Quote required before checkout");
    });

    it("gates PDP add-to-cart on verified Shopify checkout eligibility", () => {
        const pdp = readFileSync("src/app/products/[slug]/ProductDetailClient.tsx", "utf8");

        // Must go through the shared helper so the Shopify sellability flag is
        // honoured — a raw Boolean(shopifyVariantId) check lets DRAFT products
        // through to a 410 checkout.
        expect(pdp).toContain("isCheckoutReady({");
        expect(pdp).toContain("shopifySellable: selectedVariant.shopifySellable");
        expect(pdp).not.toContain("const checkoutReady = Boolean(selectedVariant?.shopifyVariantId)");
        expect(pdp).toContain("const canAddToCart = inStock && checkoutReady");
        expect(pdp).toContain('data-testid="pdp-request-quote-primary"');
        expect(pdp).toContain("checkoutEligible: checkoutReady");
    });

    it("labels spray variants from the applicator/SKU instead of stale capStyle data", () => {
        const pdp = readFileSync("src/app/products/[slug]/ProductDetailClient.tsx", "utf8");

        expect(pdp).toContain("function getVariantOptionPrefix");
        expect(pdp).toContain('sku.includes("-SPR-") || applicator.includes("spray")');
        expect(pdp).toContain('return "Spray"');
        expect(pdp).toContain("getVariantOptionPrefix(v)");
    });

    it("keeps the Shopify SKU audit read-only", () => {
        const auditScript = readFileSync("scripts/audit_shopify_sku_mapping.mjs", "utf8");

        expect(auditScript).toContain("Read-only Shopify");
        expect(auditScript).toContain("No writes were performed");
        expect(auditScript).not.toContain("ctx.db.patch");
        expect(auditScript).not.toContain("convex.mutation");
        expect(auditScript).not.toContain("mutation(");
    });

    it("carries stored Shopify variant IDs from cart to checkout before SKU fallback", () => {
        const cartProvider = readFileSync("src/components/CartProvider.tsx", "utf8");
        const route = readFileSync("src/app/api/shopify/resolve-variants/route.ts", "utf8");

        expect(cartProvider).toContain("shopifyVariantId: i.shopifyVariantId");
        expect(cartProvider).toContain("Boolean(shopifyVariantId) || item.checkoutEligible === true");
        // Sellability must veto a stale variant ID rather than the other way round.
        expect(cartProvider).toContain("shopifySellable === false");
        expect(route).toContain("normalizeShopifyVariantId(item.shopifyVariantId)");
        expect(route).toContain("resolveCheckoutVariantsByIds");
        expect(route).toContain("const directCheckoutItems = matchingDirectItems.flatMap");
        expect(route).toContain("const fallbackItems = requestedItems.filter((item) => !matchingDirectItems.includes(item))");
        expect(route).toContain("const checkoutItems = [...directCheckoutItems, ...resolvedCheckoutItems]");
    });
});
