import { afterEach, describe, expect, it, vi } from "vitest";
import { elegant, elegantBoundaries } from "./fixtures/elegant-tier-pricing";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

for (const honored of [false, true]) {
    describe(`purchase pricing with checkout tiers ${honored ? "enabled" : "disabled"}`, () => {
        it.each(elegantBoundaries)("keeps PDP and cart consistent at quantity %i", async (quantity, publishedRate) => {
            vi.stubEnv("NEXT_PUBLIC_VOLUME_TIERS_HONORED_AT_CHECKOUT", String(honored));
            const { unitPriceAt } = await import("@/lib/products/pdp-redesign/model");
            const { resolveUnitPrice } = await import("@/components/CartProvider");
            const { resolveQuotedUnitPrice } = await import("@/lib/volumePricing");
            expect(resolveQuotedUnitPrice(quantity, elegant)).toBe(publishedRate);
            expect(unitPriceAt(elegant, quantity)).toBe(honored ? publishedRate : 0.88);
            expect(resolveUnitPrice(quantity, elegant)).toBe(honored ? publishedRate : 0.88);
        });
    });
}
