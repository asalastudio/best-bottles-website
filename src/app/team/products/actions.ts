"use server";

import { isStaffAccessError } from "@/lib/portal/staff";
import { EMPTY_CREATE_PRODUCT_DRAFT, type CreateProductDraft } from "@/lib/team/createProduct";
import { createStaffProductFromDraft, requireStaffViewerOrLocalPreview } from "@/lib/team/createProductStaff";
import { getPortalConvex, getPortalConvexWriteToken } from "@/lib/portal/convexClient";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { loadGroupForEdit, retryPricePush, revertChange, saveGroup, saveProduct, type GroupPatch, type ProductPatch } from "@/lib/team/productEditStaff";

export type CreateProductState = {
    error: string | null;
    slug: string | null;
    websiteSku: string | null;
};

function readDraft(formData: FormData): CreateProductDraft {
    const text = (key: keyof CreateProductDraft) => String(formData.get(key) ?? "");
    return {
        ...EMPTY_CREATE_PRODUCT_DRAFT,
        displayName: text("displayName"),
        family: text("family"),
        category: text("category"),
        capacityMl: Number(formData.get("capacityMl") ?? EMPTY_CREATE_PRODUCT_DRAFT.capacityMl),
        color: text("color"),
        neckThreadSize: text("neckThreadSize"),
        bottleCollection: text("bottleCollection"),
        websiteSku: text("websiteSku"),
        graceSku: text("graceSku"),
        itemName: text("itemName"),
        itemDescription: text("itemDescription"),
        groupDescription: text("groupDescription"),
        applicator: text("applicator") as CreateProductDraft["applicator"],
        capColor: text("capColor"),
        capStyle: text("capStyle"),
        trimColor: text("trimColor"),
        componentProfile: text("componentProfile"),
        ballMaterial: text("ballMaterial"),
        heightWithCap: text("heightWithCap"),
        heightWithoutCap: text("heightWithoutCap"),
        diameter: text("diameter"),
        bottleWeightG: text("bottleWeightG"),
        caseQuantity: text("caseQuantity"),
        webPrice1pc: text("webPrice1pc"),
        webPrice12pc: text("webPrice12pc"),
        heroImageUrl: text("heroImageUrl"),
        imageUrl: text("imageUrl"),
        imageUrlCapOff: text("imageUrlCapOff"),
        paperDollFamilyKey: text("paperDollFamilyKey"),
        stockStatus: text("stockStatus") || "In Stock",
    };
}

export async function createProductAction(
    _prev: CreateProductState,
    formData: FormData,
): Promise<CreateProductState> {
    try {
        const { ready, result } = await createStaffProductFromDraft(readDraft(formData));
        if (!result.created) {
            return { error: result.detail, slug: result.slug, websiteSku: result.websiteSku };
        }
        return { error: null, slug: ready.slug, websiteSku: ready.websiteSku };
    } catch (error) {
        if (isStaffAccessError(error)) {
            return { error: "You don't have permission to create products.", slug: null, websiteSku: null };
        }
        const message = error instanceof Error ? error.message : "We couldn't create that product.";
        return { error: message, slug: null, websiteSku: null };
    }
}

export async function createProductImageUploadUrlAction(): Promise<string> {
    await requireStaffViewerOrLocalPreview();
    return await getPortalConvex().mutation(api.staffProducts.generateImageUploadUrl, {
        writeToken: getPortalConvexWriteToken(),
    });
}

export async function resolveProductImageUrlAction(storageId: string): Promise<string> {
    await requireStaffViewerOrLocalPreview();
    const url = await getPortalConvex().mutation(api.staffProducts.resolveImageUrl, {
        writeToken: getPortalConvexWriteToken(),
        storageId: storageId as Id<"_storage">,
    });
    if (!url) throw new Error("That upload finished, but we couldn't get a usable image URL.");
    return url;
}

// ─── Edit products (docs/specs/team-hub-product-editor.md) ──────────────────
// Each action re-checks the staff sign-in inside productEditStaff; a client can call these directly.


function refusal(error: unknown) {
    if (isStaffAccessError(error)) return { ok: false as const, error: "You don't have permission to edit products." };
    const message = error instanceof Error ? error.message : "";
    // Convex hides the reason from a production client; a missing function and a thrown error look the same.
    if (/Server Error|Could not find public function/.test(message)) {
        return { ok: false as const, error: "The product editor could not reach its database functions. If this is new, the Convex deploy has not happened yet. Nothing was changed." };
    }
    return { ok: false as const, error: message || "That didn't save. Nothing was changed." };
}

export async function loadGroupForEditAction(slug: string) {
    try { return { ok: true as const, view: await loadGroupForEdit(slug) }; } catch (error) { return refusal(error); }
}

export async function saveProductAction(args: { productId: string; shopifyProductId: string | null; expect: ProductPatch; patch: ProductPatch }) {
    try { return await saveProduct(args); } catch (error) { return refusal(error); }
}

export async function saveGroupAction(args: { groupId: string; expect: GroupPatch; patch: GroupPatch }) {
    try { return await saveGroup(args); } catch (error) { return refusal(error); }
}

export async function revertChangeAction(args: { changeId: string; shopifyProductId: string | null }) {
    try { return await revertChange(args); } catch (error) { return refusal(error); }
}

export async function retryPricePushAction(args: { changeId: string; shopifyProductId: string | null; shopifyVariantId: string | null; price: number }) {
    try { return { ok: true as const, push: await retryPricePush(args) }; } catch (error) { return refusal(error); }
}
