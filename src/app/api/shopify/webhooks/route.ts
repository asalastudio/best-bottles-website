import { NextRequest } from "next/server";
import {
    verifyShopifyWebhook,
    parseWebhookTopic,
    type WebhookProduct,
    type WebhookProductDelete,
    type WebhookInventoryLevel,
} from "@/lib/shopify-webhooks";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

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
                await convex.mutation(api.shopifySync.syncProduct, {
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
                    shopifyProductId: deleted.id,
                });
                console.log(
                    `[Shopify Webhook] products/delete: removed ${deleted.id}`,
                );
                break;
            }

            case "inventory_levels/update": {
                const level = body as WebhookInventoryLevel;
                await convex.mutation(api.shopifySync.syncInventoryLevel, {
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
