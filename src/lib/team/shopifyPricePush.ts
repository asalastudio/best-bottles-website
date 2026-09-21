import "server-only";

import { adminGraphQL } from "@/lib/shopify";

/**
 * Checkout charges what Shopify holds, so a 1-piece price saved in the Team Hub is pushed to the
 * Shopify variant in the same action. Only the price: nothing else about the variant is sent.
 *
 * OFF unless TEAM_HUB_SHOPIFY_PRICE_PUSH=1. Any write to a Shopify product fires products/update,
 * and until the 2026-09-20 handler fix is live in production that webhook overwrites the catalogue
 * row it came from. Switch this on only after that fix is deployed.
 */
export type PricePushResult = { status: "ok" | "failed" | "off"; detail: string | null };

export function pricePushEnabled() {
    return process.env.TEAM_HUB_SHOPIFY_PRICE_PUSH === "1";
}

type BulkUpdate = { productVariantsBulkUpdate: { userErrors: { field: string[] | null; message: string }[] } };

export async function pushVariantPrice(args: { shopifyProductId: string | null; shopifyVariantId: string | null; price: number }): Promise<PricePushResult> {
    if (!pricePushEnabled()) return { status: "off", detail: "Shopify price updates are switched off (TEAM_HUB_SHOPIFY_PRICE_PUSH)." };
    if (!args.shopifyProductId || !args.shopifyVariantId) return { status: "failed", detail: "This SKU has no Shopify product or variant id." };
    try {
        const data = await adminGraphQL<BulkUpdate>(
            `mutation($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
                productVariantsBulkUpdate(productId: $productId, variants: $variants) { userErrors { field message } }
            }`,
            { productId: args.shopifyProductId, variants: [{ id: args.shopifyVariantId, price: args.price.toFixed(2) }] },
        );
        const errors = data.productVariantsBulkUpdate.userErrors;
        return errors.length ? { status: "failed", detail: errors.map(e => e.message).join("; ") } : { status: "ok", detail: null };
    } catch (error) {
        return { status: "failed", detail: error instanceof Error ? error.message.slice(0, 300) : "Shopify could not be reached." };
    }
}
