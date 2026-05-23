import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
    checkoutUnavailableMessage,
    isCheckoutReady,
    quoteOnlyCartMessage,
    splitCheckoutItems,
    unavailableCheckoutMessage,
    unmatchedCheckoutMessage,
} from "../src/lib/checkout";

describe("checkout readiness helpers", () => {
    it("only treats explicitly verified items as checkout-ready", () => {
        expect(isCheckoutReady({ graceSku: "A", checkoutEligible: true })).toBe(true);
        expect(isCheckoutReady({ graceSku: "B", checkoutEligible: false })).toBe(false);
        expect(isCheckoutReady({ graceSku: "C" })).toBe(false);
    });

    it("splits verified checkout items from quote-only items", () => {
        const result = splitCheckoutItems([
            { graceSku: "READY", checkoutEligible: true },
            { graceSku: "QUOTE", checkoutEligible: false },
            { graceSku: "UNKNOWN" },
        ]);

        expect(result.checkoutReadyItems.map((i) => i.graceSku)).toEqual(["READY"]);
        expect(result.quoteOnlyItems.map((i) => i.graceSku)).toEqual(["QUOTE", "UNKNOWN"]);
    });

    it("keeps checkout failure messages buyer-oriented", () => {
        expect(quoteOnlyCartMessage(["A"])).toContain("need a quote");
        expect(unmatchedCheckoutMessage(["A", "B"])).toContain("Shopify could not match");
        expect(unavailableCheckoutMessage(["A"])).toContain("unavailable for online checkout");
        expect(checkoutUnavailableMessage()).toContain("Request Quote");
    });
});

describe("checkout buying-path guardrails", () => {
    it("has a real /cart page with quote and checkout CTAs", () => {
        const cartPage = readFileSync("src/app/cart/page.tsx", "utf8");

        expect(cartPage).toContain("Your Cart");
        expect(cartPage).toContain("cart-page-checkout-button");
        expect(cartPage).toContain("Request Quote for This Cart");
        expect(cartPage).toContain("Quote required before checkout");
    });

    it("gates PDP add-to-cart on verified Shopify checkout eligibility", () => {
        const pdp = readFileSync("src/app/products/[slug]/page.tsx", "utf8");

        expect(pdp).toContain("const checkoutReady = Boolean(selectedVariant?.shopifyVariantId)");
        expect(pdp).toContain("const canAddToCart = inStock && checkoutReady");
        expect(pdp).toContain('data-testid="pdp-request-quote-primary"');
        expect(pdp).toContain("checkoutEligible: checkoutReady");
    });

    it("labels spray variants from the applicator/SKU instead of stale capStyle data", () => {
        const pdp = readFileSync("src/app/products/[slug]/page.tsx", "utf8");

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
});
