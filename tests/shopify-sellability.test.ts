import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isCheckoutReady, splitCheckoutItems } from "../src/lib/checkout";
import { resolveChargedUnitPrice, resolveQuotedUnitPrice, VOLUME_TIERS_HONORED_AT_CHECKOUT } from "../src/lib/volumePricing";

/**
 * Regression guards for the 2026-07-29 launch audit findings:
 *
 *  1. 377 production SKUs carried a shopifyVariantId while their parent
 *     Shopify product was DRAFT/unpublished. `/cart/<id>:1` returns HTTP 410
 *     for those — the storefront must route them to the quote path.
 *  2. 2,252 SKUs rendered a volume-discount ladder that Shopify's cart
 *     permalink does not honor (verified: qty 10 of PKG-BOX-WHT-4X4X4
 *     advertised $2.30, Shopify charged $3.50).
 */
describe("Shopify sellability gate", () => {
    it("blocks checkout when Shopify reports the variant as not sellable", () => {
        expect(
            isCheckoutReady({
                graceSku: "DRAFT_PRODUCT",
                shopifyVariantId: "gid://shopify/ProductVariant/53343606112548",
                shopifySellable: false,
            }),
        ).toBe(false);
    });

    it("lets a sellable variant through", () => {
        expect(
            isCheckoutReady({
                graceSku: "LIVE",
                shopifyVariantId: "gid://shopify/ProductVariant/53343616598308",
                shopifySellable: true,
            }),
        ).toBe(true);
    });

    it("falls back to legacy behaviour when sellability has never been synced", () => {
        expect(
            isCheckoutReady({ graceSku: "UNSYNCED", shopifyVariantId: "gid://shopify/ProductVariant/1" }),
        ).toBe(true);
        expect(isCheckoutReady({ graceSku: "UNSYNCED_NO_ID" })).toBe(false);
    });

    it("sellable=false overrides an explicit checkoutEligible=true", () => {
        expect(
            isCheckoutReady({ graceSku: "X", checkoutEligible: true, shopifySellable: false }),
        ).toBe(false);
    });

    it("routes not-sellable items into the quote-only bucket", () => {
        const { checkoutReadyItems, quoteOnlyItems } = splitCheckoutItems([
            { graceSku: "OK", shopifyVariantId: "gid://1", shopifySellable: true },
            { graceSku: "DRAFT", shopifyVariantId: "gid://2", shopifySellable: false },
        ]);
        expect(checkoutReadyItems.map((i) => i.graceSku)).toEqual(["OK"]);
        expect(quoteOnlyItems.map((i) => i.graceSku)).toEqual(["DRAFT"]);
    });
});

describe("volume pricing honesty", () => {
    const prices = { webPrice1pc: 0.35, webPrice10pc: 0.23, webPrice12pc: null };

    it("defaults to NOT claiming Shopify honors quantity breaks", () => {
        expect(VOLUME_TIERS_HONORED_AT_CHECKOUT).toBe(false);
    });

    it("charges the flat 1pc price so the cart subtotal matches Shopify", () => {
        // The real failure: 10 units advertised at $2.30, Shopify charged $3.50.
        expect(resolveChargedUnitPrice(10, prices)).toBe(0.35);
        expect((resolveChargedUnitPrice(10, prices) ?? 0) * 10).toBeCloseTo(3.5, 2);
    });

    it("still exposes the quoted tier price for display", () => {
        expect(resolveQuotedUnitPrice(10, prices)).toBe(0.23);
        expect(resolveQuotedUnitPrice(1, prices)).toBe(0.35);
    });

    it("labels the PDP ladder as quote pricing while tiers are unhonored", () => {
        const pdp = readFileSync("src/app/products/[slug]/ProductDetailClient.tsx", "utf8");
        expect(pdp).toContain("VOLUME_TIERS_HONORED_AT_CHECKOUT");
        expect(pdp).toContain("Volume Pricing · By Quote");
        expect(pdp).toContain("online checkout is billed at");
    });

    it("keeps the cart subtotal on the charged-price path", () => {
        const cart = readFileSync("src/components/CartProvider.tsx", "utf8");
        expect(cart).toContain("resolveChargedUnitPrice");
    });
});

describe("sellability sync script safety", () => {
    it("defaults to a dry run and never writes to Shopify", () => {
        const script = readFileSync("scripts/sync_shopify_sellability.mjs", "utf8");
        expect(script).toContain('const APPLY = process.argv.includes("--apply")');
        expect(script).toContain("DRY RUN — nothing written");
        expect(script).toContain("It changes NOTHING in Shopify");
        // read-only against Shopify: no mutations in the GraphQL it sends
        expect(script).not.toContain("productUpdate");
        expect(script).not.toContain("publishablePublish");
    });

    it("guards the Convex write behind the write token", () => {
        const products = readFileSync("convex/products.ts", "utf8");
        expect(products).toContain("export const setShopifySellabilityBatch");
        expect(products).toContain("verifyProductImageWriteToken(args.writeToken)");
    });
});
