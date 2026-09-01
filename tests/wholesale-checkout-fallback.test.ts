/**
 * Wholesale checkout fallback.
 *
 * The governing rule of this whole feature is that nothing about tax status may
 * block a purchase. Every failure below must degrade to the anonymous cart — the
 * buyer pays tax they might have avoided, which is recoverable; a broken
 * checkout is not.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const getPortalViewer = vi.fn();
const ensurePortalShopifyCustomer = vi.fn();
vi.mock("../src/lib/portal/server", () => ({
    getPortalViewer: () => getPortalViewer(),
    ensurePortalShopifyCustomer: () => ensurePortalShopifyCustomer(),
}));

const createWholesaleDraftOrder = vi.fn();
vi.mock("@/lib/shopify-draft-orders", () => ({
    createWholesaleDraftOrder: (...a: unknown[]) => createWholesaleDraftOrder(...a),
}));

const convexQuery = vi.fn();
vi.mock("../src/lib/portal/convexClient", () => ({
    getPortalConvex: () => ({ query: convexQuery, mutation: vi.fn() }),
    getPortalConvexWriteToken: () => "test-token",
}));

const { resolveWholesaleCheckoutUrl } = await import("../src/lib/portal/wholesaleCheckout");

const ITEMS = [{ variantId: "111", quantity: 12 }];

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    getPortalViewer.mockResolvedValue({ clerkOrgId: "org_1", clerkUserId: "user_1" });
    ensurePortalShopifyCustomer.mockResolvedValue({
        status: "linked",
        shopifyCustomerId: "99",
        billingEmail: "buyer@x.com",
        created: false,
    });
    convexQuery.mockResolvedValue({ accountNumber: "BB-1001", companyName: "ASALA" });
    createWholesaleDraftOrder.mockResolvedValue({
        invoiceUrl: "https://shop/invoice/abc",
        draftOrderId: "gid://shopify/DraftOrder/55",
        totalTax: "0.00",
    });
});

describe("resolveWholesaleCheckoutUrl", () => {
    it("returns the draft order invoice for a linked wholesale account", async () => {
        const result = await resolveWholesaleCheckoutUrl(ITEMS);
        expect(result?.checkoutUrl).toBe("https://shop/invoice/abc");
    });

    it("never sends browser-supplied prices to Shopify", async () => {
        await resolveWholesaleCheckoutUrl(ITEMS);
        const lines = createWholesaleDraftOrder.mock.calls[0][0].lines;
        // priceOverride is what the buyer is charged; a client value would let
        // anyone set their own price.
        expect(lines[0]).toEqual({ variantId: "111", quantity: 12 });
        expect(lines[0]).not.toHaveProperty("unitPrice");
    });

    it("falls back when the shopper is signed out", async () => {
        getPortalViewer.mockResolvedValue({ clerkOrgId: null, clerkUserId: null });
        expect(await resolveWholesaleCheckoutUrl(ITEMS)).toBeNull();
        expect(createWholesaleDraftOrder).not.toHaveBeenCalled();
    });

    it("falls back when the account has no Shopify customer", async () => {
        ensurePortalShopifyCustomer.mockResolvedValue({
            status: "unavailable",
            reason: "no_billing_email",
        });
        expect(await resolveWholesaleCheckoutUrl(ITEMS)).toBeNull();
    });

    it("falls back when the write scope is missing", async () => {
        ensurePortalShopifyCustomer.mockResolvedValue({
            status: "unavailable",
            reason: "shopify_scope_missing",
        });
        expect(await resolveWholesaleCheckoutUrl(ITEMS)).toBeNull();
    });

    it("falls back when Shopify rejects the draft order", async () => {
        createWholesaleDraftOrder.mockRejectedValue(new Error("Variant is unavailable"));
        expect(await resolveWholesaleCheckoutUrl(ITEMS)).toBeNull();
    });

    it("falls back when identity resolution throws outright", async () => {
        ensurePortalShopifyCustomer.mockRejectedValue(new Error("ECONNRESET"));
        expect(await resolveWholesaleCheckoutUrl(ITEMS)).toBeNull();
    });
});
