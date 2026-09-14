import "server-only";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { getPortalConvex, getPortalConvexWriteToken } from "./convexClient";
import { requirePortalViewer, ensurePortalShopifyCustomer, getPortalAddresses } from "./server";
import { addressIsUsable, toShopifyMailingAddress } from "./address";
import { createWholesaleDraftOrder } from "@/lib/shopify-draft-orders";
import { resolveQuotedUnitPrice } from "@/lib/volumePricing";

/**
 * The order pad's data layer.
 *
 * One rule governs this whole file: a price is only ever resolved here, on the
 * server, from Convex. `unitPrice` becomes the Shopify `priceOverride` — it is
 * literally what the customer is charged — so a value that originated in the
 * browser would be a way to buy at any price. The client sends a SKU and a
 * quantity and nothing else.
 */

export type DraftLineInput = { sku: string; quantity: number };

export type ResolvedDraftLine = {
    sku: string;
    description: string;
    quantity: number;
    unitPrice?: number;
    shopifyVariantId?: string;
};

export type LineResolution =
    | { ok: true; line: ResolvedDraftLine }
    | { ok: false; sku: string; reason: "unknown_sku" | "no_price" };

/** Shopify wants the numeric id; Convex stores the full gid. */
function numericVariantId(gid: string | null | undefined): string | undefined {
    if (!gid) return undefined;
    const tail = gid.split("/").pop();
    return tail && /^\d+$/.test(tail) ? tail : undefined;
}

export async function resolveDraftLines(
    inputs: DraftLineInput[],
): Promise<LineResolution[]> {
    const convex = getPortalConvex();

    return await Promise.all(inputs.map(async (input): Promise<LineResolution> => {
        const sku = input.sku.trim();
        const quantity = Math.max(1, Math.floor(input.quantity));

        const hit = await convex.query(api.products.lookupSku, { sku });
        if (!hit?.product) return { ok: false, sku, reason: "unknown_sku" };

        const product = hit.product;
        // The published ladder, not the 1pc price. Shopify does not apply tier
        // pricing on its own, but a draft order's price override does, so the
        // wholesale rate the customer was shown is the rate that gets charged.
        const unitPrice = resolveQuotedUnitPrice(quantity, {
            webPrice1pc: product.webPrice1pc,
            webPrice10pc: product.webPrice10pc,
            webPrice12pc: product.webPrice12pc,
            priceTiers: product.priceTiers,
        });
        if (unitPrice === null) return { ok: false, sku, reason: "no_price" };

        return {
            ok: true,
            line: {
                sku: product.websiteSku ?? sku,
                description: product.itemName,
                quantity,
                unitPrice,
                shopifyVariantId: numericVariantId(product.shopifyVariantId),
            },
        };
    }));
}

export async function setDraftLinesForViewer(
    draftId: string,
    inputs: DraftLineInput[],
): Promise<{ rejected: LineResolution[]; lineCount: number; totalAmount: number }> {
    const viewer = await requirePortalViewer();
    const resolutions = await resolveDraftLines(inputs);
    const accepted = resolutions.flatMap((r) => (r.ok ? [r.line] : []));

    const result = await getPortalConvex().mutation(api.portal.setDraftLineItems, {
        writeToken: getPortalConvexWriteToken(),
        clerkOrgId: viewer.clerkOrgId,
        draftId: draftId as Id<"portalDrafts">,
        lineItems: accepted,
    });

    return {
        rejected: resolutions.filter((r) => !r.ok),
        lineCount: result.lineCount,
        totalAmount: result.totalAmount,
    };
}

export async function getDraftForViewer(draftId: string) {
    const viewer = await requirePortalViewer();
    return await getPortalConvex().query(api.portal.getDraftById, {
        clerkOrgId: viewer.clerkOrgId,
        draftId: draftId as Id<"portalDrafts">,
    });
}

export type SubmitDraftResult =
    | { ok: true; shopifyDraftOrderName: string }
    | { ok: false; error: string };

/**
 * Push a draft to Shopify as a DRAFT order, not a live one.
 *
 * Best Bottles has no net terms, so nothing here is bought on credit: the
 * draft lands under Orders → Drafts in the Shopify admin, a person checks the
 * quantities and prices, and they send the invoice. That review step is the
 * whole point — it is what stops a mistyped quantity becoming a committed
 * order.
 */
export async function submitDraftForViewer(draftId: string): Promise<SubmitDraftResult> {
    const viewer = await requirePortalViewer();

    const draft = await getPortalConvex().query(api.portal.getDraftById, {
        clerkOrgId: viewer.clerkOrgId,
        draftId: draftId as Id<"portalDrafts">,
    });
    if (!draft) return { ok: false, error: "That draft is no longer available." };
    if (draft.status === "submitted") {
        return { ok: false, error: "This draft has already been sent to Best Bottles." };
    }
    if (draft.lineItems.length === 0) {
        return { ok: false, error: "Add at least one item before sending." };
    }

    const missingVariant = draft.lineItems.filter((line) => !line.shopifyVariantId);
    if (missingVariant.length > 0) {
        return {
            ok: false,
            error: `${missingVariant.map((l) => l.sku).join(", ")} cannot be ordered online yet. Your account manager can quote these.`,
        };
    }

    // An order with nowhere to go is not an order. Shopify cannot rate, tax,
    // or fulfil a draft without an address, so the gate is here rather than a
    // warning after the fact.
    const addresses = await getPortalAddresses();
    if (!addresses.shippingAddress || !addressIsUsable(addresses.shippingAddress)) {
        return {
            ok: false,
            error: "Add a shipping address before sending this order — we can't ship or price freight without one.",
        };
    }

    const identity = await ensurePortalShopifyCustomer();
    if (identity.status !== "linked") {
        return {
            ok: false,
            error: "Your account is not linked to a customer record yet. Contact your account manager.",
        };
    }

    const account = await getPortalConvex().query(api.portal.getAccountByOrg, {
        clerkOrgId: viewer.clerkOrgId,
    });

    try {
        const shopifyDraft = await createWholesaleDraftOrder({
            customerId: identity.shopifyCustomerId,
            lines: draft.lineItems.map((line) => ({
                variantId: line.shopifyVariantId as string,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
            })),
            accountNumber: account?.accountNumber,
            companyName: account?.companyName,
            shippingAddress: toShopifyMailingAddress(addresses.shippingAddress),
            billingAddress: addresses.billingAddress
                ? toShopifyMailingAddress(addresses.billingAddress)
                : undefined,
        });

        await getPortalConvex().mutation(api.portal.markDraftSubmitted, {
            writeToken: getPortalConvexWriteToken(),
            clerkOrgId: viewer.clerkOrgId,
            draftId: draftId as Id<"portalDrafts">,
            shopifyDraftOrderId: shopifyDraft.draftOrderId,
            shopifyDraftOrderName: shopifyDraft.name,
            clerkUserId: viewer.clerkUserId,
        });

        return { ok: true, shopifyDraftOrderName: shopifyDraft.name };
    } catch (err) {
        console.error("[portal] draft submission failed:", err);
        return {
            ok: false,
            error: "We couldn't send that to Best Bottles just now. Try again, or contact your account manager.",
        };
    }
}

export type PadSearchHit = {
    sku: string;
    itemName: string;
    capacity: string | null;
    imageUrl: string | null;
    startingPrice: number | null;
    orderable: boolean;
};

/**
 * Product search for the pad. Runs through the portal viewer check so an
 * anonymous caller cannot use the portal as an unthrottled catalogue API.
 */
export async function searchProductsForViewer(term: string): Promise<PadSearchHit[]> {
    await requirePortalViewer();
    const trimmed = term.trim();
    if (trimmed.length < 2) return [];
    return await getPortalConvex().query(api.products.searchForOrderPad, {
        term: trimmed,
        limit: 8,
    });
}

export type AddToDraftResult =
    | { ok: true; draftId: string; draftName: string; sku: string; quantity: number }
    | { ok: false; reason: "unknown_sku" | "no_price" | "draft_closed" };

/**
 * Add one SKU to an open draft from the catalogue.
 *
 * Browsing and ordering are the same motion for a wholesale buyer, so a row in
 * the catalogue can go straight onto an order. The draft is chosen rather than
 * asked for: the newest open one, or a new one if every draft has been sent.
 * Making someone create a draft before they can add anything to it puts the
 * paperwork before the product.
 *
 * A submitted draft is never reopened — it is the record of what Shopify was
 * sent, and quietly appending to it would make the portal disagree with the
 * order that is already under review.
 *
 * As everywhere on the pad, only SKU and quantity cross the wire; the price is
 * resolved server-side by setDraftLinesForViewer.
 */
export async function addSkuToOpenDraftForViewer(args: {
    sku: string;
    quantity: number;
    draftId?: string;
}): Promise<AddToDraftResult> {
    const viewer = await requirePortalViewer();
    const convex = getPortalConvex();
    const sku = args.sku.trim();
    const quantity = Math.max(1, Math.floor(args.quantity) || 1);
    if (!sku) return { ok: false, reason: "unknown_sku" };

    // Resolve the SKU before touching a draft, so an unknown one does not
    // leave an empty draft behind as a souvenir of the failure.
    const [resolution] = await resolveDraftLines([{ sku, quantity }]);
    if (!resolution?.ok) {
        return { ok: false, reason: resolution?.reason === "no_price" ? "no_price" : "unknown_sku" };
    }

    const drafts = await convex.query(api.portal.listDraftsByOrg, { clerkOrgId: viewer.clerkOrgId });

    let target = args.draftId
        ? drafts.find((draft) => draft._id === args.draftId)
        : drafts.find((draft) => draft.status !== "submitted");

    if (args.draftId && !target) return { ok: false, reason: "draft_closed" };
    if (target && target.status === "submitted") return { ok: false, reason: "draft_closed" };

    if (!target) {
        const created = await convex.mutation(api.portal.createDraft, {
            writeToken: getPortalConvexWriteToken(),
            clerkOrgId: viewer.clerkOrgId,
        });
        const refreshed = await convex.query(api.portal.listDraftsByOrg, { clerkOrgId: viewer.clerkOrgId });
        target = refreshed.find((draft) => draft._id === created.draftId);
        if (!target) return { ok: false, reason: "draft_closed" };
    }

    // Adding a SKU already on the order raises its quantity rather than
    // creating a second line for the same thing.
    const merged = target.lineItems.map((line) => ({ sku: line.sku, quantity: line.quantity }));
    const existing = merged.find((line) => line.sku.toLowerCase() === sku.toLowerCase());
    if (existing) existing.quantity += quantity;
    else merged.push({ sku, quantity });

    await setDraftLinesForViewer(target._id, merged);

    return { ok: true, draftId: target._id, draftName: target.name, sku, quantity };
}
