import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WebhookOrder } from "../src/lib/shopify-webhooks";
const mocks = vi.hoisted(() => ({ mutation: vi.fn(), fetchOrder: vi.fn() }));
vi.mock("convex/browser", () => ({ ConvexHttpClient: class { mutation = mocks.mutation; } }));
vi.mock("../src/lib/shopify-order-fetch", () => ({ fetchOrderForSync: mocks.fetchOrder }));
const base: WebhookOrder = {
    id: 123, name: "#123", created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-02T00:00:00Z",
    cancelled_at: null, fulfillment_status: "partial", customer: { id: 456 }, line_items: [],
    fulfillments: [{ id: 789, order_id: 123, updated_at: "2026-09-03T00:00:00Z", status: "success", shipment_status: "delivered",
        tracking_company: "Carrier", tracking_number: "one", tracking_numbers: ["one", "two"], tracking_urls: ["https://carrier.test/one", "https://carrier.test/two"], tracking_url: "https://carrier.test/one" }],
};
function request(topic: string, body: unknown, valid = true) {
    const raw = JSON.stringify(body);
    return new NextRequest("https://example.test/api/shopify/webhooks", {
        method: "POST", body: raw, headers: {
            "x-shopify-topic": topic,
            "x-shopify-hmac-sha256": valid ? createHmac("sha256", "secret").update(raw).digest("base64") : "wrong",
        },
    });
}
beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://fixture.convex.cloud");
    vi.stubEnv("BEST_BOTTLES_CONVEX_WRITE_TOKEN", "test-token");
    vi.stubEnv("SHOPIFY_WEBHOOK_SECRET", "secret");
    mocks.mutation.mockReset().mockResolvedValue({ updated: true });
    mocks.fetchOrder.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("order webhook ingress (fixture only)", () => {
    it("verifies HMAC before any order read or write", async () => {
        const { POST } = await import("../src/app/api/shopify/webhooks/route");
        expect((await POST(request("orders/updated", base, false))).status).toBe(401);
        expect(mocks.mutation).not.toHaveBeenCalled();
        expect(mocks.fetchOrder).not.toHaveBeenCalled();
    });
    it("passes source clocks and every package through the signed order path", async () => {
        const { POST } = await import("../src/app/api/shopify/webhooks/route");
        expect((await POST(request("orders/updated", base))).status).toBe(200);
        const args = mocks.mutation.mock.calls[0][1];
        expect(args).toMatchObject({ sourceUpdatedAt: Date.parse(base.updated_at!), shopifyFulfillmentStatus: "partial", status: "partially_fulfilled" });
        expect(args.shipments[0].packages).toHaveLength(2);
    });
    it("requests retry instead of acknowledging an event when the source read is behind", async () => {
        const { POST } = await import("../src/app/api/shopify/webhooks/route");
        mocks.fetchOrder.mockResolvedValue(base);
        expect((await POST(request("fulfillments/update", { ...base.fulfillments![0], updated_at: "2026-09-04T00:00:00Z" }))).status).toBe(500);
        expect(mocks.mutation).not.toHaveBeenCalled();
    });
    it("does not write a timestamp-less order or fulfillment snapshot", async () => {
        const { POST } = await import("../src/app/api/shopify/webhooks/route");
        expect((await POST(request("orders/updated", { ...base, updated_at: undefined }))).status).toBe(500);
        expect((await POST(request("orders/updated", { ...base, fulfillments: [{ ...base.fulfillments![0], updated_at: undefined }] }))).status).toBe(500);
        expect(mocks.mutation).not.toHaveBeenCalled();
    });
});
