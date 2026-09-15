import "server-only";

import { api } from "../../../convex/_generated/api";
import { CLERK_ENABLED } from "@/lib/clerk";
import { getPortalConvex, getPortalConvexWriteToken } from "@/lib/portal/convexClient";
import { requireStaffViewer } from "@/lib/portal/staff";
import { type CreateProductDraft, prepareCreateProduct } from "@/lib/team/createProduct";

export async function requireStaffViewerOrLocalPreview() {
    if (!CLERK_ENABLED && process.env.NODE_ENV !== "production") {
        return { clerkUserId: "local-preview", emailAddresses: [] as string[] };
    }
    return requireStaffViewer();
}

export async function createStaffProductFromDraft(draft: CreateProductDraft) {
    await requireStaffViewerOrLocalPreview();
    const ready = prepareCreateProduct(draft);
    const payload = {
        slug: ready.slug,
        displayName: ready.displayName,
        family: ready.family,
        category: ready.category,
        capacity: ready.capacity,
        capacityMl: ready.capacityMl,
        color: ready.color,
        neckThreadSize: ready.neckThreadSize,
        bottleCollection: ready.bottleCollection,
        groupDescription: ready.groupDescription,
        websiteSku: ready.websiteSku,
        graceSku: ready.graceSku,
        itemName: ready.itemName,
        itemDescription: ready.itemDescription,
        applicator: ready.applicator,
        capColor: ready.capColor,
        capStyle: ready.capStyle,
        trimColor: ready.trimColor,
        componentProfile: ready.componentProfile,
        ballMaterial: ready.ballMaterial,
        heightWithCap: ready.heightWithCap,
        heightWithoutCap: ready.heightWithoutCap,
        diameter: ready.diameter,
        bottleWeightG: ready.bottleWeightG,
        caseQuantity: ready.caseQuantity,
        webPrice1pc: ready.webPrice1pc,
        webPrice12pc: ready.webPrice12pc,
        priceTiers: ready.priceTiers,
        heroImageUrl: ready.heroImageUrl,
        imageUrl: ready.imageUrl,
        imageUrlCapOff: ready.imageUrlCapOff,
        paperDollFamilyKey: ready.paperDollFamilyKey,
        stockStatus: ready.stockStatus,
    };
    const result = await getPortalConvex().mutation(api.staffProducts.createStaffProduct, {
        writeToken: getPortalConvexWriteToken(),
        ...payload,
        source: "team-hub-create-product",
    });
    return { ready, result };
}
