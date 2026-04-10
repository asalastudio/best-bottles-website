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
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
    if (!secret) {
        console.error("[Shopify Webhook] SHOPIFY_WEBHOOK_SECRET not set");
        return false;
    }
    if (!hmacHeader) return false;

    const digest = createHmac("sha256", secret)
        .update(rawBody)
        .digest("base64");

    try {
        return timingSafeEqual(
            Buffer.from(digest, "utf-8"),
            Buffer.from(hmacHeader, "utf-8"),
        );
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
    | "collections/update";

export function parseWebhookTopic(
    header: string | null,
): ShopifyWebhookTopic | null {
    const valid: ShopifyWebhookTopic[] = [
        "products/create",
        "products/update",
        "products/delete",
        "inventory_levels/update",
        "collections/update",
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
    images: Array<{ id: number; src: string; alt: string | null }>;
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
