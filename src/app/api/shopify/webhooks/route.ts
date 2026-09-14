import { NextRequest } from "next/server";
import {
    verifyShopifyWebhook,
    parseWebhookTopic,
    orderStatusFromShopify,
    type WebhookProduct,
    type WebhookProductDelete,
    type WebhookInventoryLevel,
    type WebhookOrder,
} from "@/lib/shopify-webhooks";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

// Lazily constructed so a missing NEXT_PUBLIC_CONVEX_URL surfaces as a 500 at
// request time instead of crashing `next build` during page-data collection.
let convexClient: ConvexHttpClient | null = null;
function getConvex(): ConvexHttpClient | null {
    if (convexClient) return convexClient;
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) return null;
    convexClient = new ConvexHttpClient(url);
    return convexClient;
}
const convexWriteToken = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;

/**
 * `portalOrders.estimatedDelivery` is a display string, not a timestamp, so
 * Shopify's ISO value has to be formatted before it is stored. Passing it
 * through raw put "2026-09-19T00:00:00Z" on the customer's dashboard.
 */
function formatEstimatedDelivery(value: string | null | undefined): string | undefined {
    if (!value) return undefined;
    const at = new Date(value);
    if (Number.isNaN(at.getTime())) return undefined;
    // Formatted in UTC on purpose. Shopify sends midnight UTC, which a US
    // server renders as the previous day — an ETA that reads a day early.
    return at.toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
    });
}

/**
 * POST /api/shopify/webhooks
 *
 * Receives Shopify webhook events, verifies HMAC, and forwards
 * product/inventory changes to Convex for mirror table sync.
 */
export async function POST(req: NextRequest) {
    const rawBody = Buffer.from(await req.arrayBuffer());
    const hmac = req.headers.get("x-shopify-hmac-sha256");
    const topicHeader = req.headers.get("x-shopify-topic");
    const shopDomain = req.headers.get("x-shopify-shop-domain");

    if (!verifyShopifyWebhook(rawBody, hmac)) {
        console.error("[Shopify Webhook] HMAC verification failed", {
            topic: topicHeader,
            shop: shopDomain,
        });
        return new Response("Unauthorized", { status: 401 });
    }

    if (!convexWriteToken) {
        console.error("[Shopify Webhook] BEST_BOTTLES_CONVEX_WRITE_TOKEN is not configured");
        return new Response("Server not configured", { status: 500 });
    }

    const convex = getConvex();
    if (!convex) {
        console.error("[Shopify Webhook] NEXT_PUBLIC_CONVEX_URL is not configured");
        return new Response("Server not configured", { status: 500 });
    }

    const topic = parseWebhookTopic(topicHeader);
    if (!topic) {
        console.warn("[Shopify Webhook] Unknown topic:", topicHeader);
        return new Response("OK", { status: 200 });
    }

    const body = JSON.parse(rawBody.toString("utf-8"));

    try {
        switch (topic) {
            case "products/create":
            case "products/update": {
                const product = body as WebhookProduct;
                const imageById = new Map<number, string>();
                const imageByVariantId = new Map<number, string>();
                for (const image of product.images ?? []) {
                    imageById.set(image.id, image.src);
                    for (const variantId of image.variant_ids ?? []) {
                        if (!imageByVariantId.has(variantId)) {
                            imageByVariantId.set(variantId, image.src);
                        }
                    }
                }

                await convex.mutation(api.shopifySync.syncProduct, {
                    writeToken: convexWriteToken,
                    shopifyProductId: product.id,
                    title: product.title,
                    handle: product.handle,
                    productType: product.product_type,
                    status: product.status,
                    bodyHtml: product.body_html ?? "",
                    vendor: product.vendor,
                    tags: product.tags,
                    heroImageUrl: product.images[0]?.src ?? null,
                    options: product.options.map((o) => ({
                        name: o.name,
                        values: o.values,
                    })),
                    variants: product.variants.map((v) => ({
                        shopifyVariantId: v.id,
                        sku: v.sku,
                        title: v.title,
                        price: v.price,
                        imageUrl:
                            (v.image_id ? imageById.get(v.image_id) : null) ??
                            imageByVariantId.get(v.id) ??
                            null,
                        inventoryItemId: v.inventory_item_id,
                        inventoryQuantity: v.inventory_quantity,
                        option1: v.option1,
                        option2: v.option2,
                        option3: v.option3,
                    })),
                });
                console.log(
                    `[Shopify Webhook] ${topic}: synced product ${product.id} (${product.handle})`,
                );
                break;
            }

            case "products/delete": {
                const deleted = body as WebhookProductDelete;
                await convex.mutation(api.shopifySync.syncProductDelete, {
                    writeToken: convexWriteToken,
                    shopifyProductId: deleted.id,
                });
                console.log(
                    `[Shopify Webhook] products/delete: removed ${deleted.id}`,
                );
                break;
            }

            // All four order topics carry the same order payload, so one
            // handler serves them. `orders/updated` is the one that actually
            // moves an order along — it fires when a fulfilment or tracking
            // number is added.
            case "orders/create":
            case "orders/updated":
            case "orders/cancelled":
            case "orders/fulfilled": {
                const order = body as WebhookOrder;
                const shipment = order.fulfillments?.find((f) => f.tracking_number) ?? null;
                const priceText = order.current_total_price ?? order.total_price ?? null;
                const total = priceText === null ? undefined : Number(priceText);
                const shipTo = order.shipping_address
                    ? [order.shipping_address.city, order.shipping_address.province_code]
                        .filter(Boolean).join(", ") || undefined
                    : undefined;

                const result = await convex.mutation(api.portal.upsertOrderFromShopify, {
                    writeToken: convexWriteToken,
                    shopifyOrderId: String(order.id),
                    shopifyCustomerId: order.customer ? String(order.customer.id) : undefined,
                    orderName: order.name,
                    orderDate: new Date(order.created_at).getTime(),
                    status: orderStatusFromShopify(order),
                    lineItems: order.line_items.map((item) => ({
                        // A Shopify line item can ship without a SKU; the portal
                        // shows this string, so an empty cell is worse than a mark.
                        sku: item.sku?.trim() || "—",
                        description: item.name?.trim() || item.title,
                        quantity: item.quantity,
                        unitPrice: item.price === null ? undefined : Number(item.price),
                    })),
                    totalAmount: Number.isFinite(total) ? total : undefined,
                    trackingNumber: shipment?.tracking_number ?? undefined,
                    carrier: shipment?.tracking_company ?? undefined,
                    estimatedDelivery: formatEstimatedDelivery(shipment?.estimated_delivery_at),
                    shipTo,
                });

                console.log(
                    `[Shopify Webhook] ${topic}: order ${order.name} →`,
                    "skipped" in result ? `skipped (${result.skipped})` : "synced",
                );
                break;
            }

            case "inventory_levels/update": {
                const level = body as WebhookInventoryLevel;
                await convex.mutation(api.shopifySync.syncInventoryLevel, {
                    writeToken: convexWriteToken,
                    inventoryItemId: level.inventory_item_id,
                    locationId: level.location_id,
                    available: level.available ?? 0,
                });
                console.log(
                    `[Shopify Webhook] inventory_levels/update: item ${level.inventory_item_id}`,
                );
                break;
            }
        }
    } catch (err) {
        console.error(`[Shopify Webhook] Error processing ${topic}:`, err);
        return new Response("Internal error", { status: 500 });
    }

    return new Response("OK", { status: 200 });
}
