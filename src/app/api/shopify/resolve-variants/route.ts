import { NextRequest } from "next/server";
import {
    buildCheckoutUrl,
    normalizeShopifyVariantId,
    resolveCheckoutVariantsByIds,
    resolveVariantsBySkus,
} from "@/lib/shopify";
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
        const directItems = requestedItems.filter((item) => item.shopifyVariantId);
        const fallbackItems = requestedItems.filter((item) => !item.shopifyVariantId);
        const fallbackSkus = fallbackItems.map((i) => i.sku);

        const token = process.env.SHOPIFY_ADMIN_TOKEN;
        if (!token) {
            return Response.json(
                { error: "Shopify Admin token not configured" },
                { status: 503 },
            );
        }

        // A variant ID in localStorage is not proof that Shopify can still sell
        // it. Re-check direct IDs server-side so draft/unpublished products do
        // not produce a cart permalink that Shopify answers with HTTP 410.
        const directVariantStates = directItems.length > 0
            ? await resolveCheckoutVariantsByIds(
                directItems.map((item) => item.shopifyVariantId as string),
            )
            : [];
        const directStateById = new Map(
            directVariantStates.map((state) => [state.variantId, state]),
        );
        const directCheckoutItems = directItems.flatMap((item) => {
            const state = directStateById.get(item.shopifyVariantId as string);
            if (!state?.available) return [];
            return [{
                variantId: state.variantId,
                quantity: item.quantity,
            }];
        });

        const variants = fallbackItems.length > 0
            ? await resolveVariantsBySkus(fallbackSkus)
            : [];
        const unavailableSkus = [
            ...directItems
                .filter((item) => directStateById.get(item.shopifyVariantId as string)?.available === false)
                .map((item) => item.sku),
            ...variants.filter((v) => !v.available).map((v) => v.sku),
        ];

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
        const unmatchedSkus = [
            ...directItems
                .filter((item) => !directStateById.has(item.shopifyVariantId as string))
                .map((item) => item.sku),
            ...fallbackSkus.filter((s) => !variants.some((v) => v.sku === s)),
        ];

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
