/**
 * Shipment tracking as it reaches the customer's portal.
 *
 * The defect these guard against is a half-true order page. A wholesale order
 * goes out on several pallets, on different days, often with different
 * carriers; reporting only the first tracking number told the customer their
 * order had shipped when half of it had, and gave them a number that tracked
 * the wrong box.
 */

import { describe, expect, it } from "vitest";
import {
    shipmentFromFulfillment,
    formatEstimatedDelivery,
    orderStatusFromShopify,
    parseWebhookTopic,
} from "../src/lib/shopify-webhooks";

const FEDEX = {
    id: 550000000001,
    order_id: 9900000000002,
    created_at: "2026-09-10T16:00:00Z",
    shipment_status: "delivered",
    tracking_company: "FedEx Freight",
    tracking_number: "794622836420",
    tracking_url: "https://www.fedex.com/fedextrack/?trknbr=794622836420",
    estimated_delivery_at: "2026-09-12T00:00:00Z",
    line_items: [
        { sku: "GBCyl9SpryGl", title: "9 ml Clear Cylinder", name: "9 ml Clear Cylinder Spray", quantity: 1500, price: "0.88" },
    ],
};

describe("shipmentFromFulfillment", () => {
    it("carries everything the customer needs to chase a box", () => {
        const shipment = shipmentFromFulfillment(FEDEX);

        expect(shipment.shopifyFulfillmentId).toBe("550000000001");
        expect(shipment.carrier).toBe("FedEx Freight");
        expect(shipment.trackingNumber).toBe("794622836420");
        expect(shipment.trackingUrl).toContain("fedex.com");
        expect(shipment.shipmentStatus).toBe("delivered");
        expect(shipment.estimatedDelivery).toBe("Sep 12, 2026");
        expect(shipment.shippedAt).toBe(new Date("2026-09-10T16:00:00Z").getTime());
    });

    it("reads the plural tracking fields Shopify sometimes sends instead", () => {
        const shipment = shipmentFromFulfillment({
            shipment_status: "in_transit",
            tracking_company: "UPS",
            tracking_number: null,
            tracking_numbers: ["1Z999AA10123456784"],
            tracking_urls: ["https://www.ups.com/track?tracknum=1Z999AA10123456784"],
        });

        expect(shipment.trackingNumber).toBe("1Z999AA10123456784");
        expect(shipment.trackingUrl).toContain("ups.com");
    });

    it("keeps a shipment that has no tracking number yet", () => {
        // "Part of your order has left" is more than silence, so a fulfilment
        // created before the label is bought must not be dropped.
        const shipment = shipmentFromFulfillment({
            shipment_status: "label_printed",
            tracking_company: null,
            tracking_number: null,
        });

        expect(shipment.shipmentStatus).toBe("label_printed");
        expect(shipment.trackingNumber).toBeUndefined();
        expect(shipment.carrier).toBeUndefined();
    });

    it("records what travelled in this box, so a partial shipment is legible", () => {
        const shipment = shipmentFromFulfillment(FEDEX);
        expect(shipment.lineItems).toEqual([
            { sku: "GBCyl9SpryGl", description: "9 ml Clear Cylinder Spray", quantity: 1500 },
        ]);
    });

    it("marks a line item with no SKU rather than showing an empty cell", () => {
        const shipment = shipmentFromFulfillment({
            ...FEDEX,
            line_items: [{ sku: null, title: "18-415 Black Cap", name: null, quantity: 500, price: "0.11" }],
        });
        expect(shipment.lineItems?.[0]).toEqual({
            sku: "—",
            description: "18-415 Black Cap",
            quantity: 500,
        });
    });

    it("treats empty strings as absent rather than rendering blanks", () => {
        const shipment = shipmentFromFulfillment({
            shipment_status: "",
            tracking_company: "",
            tracking_number: "",
        });
        expect(shipment.trackingNumber).toBeUndefined();
        expect(shipment.carrier).toBeUndefined();
        expect(shipment.shipmentStatus).toBeUndefined();
    });
});

describe("formatEstimatedDelivery", () => {
    it("formats in UTC, because a US host renders Shopify's midnight as the day before", () => {
        expect(formatEstimatedDelivery("2026-09-19T00:00:00Z")).toBe("Sep 19, 2026");
    });

    it("returns nothing for an absent or unparseable date instead of 'Invalid Date'", () => {
        expect(formatEstimatedDelivery(null)).toBeUndefined();
        expect(formatEstimatedDelivery(undefined)).toBeUndefined();
        expect(formatEstimatedDelivery("not a date")).toBeUndefined();
    });
});

describe("orderStatusFromShopify", () => {
    it("reports in transit while only some of the order has shipped", () => {
        expect(
            orderStatusFromShopify({
                cancelled_at: null,
                fulfillment_status: "partial",
                fulfillments: [
                    { shipment_status: "delivered", tracking_company: "FedEx", tracking_number: "1" },
                    { shipment_status: "out_for_delivery", tracking_company: "UPS", tracking_number: "2" },
                ],
            }),
        ).toBe("in_transit");
    });

    it("reports delivered only once every shipment has arrived", () => {
        expect(
            orderStatusFromShopify({
                cancelled_at: null,
                fulfillment_status: "fulfilled",
                fulfillments: [
                    { shipment_status: "delivered", tracking_company: "FedEx", tracking_number: "1" },
                    { shipment_status: "delivered", tracking_company: "UPS", tracking_number: "2" },
                ],
            }),
        ).toBe("delivered");
    });

    it("lets cancellation win over a shipment that already went out", () => {
        expect(
            orderStatusFromShopify({
                cancelled_at: "2026-09-14T00:00:00Z",
                fulfillment_status: "fulfilled",
                fulfillments: [{ shipment_status: "delivered", tracking_company: "FedEx", tracking_number: "1" }],
            }),
        ).toBe("cancelled");
    });
});

describe("parseWebhookTopic", () => {
    it("accepts the fulfilment topics that actually carry tracking", () => {
        expect(parseWebhookTopic("fulfillments/create")).toBe("fulfillments/create");
        expect(parseWebhookTopic("fulfillments/update")).toBe("fulfillments/update");
    });

    it("still refuses anything it does not handle", () => {
        expect(parseWebhookTopic("customers/redact")).toBeNull();
        expect(parseWebhookTopic(null)).toBeNull();
    });
});
