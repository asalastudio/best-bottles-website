/**
 * Wholesale checkout via draft orders.
 *
 * Two failures matter here. One is silent overcharging — a draft order that
 * forgets the customer, so an approved certificate never applies. The other is
 * far worse: letting a browser dictate `priceOverride`, which is the price the
 * buyer is actually charged.
 */

import { describe, expect, it, vi, beforeEach, afterAll } from "vitest";
import {
    createWholesaleDraftOrder,
    DraftOrderScopeError,
} from "../src/lib/shopify-draft-orders";

const originalFetch = global.fetch;
const originalEnv = process.env;

beforeEach(() => {
    process.env = {
        ...originalEnv,
        NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN: "bestbottles-1580.myshopify.com",
        SHOPIFY_ADMIN_TOKEN: "test-token",
    };
});

afterAll(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
});

function mockDraftOrder(overrides: Record<string, unknown> = {}, userErrors: unknown[] = []) {
    const fetchMock = vi.fn().mockResolvedValue(
        new Response(
            JSON.stringify({
                data: {
                    draftOrderCreate: {
                        draftOrder: userErrors.length
                            ? null
                            : {
                                  id: "gid://shopify/DraftOrder/55",
                                  name: "#D55",
                                  invoiceUrl: "https://bestbottles-1580.myshopify.com/invoice/abc",
                                  totalPriceSet: { shopMoney: { amount: "500.00", currencyCode: "USD" } },
                                  totalTaxSet: { shopMoney: { amount: "0.00" } },
                                  ...overrides,
                              },
                        userErrors,
                    },
                },
            }),
            { status: 200 },
        ),
    );
    global.fetch = fetchMock;
    return fetchMock;
}

const LINES = [{ variantId: "111", quantity: 12 }];

function sentInput(fetchMock: ReturnType<typeof vi.fn>) {
    return JSON.parse(fetchMock.mock.calls[0][1].body as string).variables.input;
}

describe("createWholesaleDraftOrder", () => {
    it("attaches the customer as the purchasing entity", async () => {
        const fetchMock = mockDraftOrder();
        await createWholesaleDraftOrder({ customerId: "99", lines: LINES });

        expect(sentInput(fetchMock).purchasingEntity).toEqual({
            customerId: "gid://shopify/Customer/99",
        });
    });

    it("defers tax to the customer record rather than forcing exemption", async () => {
        const fetchMock = mockDraftOrder();
        await createWholesaleDraftOrder({ customerId: "99", lines: LINES });

        // taxExempt:true here would exempt EVERY portal order, approved or not.
        expect(sentInput(fetchMock).taxExempt).toBe(false);
    });

    it("omits priceOverride when no server-derived price is supplied", async () => {
        const fetchMock = mockDraftOrder();
        await createWholesaleDraftOrder({ customerId: "99", lines: LINES });

        expect(sentInput(fetchMock).lineItems[0]).toEqual({
            variantId: "gid://shopify/ProductVariant/111",
            quantity: 12,
        });
    });

    it("sends priceOverride only when a price is explicitly provided", async () => {
        const fetchMock = mockDraftOrder();
        await createWholesaleDraftOrder({
            customerId: "99",
            lines: [{ variantId: "111", quantity: 12, unitPrice: 0.69 }],
        });

        expect(sentInput(fetchMock).lineItems[0].priceOverride).toEqual({
            amount: "0.69",
            currencyCode: "USD",
        });
    });

    it("tags the order with the account so staff can find it", async () => {
        const fetchMock = mockDraftOrder();
        await createWholesaleDraftOrder({
            customerId: "99",
            lines: LINES,
            accountNumber: "BB-1001",
            companyName: "ASALA",
        });

        const input = sentInput(fetchMock);
        expect(input.tags).toEqual(["best-bottles-portal", "account:BB-1001"]);
        expect(input.note).toContain("ASALA");
    });

    it("returns the invoice URL the buyer pays against", async () => {
        mockDraftOrder();
        const draft = await createWholesaleDraftOrder({ customerId: "99", lines: LINES });

        expect(draft.invoiceUrl).toBe("https://bestbottles-1580.myshopify.com/invoice/abc");
        expect(draft.name).toBe("#D55");
    });

    it("fails rather than redirecting nowhere when there is no invoice URL", async () => {
        mockDraftOrder({ invoiceUrl: null });
        await expect(
            createWholesaleDraftOrder({ customerId: "99", lines: LINES }),
        ).rejects.toThrow(/no invoice URL/i);
    });

    it("refuses an empty cart", async () => {
        const fetchMock = mockDraftOrder();
        await expect(
            createWholesaleDraftOrder({ customerId: "99", lines: [] }),
        ).rejects.toThrow(/requires_line_items/);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("surfaces userErrors", async () => {
        mockDraftOrder({}, [{ field: ["lineItems"], message: "Variant is unavailable" }]);
        await expect(
            createWholesaleDraftOrder({ customerId: "99", lines: LINES }),
        ).rejects.toThrow(/Variant is unavailable/);
    });

    it("maps a scope denial to DraftOrderScopeError", async () => {
        global.fetch = vi.fn().mockResolvedValue(new Response("Access denied", { status: 403 }));
        await expect(
            createWholesaleDraftOrder({ customerId: "99", lines: LINES }),
        ).rejects.toBeInstanceOf(DraftOrderScopeError);
    });
});
