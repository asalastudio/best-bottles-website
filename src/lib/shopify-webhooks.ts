/**
 * Shopify Webhook Verification & Payload Parsing
 *
 * Verifies HMAC signatures on incoming Shopify webhooks and provides
 * typed payload helpers for the topics we subscribe to.
 */

import { createHmac, timingSafeEqual } from "crypto";

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
    | "orders/fulfilled";

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
    /** Shopify's delivery state: "in_transit", "delivered", "out_for_delivery", … */
    shipment_status: string | null;
    tracking_company: string | null;
    tracking_number: string | null;
    estimated_delivery_at?: string | null;
}

export interface WebhookOrder {
    id: number;
    name: string;
    created_at: string;
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

/**
 * Collapse Shopify's separate cancel flag, fulfilment status and per-shipment
 * delivery state into the four states the portal shows.
 *
 * Cancellation wins over everything: a cancelled order that was already shipped
 * must not keep reading as in transit.
 */
export function orderStatusFromShopify(
    order: Pick<WebhookOrder, "cancelled_at" | "fulfillment_status" | "fulfillments">,
): "processing" | "in_transit" | "delivered" | "cancelled" {
    if (order.cancelled_at) return "cancelled";

    const shipments = order.fulfillments ?? [];
    const delivered = shipments.length > 0
        && shipments.every((f) => f.shipment_status === "delivered");
    if (delivered) return "delivered";

    if (order.fulfillment_status === "fulfilled" || order.fulfillment_status === "partial") {
        return "in_transit";
    }
    return "processing";
}
