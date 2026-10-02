import { orderStatusFromShopify, shipmentFromFulfillment, type WebhookOrder, type WebhookFulfillment } from "./shopify-webhooks";
import { sourceTimestamp } from "../../convex/lib/shopifyOrderTruth";

/** Shared by webhook delivery and the manual backfill. No I/O. */
export function orderSyncArgs(order: WebhookOrder) {
    const sourceUpdatedAt = sourceTimestamp(order.updated_at);
    if (sourceUpdatedAt === undefined) throw new Error("shopify_order_source_version_missing");
    const orderDate = sourceTimestamp(order.created_at);
    if (orderDate === undefined) throw new Error("shopify_order_created_at_invalid");
    const shipments = order.fulfillments?.map(shipmentFromFulfillment);
    if (shipments?.some((s) => !s.shopifyFulfillmentId || s.sourceUpdatedAt === undefined)) {
        throw new Error("shopify_fulfillment_source_version_missing");
    }
    const primary = shipments?.find((s) => s.trackingNumber) ?? shipments?.[0];
    const price = order.current_total_price ?? order.total_price;
    const total = price == null ? undefined : Number(price);
    return {
        shopifyOrderId: String(order.id),
        shopifyCustomerId: order.customer ? String(order.customer.id) : undefined,
        orderName: order.name, orderDate, sourceUpdatedAt,
        shopifyFulfillmentStatus: order.fulfillment_status,
        shopifyCancelledAt: sourceTimestamp(order.cancelled_at),
        status: orderStatusFromShopify(order),
        lineItems: order.line_items.map((item) => ({
            sku: item.sku?.trim() || "—", description: item.name?.trim() || item.title,
            quantity: item.quantity,
            unitPrice: item.price != null && Number.isFinite(Number(item.price)) ? Number(item.price) : undefined,
        })),
        totalAmount: Number.isFinite(total) ? total : undefined,
        trackingNumber: primary?.trackingNumber, carrier: primary?.carrier,
        estimatedDelivery: primary?.estimatedDelivery,
        shipments,
        shipTo: order.shipping_address
            ? [order.shipping_address.city, order.shipping_address.province_code].filter(Boolean).join(", ") || undefined
            : undefined,
    };
}

/** A webhook is not acknowledged if the fetched snapshot has not caught up. */
export function assertFulfillmentSnapshot(order: WebhookOrder, event: WebhookFulfillment) {
    const eventAt = sourceTimestamp(event.updated_at);
    const snapshot = order.fulfillments?.find((f) => f.id === event.id);
    const snapshotAt = sourceTimestamp(snapshot?.updated_at);
    if (eventAt === undefined || snapshotAt === undefined || snapshotAt < eventAt) {
        throw new Error("shopify_fulfillment_snapshot_not_current");
    }
}
