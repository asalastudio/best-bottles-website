import "server-only";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { getPortalConvex, getPortalConvexWriteToken } from "@/lib/portal/convexClient";
import { requireStaffViewerOrLocalPreview } from "@/lib/team/createProductStaff";
import { pushVariantPrice } from "@/lib/team/shopifyPricePush";
import type { PriceRung } from "../../../convex/staffProductEditRules";

/** Every Team Hub product edit: staff sign-in first, then the token-gated mutation. */
async function staff() {
    const viewer = await requireStaffViewerOrLocalPreview();
    return { convex: getPortalConvex(), writeToken: getPortalConvexWriteToken(), actor: { id: viewer.clerkUserId, email: viewer.emailAddresses[0] ?? null } };
}

export type ProductPatch = { itemDescription?: string | null; stockStatus?: string; caseQuantity?: number | null; priceTiers?: PriceRung[] };
export type GroupPatch = { customName?: string | null; groupDescription?: string | null };

export async function loadGroupForEdit(slug: string) {
    const { convex, writeToken } = await staff();
    const view = await convex.query(api.staffProductEdits.getGroupForEdit, { writeToken, slug });
    if (!view) return null;
    const history = await convex.query(api.staffProductEdits.changeLogFor, { writeToken,
        targets: [{ targetType: "group" as const, targetId: String(view.group.id) }, ...view.variants.map(v => ({ targetType: "product" as const, targetId: String(v.id) }))] });
    return { ...view, history };
}

/** A changed 1-piece price goes to Shopify in the same action; the outcome is written on the history line. */
async function pushIfPriceChanged(result: { priceChanged: { after: number } | null; priceLogId: string | null; shopifyVariantId: string | null }, shopifyProductId: string | null) {
    if (!result.priceChanged || !result.priceLogId) return null;
    const { convex, writeToken } = await staff();
    const push = await pushVariantPrice({ shopifyProductId, shopifyVariantId: result.shopifyVariantId, price: result.priceChanged.after });
    await convex.mutation(api.staffProductEdits.recordShopifyPush, { writeToken, changeId: result.priceLogId as Id<"catalogChangeLog">, status: push.status, detail: push.detail });
    return push;
}

export async function saveProduct(args: { productId: string; shopifyProductId: string | null; expect: ProductPatch; patch: ProductPatch }) {
    const { convex, writeToken, actor } = await staff();
    const result = await convex.mutation(api.staffProductEdits.updateProduct, { writeToken, actor, productId: args.productId as Id<"products">, expect: args.expect, patch: args.patch });
    if (!result.ok) return result;
    return { ...result, shopifyPush: await pushIfPriceChanged(result, args.shopifyProductId) };
}

export async function saveGroup(args: { groupId: string; expect: GroupPatch; patch: GroupPatch }) {
    const { convex, writeToken, actor } = await staff();
    return await convex.mutation(api.staffProductEdits.updateGroup, { writeToken, actor, groupId: args.groupId as Id<"productGroups">, expect: args.expect, patch: args.patch });
}

export async function revertChange(args: { changeId: string; shopifyProductId: string | null }) {
    const { convex, writeToken, actor } = await staff();
    const result = await convex.mutation(api.staffProductEdits.revertChange, { writeToken, actor, changeId: args.changeId as Id<"catalogChangeLog"> });
    if (!result.ok) return result;
    return { ...result, shopifyPush: await pushIfPriceChanged(result, args.shopifyProductId) };
}

/** Retry a Shopify price update that failed, using the price the catalogue holds now. */
export async function retryPricePush(args: { changeId: string; shopifyProductId: string | null; shopifyVariantId: string | null; price: number }) {
    const { convex, writeToken } = await staff();
    const push = await pushVariantPrice({ shopifyProductId: args.shopifyProductId, shopifyVariantId: args.shopifyVariantId, price: args.price });
    await convex.mutation(api.staffProductEdits.recordShopifyPush, { writeToken, changeId: args.changeId as Id<"catalogChangeLog">, status: push.status, detail: push.detail });
    return push;
}
