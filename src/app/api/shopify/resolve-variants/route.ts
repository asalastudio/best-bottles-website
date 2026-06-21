import { NextRequest } from "next/server";
import { resolveVariantsBySkus, buildCheckoutUrl, normalizeShopifyVariantId } from "@/lib/shopify";
import { enforceGraceRateLimit } from "@/lib/graceRateLimitServer";

/**
 * POST /api/shopify/resolve-variants
 *
 * Takes an array of { sku, websiteSku, shopifyVariantId, quantity } items and returns:
 * - resolved variant info for fallback SKU lines
 * - a ready-to-use Shopify checkout URL
 */
export async function POST(req: NextRequest) {
    const rateLimited = await enforceGraceRateLimit(req, {
        route: "shopify-resolve-variants",
        limit: 60,
        windowMs: 60_000,
    });
    if (rateLimited) return rateLimited;

    const body = (await req.json().catch(() => ({}))) as {
        items?: Array<{
            sku: string;
            websiteSku?: string | null;
            shopifyVariantId?: string | null;
            quantity: number;
        }>;
    };

    const requestedItems = (body.items ?? [])
        .map((item) => ({
            sku: String(item.sku ?? "").trim(),
            websiteSku: String(item.websiteSku ?? "").trim(),
            shopifyVariantId: normalizeShopifyVariantId(item.shopifyVariantId),
            quantity: Math.floor(Number(item.quantity)),
        }))
        .filter((item) => item.sku && Number.isFinite(item.quantity) && item.quantity > 0);

    if (!requestedItems.length) {
        return Response.json({ error: "No items provided" }, { status: 400 });
    }

    try {
        const directCheckoutItems = requestedItems
            .filter((item) => item.shopifyVariantId)
            .map((item) => ({
                variantId: item.shopifyVariantId as string,
                quantity: item.quantity,
            }));
        const fallbackItems = requestedItems.filter((item) => !item.shopifyVariantId);
        const fallbackSkus = fallbackItems.map((i) => i.sku);

        const token = process.env.SHOPIFY_ADMIN_TOKEN;
        if (fallbackItems.length > 0 && !token && directCheckoutItems.length === 0) {
            return Response.json(
                { error: "Shopify Admin token not configured" },
                { status: 503 },
            );
        }

        const variants = fallbackItems.length > 0 && token
            ? await resolveVariantsBySkus(fallbackSkus)
            : [];
        const unavailableSkus = variants.filter((v) => !v.available).map((v) => v.sku);

        const skuToQuantity = Object.fromEntries(
            requestedItems.map((i) => [i.sku, i.quantity]),
        );

        const resolvedCheckoutItems = variants
            .filter((v) => v.available)
            .map((v) => ({
                variantId: v.variantId,
                quantity: skuToQuantity[v.sku] ?? 1,
            }));
        const checkoutItems = [...directCheckoutItems, ...resolvedCheckoutItems];

        const checkoutUrl =
            checkoutItems.length > 0 ? buildCheckoutUrl(checkoutItems) : null;
        const unmatchedSkus = fallbackSkus.filter(
            (s) => !variants.some((v) => v.sku === s),
        );

        if (!checkoutUrl) {
            return Response.json(
                {
                    error: "No checkout-ready Shopify variants found",
                    variants,
                    checkoutUrl,
                    unmatchedSkus,
                    unavailableSkus,
                },
                { status: 409 },
            );
        }

        return Response.json({
            variants,
            checkoutUrl,
            unmatchedSkus,
            unavailableSkus,
        });
    } catch (err) {
        console.error("[shopify/resolve-variants] Error:", err);
        return Response.json(
            { error: "Failed to resolve variants" },
            { status: 502 },
        );
    }
}
