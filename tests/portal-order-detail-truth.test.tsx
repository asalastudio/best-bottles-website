import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getOrder: vi.fn() }));
vi.mock("../src/lib/portal/server", () => ({ getPortalOrder: mocks.getOrder }));
vi.mock("../src/app/(portal)/portal/actions", () => ({ reorderToDraftAction: vi.fn() }));
import Detail from "../src/app/(portal)/portal/orders/[orderId]/page";
const base = { orderId: "#123", status: "unknown", source: "shopify", sourceUpdatedAt: null, syncedAt: null, orderDate: 1,
    shipments: [], lineItems: [], totalAmount: 0, itemCount: 0, shipTo: null };
async function render(order = base) {
    mocks.getOrder.mockResolvedValue(order);
    return renderToStaticMarkup(await Detail({ params: Promise.resolve({ orderId: "%23123" }) }));
}
describe("order detail truth", () => {
    it("shows unknown and missing evidence without asserting nothing shipped", async () => {
        const html = await render();
        expect(html).toContain("Status unavailable");
        expect(html).toContain("No shipment details are available");
        expect(html).not.toContain("Nothing has shipped");
        expect(html).not.toContain("Cancelled");
        expect(html).toContain("Saved Shopify update: not recorded");
    });
    it("renders every tracking tuple without calling fulfillment creation shipment", async () => {
        mocks.getOrder.mockResolvedValue({ ...base, status: "label_created", shipments: [{
            shopifyFulfillmentId: "f1", shipmentStatus: "label_printed", fulfillmentCreatedAt: 1, sourceUpdatedAt: 2,
            packages: [{ trackingNumber: "BOX-ONE", trackingUrl: "https://carrier.test/one" }, { trackingNumber: "BOX-TWO", trackingUrl: "https://carrier.test/two" }],
        }] });
        const html = renderToStaticMarkup(await Detail({ params: Promise.resolve({ orderId: "123" }) }));
        expect(html).toContain("Label created");
        for (const value of ["BOX-ONE", "BOX-TWO", "https://carrier.test/one", "https://carrier.test/two"]) expect(html).toContain(value);
        expect(html).toContain("fulfillment recorded");
        expect(html).not.toContain("shipped Jan");
    });
    it("does not translate fulfillment success to delivery", async () => {
        mocks.getOrder.mockResolvedValue({ ...base, shipments: [{ shipmentStatus: "success" }] });
        const html = renderToStaticMarkup(await Detail({ params: Promise.resolve({ orderId: "123" }) }));
        expect(html).toContain("Fulfillment completed");
        expect(html).not.toContain("Delivered");
    });
});
