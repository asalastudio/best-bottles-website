import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveFocusedPdpCapabilities } from "../src/lib/products/focused-pdp-rollout";

describe("focused PDP purchasability recovery", () => {
    it("renders real variants with no optional media as purchasable", () => {
        expect(resolveFocusedPdpCapabilities({
            hasVariants: true, hasApprovedPhoto: false, hasPlate: false,
            hasApproved3d: false, hasReleasedKit: false, hasDimensions: false,
        }).isPurchasable).toBe(true);
    });

    it("routes zero valid variants to the unavailable recovery surface before purchase UI", () => {
        const source = readFileSync(new URL("../src/app/products/[slug]/ProductDetailClient.tsx", import.meta.url), "utf8");
        expect(source).toContain("if (!focusedPdpCapabilities.isPurchasable)");
        expect(source).toContain('data-testid="pdp-unavailable-state"');
        const unavailable = source.slice(source.indexOf('data-testid="pdp-unavailable-state"'), source.indexOf("const inStock"));
        expect(unavailable).toContain("Ask Grace");
        expect(unavailable).not.toContain("Quantity");
        expect(unavailable).not.toContain("Request Quote");
        expect(unavailable).not.toContain("pdp-sticky-cart-bar");
    });
});
