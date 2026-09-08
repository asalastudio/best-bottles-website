import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { checkoutMinimum } from "../src/lib/checkout";
const mocks = vi.hoisted(() => ({ direct: vi.fn(), fallback: vi.fn(), wholesale: vi.fn(), url: vi.fn() }));
vi.mock("@/lib/graceRateLimitServer", () => ({ enforceGraceRateLimit: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/portal/wholesaleCheckout", () => ({ resolveWholesaleCheckoutUrl: mocks.wholesale }));
vi.mock("@/lib/shopify", () => ({
    normalizeShopifyVariantId: (id: string) => id || null,
    resolveCheckoutVariantsByIds: mocks.direct, resolveVariantsBySkus: mocks.fallback, buildCheckoutUrl: mocks.url,
}));
import { POST } from "../src/app/api/shopify/resolve-variants/route";
import { NextRequest } from "next/server";
const line = (graceSku: string, unitPrice: number, quantity = 1) => ({ graceSku, shopifyVariantId: graceSku, unitPrice, quantity });
describe("cart-wide minimum", () => {
    it("combines builds and respects the exact cents boundary", () => {
        expect(checkoutMinimum([line("A", 20), line("B", 30)]).met).toBe(true);
        expect(checkoutMinimum([line("A", 18.6)])).toEqual({ subtotal: 18.6, remaining: 31.4, met: false });
        expect(checkoutMinimum([line("A", 49.99)]).met).toBe(false);
        expect(checkoutMinimum([line("A", .1, 500)]).met).toBe(true);
    });
    it("does not count quote-only, unavailable, or invalid lines", () => {
        expect(checkoutMinimum([{ ...line("A", 50), shopifySellable: false }, { ...line("B", 100), shopifyVariantId: null }, line("C", NaN), line("D", 100, -1)]).subtotal).toBe(0);
    });
});
describe("checkout server minimum", () => {
    afterEach(() => vi.unstubAllEnvs());
    beforeEach(() => {
        vi.clearAllMocks(); vi.stubEnv("SHOPIFY_ADMIN_TOKEN", "test");
        mocks.direct.mockResolvedValue([{ variantId: "1", sku: "A", available: true, price: "20.00" }]);
        mocks.fallback.mockResolvedValue([]); mocks.wholesale.mockResolvedValue(null); mocks.url.mockReturnValue("https://example.com/cart");
    });
    const request = (items: unknown[]) => POST(new NextRequest("http://localhost/api/shopify/resolve-variants", { method: "POST", body: JSON.stringify({ items }) }));
    it("rejects under-minimum checkout before creating any checkout URL", async () => {
        const response = await request([{ sku: "A", shopifyVariantId: "1", quantity: 1, unitPrice: 1000 }]);
        expect(response.status).toBe(422);
        expect((await response.json()).remaining).toBe(30);
        expect(mocks.wholesale).not.toHaveBeenCalled(); expect(mocks.url).not.toHaveBeenCalled();
    });
    it("combines direct and fallback variants using fresh prices", async () => {
        mocks.fallback.mockResolvedValue([{ sku: "B", variantId: "2", available: true, price: "30.00" }]);
        const response = await request([{ sku: "A", shopifyVariantId: "1", quantity: 1 }, { sku: "B", quantity: 1 }]);
        expect(response.status).toBe(200); expect(mocks.url).toHaveBeenCalled();
    });
    it("rechecks the minimum after an unavailable line is removed", async () => {
        mocks.direct.mockResolvedValue([{ variantId: "1", sku: "A", available: true, price: "20" }, { variantId: "2", sku: "B", available: false, price: "40" }]);
        expect((await request([{ sku: "A", shopifyVariantId: "1", quantity: 1 }, { sku: "B", shopifyVariantId: "2", quantity: 1 }])).status).toBe(422);
    });
});
