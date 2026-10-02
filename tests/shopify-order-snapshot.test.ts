import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../src/lib/shopify", () => ({ adminGraphQL: vi.fn() }));
import { adminGraphQL } from "../src/lib/shopify";
import { fetchOrderForSync } from "../src/lib/shopify-order-fetch";
import { assertFulfillmentSnapshot, orderSyncArgs } from "../src/lib/shopify-order-sync";

const read = vi.mocked(adminGraphQL);
function fixture() {
    return { order: {
        id: "gid://shopify/Order/123", name: "#123", createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-02T00:00:00Z",
        cancelledAt: null, displayFulfillmentStatus: "PARTIALLY_FULFILLED", customer: { id: "gid://shopify/Customer/456" },
        currentTotalPriceSet: { shopMoney: { amount: "12.00" } }, totalPriceSet: null, shippingAddress: null,
        lineItems: { pageInfo: { hasNextPage: false }, edges: [{ node: { sku: "TEST", title: "Bottle", name: "Bottle", quantity: 12, originalUnitPriceSet: { shopMoney: { amount: "1.00" } } } }] },
        fulfillments: [{ id: "gid://shopify/Fulfillment/789", createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-03T00:00:00Z",
            status: "SUCCESS", displayStatus: "DELIVERED", estimatedDeliveryAt: null,
            trackingInfo: [{ number: "one", url: null, company: "UPS" }, { number: null, url: "https://carrier.test/two", company: "FedEx" }],
            fulfillmentLineItems: { pageInfo: { hasNextPage: false }, edges: [{ node: { quantity: 6, lineItem: { sku: "TEST", title: "Bottle", name: "Bottle" } } }] },
        }],
    } };
}
beforeEach(() => read.mockReset());

describe("GraphQL snapshot to portal boundary", () => {
    it("carries independent source clocks, raw statuses, partial fulfillment and tracking tuples", async () => {
        read.mockResolvedValue(fixture());
        const result = orderSyncArgs((await fetchOrderForSync("123"))!);
        expect(result).toMatchObject({ sourceUpdatedAt: Date.parse("2026-09-02T00:00:00Z"), status: "partially_fulfilled", shopifyCustomerId: "456" });
        expect(result.shipments?.[0]).toMatchObject({ sourceUpdatedAt: Date.parse("2026-09-03T00:00:00Z"), fulfillmentStatus: "success",
            packages: [{ trackingNumber: "one", carrier: "UPS" }, { trackingUrl: "https://carrier.test/two", carrier: "FedEx" }],
        });
        expect(result.shipments?.[0].packages).toHaveLength(2);
    });

    it.each(["order lines", "fulfillment lines", "fulfillment boundary"])("refuses a potentially incomplete %s snapshot", async (kind) => {
        const data = fixture();
        if (kind === "order lines") data.order.lineItems.pageInfo.hasNextPage = true;
        if (kind === "fulfillment lines") data.order.fulfillments[0].fulfillmentLineItems.pageInfo.hasNextPage = true;
        if (kind === "fulfillment boundary") data.order.fulfillments = Array.from({ length: 50 }, () => data.order.fulfillments[0]);
        read.mockResolvedValue(data);
        await expect(fetchOrderForSync("123")).rejects.toThrow("shopify_order_snapshot_incomplete");
    });

    it("preserves an unknown provider order state instead of calling it unfulfilled", async () => {
        const data = fixture(); data.order.displayFulfillmentStatus = "ON_HOLD"; data.order.fulfillments = [];
        read.mockResolvedValue(data);
        const result = orderSyncArgs((await fetchOrderForSync("123"))!);
        expect(result.shopifyFulfillmentStatus).toBe("on_hold");
        expect(result.status).toBe("unknown");
    });

    it("rejects missing/invalid order source timestamps and retries fulfillment events whose read is behind", async () => {
        read.mockResolvedValue(fixture());
        const order = (await fetchOrderForSync("123"))!;
        expect(() => orderSyncArgs({ ...order, updated_at: undefined })).toThrow("source_version_missing");
        expect(() => orderSyncArgs({ ...order, updated_at: "invalid" })).toThrow("source_version_missing");
        const event = { ...order.fulfillments![0], id: 789, order_id: 123 };
        expect(() => assertFulfillmentSnapshot(order, event)).not.toThrow();
        expect(() => assertFulfillmentSnapshot(order, { ...event, updated_at: "2026-09-04T00:00:00Z" })).toThrow("snapshot_not_current");
        expect(() => assertFulfillmentSnapshot({ ...order, fulfillments: [] }, event)).toThrow("snapshot_not_current");
    });
});

it("canonicalizes equivalent REST and GraphQL unfulfilled snapshots before conflict comparison", async () => {
    const data = fixture();
    data.order.displayFulfillmentStatus = "UNFULFILLED";
    data.order.fulfillments = [];
    read.mockResolvedValue(data);
    const fetched = (await fetchOrderForSync("123"))!;
    const rest = { ...fetched, fulfillment_status: null };
    const graphqlArgs = orderSyncArgs(fetched);
    const restArgs = orderSyncArgs(rest);
    expect(graphqlArgs.shopifyFulfillmentStatus).toBeNull();
    expect(graphqlArgs.status).toBe("processing");
    expect(graphqlArgs).toEqual(restArgs);
});

it.each(["FULFILLED", "MARKED_AS_FULFILLED", "SUBMITTED", "FUTURE_WORKFLOW_STATE"])("does not confuse GraphQL %s display state with REST carrier shipment status", async (displayStatus) => {
    const data = fixture();
    data.order.displayFulfillmentStatus = "FULFILLED";
    data.order.fulfillments[0].displayStatus = displayStatus;
    read.mockResolvedValue(data);
    const fetched = (await fetchOrderForSync("123"))!;
    const rest = { ...fetched, fulfillments: fetched.fulfillments!.map((f) => ({ ...f, display_status: undefined, shipment_status: null })) };
    expect(orderSyncArgs(fetched).shipments?.[0].displayStatus).toBe(displayStatus);
    expect(orderSyncArgs(fetched).status).toBe("unknown");
    expect(orderSyncArgs(fetched).shipments?.[0].shipmentStatus)
        .toEqual(orderSyncArgs(rest).shipments?.[0].shipmentStatus);
});
