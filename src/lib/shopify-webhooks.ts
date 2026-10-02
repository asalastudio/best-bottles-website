/**
 * Shopify Webhook Verification & Payload Parsing
 *
 * Verifies HMAC signatures on incoming Shopify webhooks and provides
 * typed payload helpers for the topics we subscribe to.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { orderStatusFromEvidence, sourceTimestamp } from "../../convex/lib/shopifyOrderTruth";

// ─── HMAC verification ──────────────────────────────────────────────────────

export function verifyShopifyWebhook(
    rawBody: Buffer,
    hmacHeader: string | null,
): boolean {
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET?.trim();
    if (!secret) {
        console.error("[Shopify Webhook] SHOPIFY_WEBHOOK_SECRET not set");
        return false;
    }
    if (!hmacHeader) return false;

    const hmac = hmacHeader.trim();
    // Shopify: base64 HMAC of raw body; compare decoded bytes (see
    // https://shopify.dev/docs/apps/build/webhooks/subscribe/https#step-5-verify-the-webhook )
    const digestB64 = createHmac("sha256", secret)
        .update(rawBody)
        .digest("base64");

    try {
        const a = Buffer.from(digestB64, "base64");
        const b = Buffer.from(hmac, "base64");
        if (a.length !== b.length) return false;
        return timingSafeEqual(a, b);
    } catch {
        return false;
    }
}

// ─── Webhook topic types ────────────────────────────────────────────────────

export type ShopifyWebhookTopic =
    | "products/create"
    | "products/update"
    | "products/delete"
    | "inventory_levels/update"
    | "collections/update"
    // Order topics feed the customer portal's history. `updated` carries
    // fulfilment and tracking changes, so it is the one that moves an order
    // from processing to in transit to delivered.
    | "orders/create"
    | "orders/updated"
    | "orders/cancelled"
    | "orders/fulfilled"
    // The fulfilment topics are what actually carry tracking. `orders/updated`
    // fires too, but it is a general-purpose edit signal and its payload does
    // not reliably include the fulfilments.
    | "fulfillments/create"
    | "fulfillments/update";

export function parseWebhookTopic(
    header: string | null,
): ShopifyWebhookTopic | null {
    const valid: ShopifyWebhookTopic[] = [
        "products/create",
        "products/update",
        "products/delete",
        "inventory_levels/update",
        "collections/update",
        "orders/create",
        "orders/updated",
        "orders/cancelled",
        "orders/fulfilled",
        "fulfillments/create",
        "fulfillments/update",
    ];
    if (header && valid.includes(header as ShopifyWebhookTopic)) {
        return header as ShopifyWebhookTopic;
    }
    return null;
}

// ─── Payload types (subset of Shopify webhook bodies) ───────────────────────

export interface WebhookProductVariant {
    id: number;
    product_id: number;
    sku: string;
    title: string;
    price: string;
    image_id: number | null;
    inventory_item_id: number;
    inventory_quantity: number;
    /** "deny" | "continue": whether Shopify keeps selling at zero. */
    inventory_policy?: string | null;
    /** "shopify" when inventory is tracked, null when it is not. */
    inventory_management?: string | null;
    option1: string | null;
    option2: string | null;
    option3: string | null;
}

export interface WebhookProduct {
    id: number;
    title: string;
    handle: string;
    product_type: string;
    status: string;
    published_at?: string | null;
    body_html: string | null;
    vendor: string;
    tags: string;
    images: Array<{ id: number; src: string; alt: string | null; variant_ids?: number[] }>;
    options: Array<{ name: string; values: string[] }>;
    variants: WebhookProductVariant[];
}

export interface WebhookProductDelete {
    id: number;
}

export interface WebhookInventoryLevel {
    inventory_item_id: number;
    location_id: number;
    available: number | null;
}

export type WebhookPayload =
    | { topic: "products/create"; data: WebhookProduct }
    | { topic: "products/update"; data: WebhookProduct }
    | { topic: "products/delete"; data: WebhookProductDelete }
    | { topic: "inventory_levels/update"; data: WebhookInventoryLevel };

// ─── Order payloads ─────────────────────────────────────────────────────────

export interface WebhookOrderLineItem {
    sku: string | null;
    title: string;
    name?: string | null;
    variant_title?: string | null;
    quantity: number;
    price: string | null;
}

export interface WebhookOrderFulfillment {
    id?: number;
    order_id?: number;
    created_at?: string | null;
    updated_at?: string | null;
    status?: string | null;
    tracking_info?: Array<{ company: string | null; number: string | null; url: string | null }>;
    /** Shopify's delivery state: "in_transit", "delivered", "out_for_delivery", … */
    shipment_status: string | null;
    tracking_company: string | null;
    tracking_number: string | null;
    /** Shopify resolves the carrier's own tracking page for known carriers. */
    tracking_url?: string | null;
    tracking_urls?: string[] | null;
    tracking_numbers?: string[] | null;
    estimated_delivery_at?: string | null;
    line_items?: WebhookOrderLineItem[];
}

/**
 * The `fulfillments/create` and `fulfillments/update` payload: one shipment,
 * carrying the order id it belongs to rather than the whole order.
 */
export interface WebhookFulfillment extends WebhookOrderFulfillment {
    id: number;
    order_id: number;
    status?: string | null;
}

/**
 * Normalise one Shopify fulfilment into the portal's shipment shape.
 *
 * Shopify exposes tracking in both singular and plural forms and does not
 * always agree with itself about which is populated, so both are read. A
 * fulfillment with no tracking number is still kept, without claiming it has
 * left the warehouse. Provider shipment state is independent of label creation.
 */
export function shipmentFromFulfillment(fulfillment: WebhookOrderFulfillment) {
    // Preserve tuple positions: filtering numbers/URLs independently pairs the wrong box.
    const tracking = fulfillment.tracking_info?.map((t) => ({
        trackingNumber: t.number || undefined, trackingUrl: t.url || undefined,
        carrier: t.company || undefined,
    })) ?? Array.from({ length: Math.max(fulfillment.tracking_numbers?.length ?? 0, fulfillment.tracking_urls?.length ?? 0) }, (_, i) => ({
        trackingNumber: fulfillment.tracking_numbers?.[i] || undefined,
        trackingUrl: fulfillment.tracking_urls?.[i] || undefined,
        carrier: fulfillment.tracking_company || undefined,
    }));
    const singular = {
        trackingNumber: fulfillment.tracking_number || undefined,
        trackingUrl: fulfillment.tracking_url || undefined,
        carrier: fulfillment.tracking_company || undefined,
    };
    if ((singular.trackingNumber || singular.trackingUrl) && !tracking.some((t) =>
        t.trackingNumber === singular.trackingNumber && t.trackingUrl === singular.trackingUrl)) {
        tracking.push(singular);
    }
    const packages = tracking.filter((t) => t.trackingNumber || t.trackingUrl);
    const primary = packages[0];

    return {
        shopifyFulfillmentId: fulfillment.id === undefined ? undefined : String(fulfillment.id),
        trackingNumber: primary?.trackingNumber,
        carrier: fulfillment.tracking_company || undefined,
        trackingUrl: primary?.trackingUrl,
        shipmentStatus: fulfillment.shipment_status || undefined,
        fulfillmentStatus: fulfillment.status || undefined,
        sourceUpdatedAt: sourceTimestamp(fulfillment.updated_at),
        fulfillmentCreatedAt: sourceTimestamp(fulfillment.created_at),
        // created_at is when fulfillment was recorded, not carrier pickup.
        packages,
        estimatedDelivery: formatEstimatedDelivery(fulfillment.estimated_delivery_at),
        lineItems: fulfillment.line_items?.map((item) => ({
            sku: item.sku?.trim() || "—",
            description: item.name?.trim() || item.title,
            quantity: item.quantity,
        })),
    };
}

/**
 * `portalOrders` estimated-delivery fields are display strings, not timestamps.
 *
 * Formatted in UTC on purpose: Shopify sends midnight UTC, which a US server
 * renders as the previous day — an ETA that reads a day early.
 */
export function formatEstimatedDelivery(value: string | null | undefined): string | undefined {
    if (!value) return undefined;
    const at = new Date(value);
    if (Number.isNaN(at.getTime())) return undefined;
    return at.toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
    });
}

export interface WebhookOrder {
    id: number;
    name: string;
    created_at: string;
    updated_at?: string;
    cancelled_at: string | null;
    /** "fulfilled" | "partial" | null */
    fulfillment_status: string | null;
    current_total_price?: string | null;
    total_price?: string | null;
    customer: { id: number } | null;
    line_items: WebhookOrderLineItem[];
    fulfillments?: WebhookOrderFulfillment[];
    shipping_address?: { city?: string | null; province_code?: string | null } | null;
}

/** Cancellation and complete fulfillment are separate from shipment delivery. */
export function orderStatusFromShopify(
    order: Pick<WebhookOrder, "cancelled_at" | "fulfillment_status" | "fulfillments">,
) {
    return orderStatusFromEvidence(Boolean(order.cancelled_at), order.fulfillment_status,
        (order.fulfillments ?? []).map((f) => ({ shipmentStatus: f.shipment_status ?? undefined, fulfillmentStatus: f.status ?? undefined })));
}
