// @vitest-environment edge-runtime
/// <reference types="vite/client" />
/**
 * Shopify order history sync.
 *
 * The risks this guards are a customer seeing the wrong orders and a customer
 * seeing the same order several times. So the assertions concentrate on who an
 * order is attached to, what a redelivered webhook does, and whether a later
 * QuickBooks backfill can be trampled by a Shopify replay.
 */

import { convexTest } from "convex-test";
import { describe, expect, it, beforeEach } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { orderStatusFromShopify } from "../src/lib/shopify-webhooks";

const modules = import.meta.glob("../convex/**/*.ts");

const WRITE_TOKEN = "test-write-token";
const ORG = "org_lumiere";
const SHOPIFY_CUSTOMER = "23991044800804";

beforeEach(() => {
    process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN = WRITE_TOKEN;
});

async function seedAccount(t: ReturnType<typeof convexTest>, shopifyCustomerId?: string) {
    await t.mutation(api.portal.upsertPortalAccount, {
        writeToken: WRITE_TOKEN,
        clerkOrgId: ORG,
        companyName: "Lumière Atelier",
        accountNumber: "BB-1001",
        tier: "The Scaler",
        accountManager: "Aamir Nemat",
        netTerms: "Net 30",
        taxExempt: false,
        memberSince: "January 2026",
    });
    // The Shopify customer is attached through the identity bridge, which is
    // the same path production uses — not by writing the field directly.
    if (shopifyCustomerId) {
        await t.mutation(api.portal.linkShopifyCustomer, {
            writeToken: WRITE_TOKEN,
            clerkOrgId: ORG,
            shopifyCustomerId,
            billingEmail: "buyer@lumiere.test",
        });
    }
}

function order(t: ReturnType<typeof convexTest>, overrides: Record<string, unknown> = {}) {
    return t.mutation(api.portal.upsertOrderFromShopify, {
        writeToken: WRITE_TOKEN,
        shopifyOrderId: "10577681285412",
        shopifyCustomerId: SHOPIFY_CUSTOMER,
        orderName: "#1003",
        orderDate: 1_700_000_000_000,
        status: "processing",
        lineItems: [{ sku: "GB-ELG-30", description: "Elegant 30ml", quantity: 500, unitPrice: 0.64 }],
        totalAmount: 320,
        ...overrides,
    });
}

describe("status mapping", () => {
    it("lets cancellation win over a shipped fulfilment", () => {
        expect(orderStatusFromShopify({
            cancelled_at: "2026-05-08T00:00:00Z",
            fulfillment_status: "fulfilled",
            fulfillments: [{ shipment_status: "delivered", tracking_company: null, tracking_number: null }],
        })).toBe("cancelled");
    });

    it("only reads delivered when every shipment is delivered", () => {
        const base = { cancelled_at: null, fulfillment_status: "fulfilled" };
        expect(orderStatusFromShopify({ ...base, fulfillments: [
            { shipment_status: "delivered", tracking_company: null, tracking_number: null },
            { shipment_status: "in_transit", tracking_company: null, tracking_number: null },
        ] })).toBe("in_transit");
        expect(orderStatusFromShopify({ ...base, fulfillments: [
            { shipment_status: "delivered", tracking_company: null, tracking_number: null },
        ] })).toBe("delivered");
    });

    it("treats an unfulfilled order as processing", () => {
        expect(orderStatusFromShopify({
            cancelled_at: null, fulfillment_status: null, fulfillments: [],
        })).toBe("processing");
    });
});

describe("upsertOrderFromShopify", () => {
    it("refuses a mutation without the shared token", async () => {
        const t = convexTest(schema, modules);
        await expect(order(t, { writeToken: "wrong" })).rejects.toThrow(/unauthorized_convex_write/);
    });

    it("attaches the order to the org that owns the Shopify customer", async () => {
        const t = convexTest(schema, modules);
        await seedAccount(t, SHOPIFY_CUSTOMER);
        const result = await order(t);
        expect(result).toMatchObject({ created: true });

        const rows = await t.query(api.portal.listOrdersByOrg, { clerkOrgId: ORG });
        expect(rows).toHaveLength(1);
        expect(rows[0].orderId).toBe("#1003");
    });

    it("skips a retail order with no portal account behind it", async () => {
        const t = convexTest(schema, modules);
        await seedAccount(t, "some-other-customer");
        expect(await order(t)).toMatchObject({ skipped: "no_portal_account" });
        expect(await t.query(api.portal.listOrdersByOrg, { clerkOrgId: ORG })).toHaveLength(0);
    });

    it("skips a guest checkout with no customer at all", async () => {
        const t = convexTest(schema, modules);
        await seedAccount(t, SHOPIFY_CUSTOMER);
        expect(await order(t, { shopifyCustomerId: undefined })).toMatchObject({ skipped: "no_customer" });
    });

    it("patches on redelivery instead of duplicating the order", async () => {
        const t = convexTest(schema, modules);
        await seedAccount(t, SHOPIFY_CUSTOMER);
        await order(t);
        const second = await order(t, { status: "in_transit", trackingNumber: "794622836420", carrier: "FedEx" });
        expect(second).toMatchObject({ updated: true });

        const rows = await t.query(api.portal.listOrdersByOrg, { clerkOrgId: ORG });
        expect(rows).toHaveLength(1);
        expect(rows[0].status).toBe("in_transit");
        expect(rows[0].trackingNumber).toBe("794622836420");
    });

    it("leaves a QuickBooks-sourced row alone", async () => {
        const t = convexTest(schema, modules);
        await seedAccount(t, SHOPIFY_CUSTOMER);
        await t.run(async (ctx) => {
            await ctx.db.insert("portalOrders", {
                clerkOrgId: ORG,
                orderId: "QB-77",
                lineItems: [],
                status: "delivered",
                orderDate: 1_600_000_000_000,
                source: "quickbooks",
                shopifyOrderId: "10577681285412",
            });
        });

        expect(await order(t)).toMatchObject({ skipped: "owned_by_quickbooks" });
        const rows = await t.query(api.portal.listOrdersByOrg, { clerkOrgId: ORG });
        expect(rows).toHaveLength(1);
        expect(rows[0].orderId).toBe("QB-77");
    });
});
