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
        sourceUpdatedAt: 100,
        shopifyFulfillmentStatus: null,
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

        const rows = await t.query(api.portal.listOrdersByOrg, { writeToken: WRITE_TOKEN, clerkOrgId: ORG });
        expect(rows).toHaveLength(1);
        expect(rows[0].orderId).toBe("#1003");
    });

    it("skips a retail order with no portal account behind it", async () => {
        const t = convexTest(schema, modules);
        await seedAccount(t, "some-other-customer");
        expect(await order(t)).toMatchObject({ skipped: "no_portal_account" });
        expect(await t.query(api.portal.listOrdersByOrg, { writeToken: WRITE_TOKEN, clerkOrgId: ORG })).toHaveLength(0);
    });

    it("skips a guest checkout with no customer at all", async () => {
        const t = convexTest(schema, modules);
        await seedAccount(t, SHOPIFY_CUSTOMER);
        expect(await order(t, { shopifyCustomerId: undefined })).toMatchObject({ skipped: "no_customer" });
    });

    it("accepts newer source evidence without duplicating the order", async () => {
        const t = convexTest(schema, modules);
        await seedAccount(t, SHOPIFY_CUSTOMER);
        await order(t);
        const second = await order(t, { sourceUpdatedAt: 200, shopifyFulfillmentStatus: "fulfilled", shipments: [{ shopifyFulfillmentId: "f1", sourceUpdatedAt: 200, shipmentStatus: "in_transit", trackingNumber: "794622836420", carrier: "FedEx" }] });
        expect(second).toMatchObject({ updated: true });

        const rows = await t.query(api.portal.listOrdersByOrg, { writeToken: WRITE_TOKEN, clerkOrgId: ORG });
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
        const rows = await t.query(api.portal.listOrdersByOrg, { writeToken: WRITE_TOKEN, clerkOrgId: ORG });
        expect(rows).toHaveLength(1);
        expect(rows[0].orderId).toBe("QB-77");
    });
});

async function saved(t: ReturnType<typeof convexTest>) {
    return t.query(api.portal.getOrderForOrg, { writeToken: WRITE_TOKEN, clerkOrgId: ORG, orderId: "#1003" });
}
const shipment = (sourceUpdatedAt: number, shipmentStatus = "delivered") => ({
    shopifyFulfillmentId: "f1", sourceUpdatedAt, shipmentStatus, fulfillmentStatus: "success",
    trackingNumber: "box-1", packages: [{ trackingNumber: "box-1" }, { trackingNumber: "box-2", trackingUrl: "https://carrier.test/2" }],
});

describe("source ordering and truthful freshness", () => {
    it("ignores exact duplicate and older payloads without refreshing timestamps", async () => {
        const t = convexTest(schema, modules);
        await seedAccount(t, SHOPIFY_CUSTOMER);
        const payload = { sourceUpdatedAt: 200, shopifyFulfillmentStatus: "fulfilled", shipments: [shipment(200)] };
        await order(t, payload);
        const before = await saved(t);
        expect(await order(t, payload)).toMatchObject({ skipped: "stale_or_duplicate" });
        expect(await order(t, { sourceUpdatedAt: 100, totalAmount: 999, shipments: [shipment(100, "label_printed")] }))
            .toMatchObject({ skipped: "stale_or_duplicate" });
        expect(await saved(t)).toEqual(before);
        expect(before).toMatchObject({ status: "delivered", sourceUpdatedAt: 200, totalAmount: 320 });
        expect(before?.shipments[0].packages).toHaveLength(2);
    });

    it("updates a fulfillment independently of the order version and does not regress it in a later order snapshot", async () => {
        const t = convexTest(schema, modules);
        await seedAccount(t, SHOPIFY_CUSTOMER);
        await order(t, { shopifyFulfillmentStatus: "fulfilled", shipments: [shipment(100, "label_printed")] });
        expect((await saved(t))?.status).toBe("label_created");
        await order(t, { shopifyFulfillmentStatus: "fulfilled", shipments: [shipment(300)] });
        expect(await saved(t)).toMatchObject({ status: "delivered", sourceUpdatedAt: 100 });
        await order(t, { sourceUpdatedAt: 200, shopifyFulfillmentStatus: "fulfilled", shipments: [shipment(200, "in_transit")] });
        expect(await saved(t)).toMatchObject({ status: "delivered", sourceUpdatedAt: 200, shipments: [expect.objectContaining({ sourceUpdatedAt: 300 })] });
    });

    it("keeps shipment evidence on a newer order edit with no fulfillment data, but preserves a remaining unfulfilled balance", async () => {
        const t = convexTest(schema, modules);
        await seedAccount(t, SHOPIFY_CUSTOMER);
        await order(t, { shopifyFulfillmentStatus: "fulfilled", shipments: [shipment(100)] });
        await order(t, { sourceUpdatedAt: 200, shopifyFulfillmentStatus: "partial" });
        expect(await saved(t)).toMatchObject({ status: "partially_fulfilled", shipments: [expect.objectContaining({ trackingNumber: "box-1" })] });
    });

    it("keeps cancellation on stale order replay even when carrier evidence advances", async () => {
        const t = convexTest(schema, modules);
        await seedAccount(t, SHOPIFY_CUSTOMER);
        await order(t, { sourceUpdatedAt: 200, shopifyCancelledAt: 200, shipments: [shipment(100)] });
        await order(t, { sourceUpdatedAt: 100, shipments: [shipment(300)] });
        expect(await saved(t)).toMatchObject({ status: "cancelled", sourceUpdatedAt: 200 });
    });

    it("does not interpret an unversioned legacy record as verified delivered", async () => {
        const t = convexTest(schema, modules);
        await seedAccount(t, SHOPIFY_CUSTOMER);
        await t.run((ctx) => ctx.db.insert("portalOrders", {
            clerkOrgId: ORG, orderId: "#1003", lineItems: [], status: "delivered", orderDate: 1,
            source: "shopify", shopifyOrderId: "10577681285412", updatedAt: 900,
        }));
        expect(await saved(t)).toMatchObject({ status: "unknown", sourceUpdatedAt: null });
        expect(await order(t, { sourceUpdatedAt: undefined })).toMatchObject({ skipped: "missing_source_version" });
        await order(t, { sourceUpdatedAt: 200, shopifyFulfillmentStatus: "fulfilled", shipments: [shipment(200)] });
        expect((await saved(t))?.status).toBe("delivered");
    });

    it("uses newer cancellation of a fulfillment and retains all tracking packages in list and detail", async () => {
        const t = convexTest(schema, modules);
        await seedAccount(t, SHOPIFY_CUSTOMER);
        await order(t, { shopifyFulfillmentStatus: "fulfilled", shipments: [shipment(100)] });
        await order(t, { shipments: [{ ...shipment(200), fulfillmentStatus: "cancelled" }] });
        expect(await saved(t)).toMatchObject({ status: "unknown", trackingNumber: null });
        const rows = await t.query(api.portal.listOrdersByOrg, { writeToken: WRITE_TOKEN, clerkOrgId: ORG });
        expect(rows[0]).toMatchObject({ sourceUpdatedAt: 100, shipments: [expect.objectContaining({ fulfillmentStatus: "cancelled", packages: shipment(200).packages })] });
        expect(rows[0].syncedAt).toEqual((await saved(t))?.syncedAt);
    });
});

describe("complete-order delivery evidence", () => {
    it("does not call a newly fulfilled remainder delivered using only an older saved box", async () => {
        const t = convexTest(schema, modules);
        await seedAccount(t, SHOPIFY_CUSTOMER);
        await order(t, { shopifyFulfillmentStatus: "partial", shipments: [shipment(100)] });
        await order(t, { sourceUpdatedAt: 200, shopifyFulfillmentStatus: "fulfilled" });
        expect(await saved(t)).toMatchObject({ status: "unknown", shipmentSnapshotComplete: false });
        // A complete snapshot at the same parent version can recover completeness.
        await order(t, { sourceUpdatedAt: 200, shopifyFulfillmentStatus: "fulfilled", shipments: [shipment(100), { ...shipment(200), shopifyFulfillmentId: "f2" }] });
        expect(await saved(t)).toMatchObject({ status: "delivered", shipmentSnapshotComplete: true });
    });
});

it("does not turn a newer cancellation into whole-order delivery by excluding the cancelled boxes", async () => {
    const t = convexTest(schema, modules);
    await seedAccount(t, SHOPIFY_CUSTOMER);
    await order(t, { shopifyFulfillmentStatus: "fulfilled", shipments: [
        shipment(100), { ...shipment(100, "in_transit"), shopifyFulfillmentId: "f2" },
    ] });
    expect((await saved(t))?.status).toBe("in_transit");
    await order(t, { sourceUpdatedAt: 90, shipments: [{ ...shipment(200, "in_transit"), shopifyFulfillmentId: "f2", fulfillmentStatus: "cancelled" }] });
    expect(await saved(t)).toMatchObject({ status: "unknown", shopifyFulfillmentStatus: "fulfilled" });
    // A newer parent flag alone still does not prove how the cancelled items
    // were resolved; no delivered quantities are assigned to replacement boxes.
    await order(t, { sourceUpdatedAt: 300, shopifyFulfillmentStatus: "fulfilled", shipments: [
        shipment(100), { ...shipment(200, "in_transit"), shopifyFulfillmentId: "f2", fulfillmentStatus: "cancelled" },
    ] });
    expect((await saved(t))?.status).toBe("unknown");
});

describe("same-version source collisions", () => {
    it("exposes conflicting carrier evidence without overwriting it and clears only on a newer fulfillment", async () => {
        const t = convexTest(schema, modules);
        await seedAccount(t, SHOPIFY_CUSTOMER);
        const parent = { shopifyFulfillmentStatus: "fulfilled" };
        await order(t, { ...parent, shipments: [shipment(100, "in_transit")] });
        expect(await order(t, { ...parent, shipments: [shipment(100, "delivered")] })).toMatchObject({ updated: true });
        const conflicted = await saved(t);
        expect(conflicted).toMatchObject({ status: "unknown", sourceConflict: true, sourceUpdatedAt: 100,
            shipments: [expect.objectContaining({ shipmentStatus: "in_transit", sourceUpdatedAt: 100, sourceConflict: true })],
        });
        // Retrying the contradictory snapshot (including a backfill at the same
        // version) does not refresh receipt time or choose a winner.
        expect(await order(t, { ...parent, shipments: [shipment(100, "delivered")] })).toMatchObject({ skipped: "stale_or_duplicate" });
        expect(await saved(t)).toEqual(conflicted);
        await order(t, { ...parent, sourceUpdatedAt: 200, shipments: [shipment(100, "delivered")] });
        expect((await saved(t))?.sourceConflict).toBe(true);
        await order(t, { ...parent, sourceUpdatedAt: 200, shipments: [shipment(201, "delivered")] });
        expect(await saved(t)).toMatchObject({ status: "delivered", sourceConflict: false });
    });

    it("flags conflicting parent quantities/status and does not clear that conflict with a newer child", async () => {
        const t = convexTest(schema, modules);
        await seedAccount(t, SHOPIFY_CUSTOMER);
        await order(t, { shopifyFulfillmentStatus: "partial", shipments: [shipment(100)] });
        await order(t, { shopifyFulfillmentStatus: "fulfilled", totalAmount: 999, shipments: [shipment(100)] });
        expect(await saved(t)).toMatchObject({ status: "unknown", sourceConflict: true, totalAmount: 320, shopifyFulfillmentStatus: "partial" });
        await order(t, { shopifyFulfillmentStatus: "partial", shipments: [shipment(200)] });
        expect((await saved(t))?.sourceConflict).toBe(true);
        await order(t, { sourceUpdatedAt: 300, shopifyFulfillmentStatus: "fulfilled", shipments: [shipment(200)] });
        expect(await saved(t)).toMatchObject({ status: "delivered", sourceConflict: false });
    });
});
