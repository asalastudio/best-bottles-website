/**
 * Pending-window order lookup.
 *
 * This drives a refund decision, so the failure that matters is over- or
 * under-stating the tax a customer paid while waiting for review.
 */

import { describe, expect, it, vi, beforeEach, afterAll } from "vitest";
import { listTaxedOrdersForEmailSince } from "../src/lib/shopify-orders";

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

function mockOrders(nodes: unknown[]) {
    const fetchMock = vi.fn().mockResolvedValue(
        new Response(
            JSON.stringify({ data: { orders: { edges: nodes.map((node) => ({ node })) } } }),
            { status: 200 },
        ),
    );
    global.fetch = fetchMock;
    return fetchMock;
}

function order(name: string, tax: string, total = "500.00", refunded = "0.00") {
    return {
        id: `gid://shopify/Order/${name.replace("#", "")}`,
        name,
        createdAt: "2026-08-20T10:00:00Z",
        totalTaxSet: { shopMoney: { amount: tax, currencyCode: "USD" } },
        totalPriceSet: { shopMoney: { amount: total } },
        totalRefundedSet: { shopMoney: { amount: refunded } },
    };
}

const SINCE = new Date("2026-08-15T00:00:00Z").getTime();

describe("listTaxedOrdersForEmailSince", () => {
    it("sums the tax across the window", async () => {
        mockOrders([order("#1001", "84.20"), order("#1002", "63.00")]);

        const result = await listTaxedOrdersForEmailSince("buyer@x.com", SINCE);

        expect(result.orders).toHaveLength(2);
        expect(result.taxTotal).toBeCloseTo(147.2, 2);
        expect(result.currencyCode).toBe("USD");
    });

    it("drops untaxed orders rather than listing them at zero", async () => {
        mockOrders([order("#1001", "84.20"), order("#1002", "0.00")]);

        const result = await listTaxedOrdersForEmailSince("buyer@x.com", SINCE);

        expect(result.orders.map((o) => o.name)).toEqual(["#1001"]);
        expect(result.taxTotal).toBeCloseTo(84.2, 2);
    });

    it("scopes the search to the submission date and the account's email", async () => {
        const fetchMock = mockOrders([]);
        await listTaxedOrdersForEmailSince("Buyer@X.com", SINCE);

        const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
        expect(body.variables.query).toBe('email:"buyer@x.com" AND created_at:>=2026-08-15');
    });

    it("returns nothing, and calls nothing, without a billing email", async () => {
        // An account with no billing email cannot be matched to any order, and
        // a broad query would attribute strangers' tax to it.
        const fetchMock = mockOrders([]);

        expect(await listTaxedOrdersForEmailSince(null, SINCE)).toEqual({
            orders: [],
            taxTotal: 0,
            currencyCode: "USD",
        });
        expect(await listTaxedOrdersForEmailSince("not-an-email", SINCE)).toMatchObject({
            taxTotal: 0,
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("surfaces what has already been refunded so tax is not returned twice", async () => {
        mockOrders([order("#1001", "84.20", "500.00", "84.20")]);

        const result = await listTaxedOrdersForEmailSince("buyer@x.com", SINCE);
        expect(result.orders[0].alreadyRefunded).toBeCloseTo(84.2, 2);
    });
});
