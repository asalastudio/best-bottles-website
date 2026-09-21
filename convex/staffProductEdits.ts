import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { verifyWriteToken } from "./writeToken";
import {
    GROUP_EDIT_FIELDS, PRODUCT_EDIT_FIELDS, priceColumnsFromTiers, sameValue, tiersFromRungs,
    validateGroupPatch, validateProductPatch, type GroupEditField, type PriceRung, type ProductEditField,
} from "./staffProductEditRules";

/**
 * Team Hub product editing (docs/specs/team-hub-product-editor.md).
 *
 * Called only from Next.js server actions that have already checked the staff sign-in; the write
 * token is the second gate. Three rules hold for every write:
 *   1. only the fields in staffProductEditRules can be written — never identity or fitment;
 *   2. a save names the value the editor SAW (`expect`); if the row has moved on, nothing is
 *      written and the current value is returned, so two people cannot silently overwrite each other;
 *   3. every field written leaves one catalogChangeLog entry, which is what revert reads.
 */

const actorV = v.object({ id: v.string(), email: v.union(v.string(), v.null()) });
const rungV = v.object({ minQty: v.number(), unitPrice: v.number() });
const productPatchV = v.object({
    itemDescription: v.optional(v.union(v.string(), v.null())),
    stockStatus: v.optional(v.string()),
    caseQuantity: v.optional(v.union(v.number(), v.null())),
    priceTiers: v.optional(v.array(rungV)),
});
const groupPatchV = v.object({
    customName: v.optional(v.union(v.string(), v.null())),
    groupDescription: v.optional(v.union(v.string(), v.null())),
});

type Row = Record<string, unknown>;
/** The ladder as staff edit it: quantity and price each. */
const rungsOf = (row: Row): PriceRung[] => {
    const tiers = (row.priceTiers as { minQty: number; unitPrice: number }[] | undefined) ?? [];
    if (tiers.length) return tiers.map(t => ({ minQty: t.minQty, unitPrice: t.unitPrice }));
    return typeof row.webPrice1pc === "number" ? [{ minQty: 1, unitPrice: row.webPrice1pc }] : [];
};
const currentOf = (row: Row, field: string) => field === "priceTiers" ? rungsOf(row) : row[field] ?? null;

async function log(ctx: MutationCtx, entry: { targetType: "product" | "group"; targetId: string; label: string; field: string; before: unknown; after: unknown;
    actor: { id: string; email: string | null }; source: string; revertOf?: Id<"catalogChangeLog">; pricePush?: boolean }) {
    return await ctx.db.insert("catalogChangeLog", {
        targetType: entry.targetType, targetId: entry.targetId, label: entry.label, field: entry.field,
        before: JSON.stringify(entry.before ?? null), after: JSON.stringify(entry.after ?? null),
        actorId: entry.actor.id, actorEmail: entry.actor.email, at: Date.now(), source: entry.source,
        ...(entry.revertOf ? { revertOf: entry.revertOf } : {}),
    });
}

/** Writes one validated patch. Shared by save and revert so both obey the same three rules. */
async function applyProductPatch(ctx: MutationCtx, productId: Id<"products">, expect: Row, patch: Row, actor: { id: string; email: string | null }, source: string, revertOf?: Id<"catalogChangeLog">) {
    const row = await ctx.db.get(productId) as Row | null;
    if (!row) return { ok: false as const, error: "That product no longer exists." };
    const invalid = validateProductPatch(patch as Partial<Record<ProductEditField, unknown>>);
    if (invalid) return { ok: false as const, error: invalid };
    const conflicts = Object.keys(patch).filter(f => f in expect && !sameValue(currentOf(row, f), expect[f])).map(f => ({ field: f, current: currentOf(row, f) }));
    if (conflicts.length) return { ok: false as const, error: "Someone else changed this since you opened it.", conflicts };

    const write: Row = {}; const changes: { field: string; logId: Id<"catalogChangeLog"> }[] = [];
    let priceChanged: { before: number | null; after: number } | null = null;
    for (const field of PRODUCT_EDIT_FIELDS) {
        if (!(field in patch) || sameValue(currentOf(row, field), patch[field])) continue;
        if (field === "priceTiers") {
            const tiers = tiersFromRungs(patch.priceTiers as PriceRung[]);
            Object.assign(write, { priceTiers: tiers, ...priceColumnsFromTiers(tiers) });
            if (row.webPrice1pc !== tiers[0].unitPrice) priceChanged = { before: (row.webPrice1pc as number | null) ?? null, after: tiers[0].unitPrice };
        } else write[field] = patch[field];
        changes.push({ field, logId: await log(ctx, { targetType: "product", targetId: String(productId), label: String(row.websiteSku ?? row.graceSku), field,
            before: currentOf(row, field), after: field === "priceTiers" ? patch.priceTiers : write[field], actor, source, revertOf }) });
    }
    if (Object.keys(write).length) await ctx.db.patch(productId, write as never);
    return { ok: true as const, changes, priceChanged, priceLogId: changes.find(c => c.field === "priceTiers")?.logId ?? null,
        shopifyVariantId: (row.shopifyVariantId as string | null | undefined) ?? null, productGroupId: (row.productGroupId as string | undefined) ?? null };
}

async function applyGroupPatch(ctx: MutationCtx, groupId: Id<"productGroups">, expect: Row, patch: Row, actor: { id: string; email: string | null }, source: string, revertOf?: Id<"catalogChangeLog">) {
    const row = await ctx.db.get(groupId) as Row | null;
    if (!row) return { ok: false as const, error: "That product no longer exists." };
    const invalid = validateGroupPatch(patch as Partial<Record<GroupEditField, unknown>>);
    if (invalid) return { ok: false as const, error: invalid };
    const conflicts = Object.keys(patch).filter(f => f in expect && !sameValue(row[f] ?? null, expect[f])).map(f => ({ field: f, current: row[f] ?? null }));
    if (conflicts.length) return { ok: false as const, error: "Someone else changed this since you opened it.", conflicts };
    const write: Row = {}; const changes: { field: string; logId: Id<"catalogChangeLog"> }[] = [];
    for (const field of GROUP_EDIT_FIELDS) {
        if (!(field in patch) || sameValue(row[field] ?? null, patch[field])) continue;
        // a cleared custom name is stored as null, so "no override" has exactly one spelling
        write[field] = field === "customName" ? ((patch.customName as string | null)?.trim() || null) : patch[field];
        changes.push({ field, logId: await log(ctx, { targetType: "group", targetId: String(groupId), label: String(row.slug), field, before: row[field] ?? null, after: write[field], actor, source, revertOf }) });
    }
    if (Object.keys(write).length) await ctx.db.patch(groupId, write as never);
    // same shape as a product save, so a caller handling either never has to guess: a group has no price
    return { ok: true as const, changes, priceChanged: null, priceLogId: null, shopifyVariantId: null, productGroupId: String(groupId) };
}

export const getGroupForEdit = query({
    args: { writeToken: v.string(), slug: v.string() },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        const group = await ctx.db.query("productGroups").withIndex("by_slug", q => q.eq("slug", args.slug)).first();
        if (!group) return null;
        const variants = await ctx.db.query("products").withIndex("by_productGroupId", q => q.eq("productGroupId", group._id)).collect();
        return {
            group: { id: group._id, slug: group.slug, customName: group.customName ?? null, groupDescription: group.groupDescription ?? null, shopifyProductId: group.shopifyProductId ?? null,
                // read-only: what the name composer needs, so the editor can show the name customers see
                naming: { slug: group.slug, displayName: group.displayName, family: group.family ?? null, capacity: group.capacity ?? null, capacityMl: group.capacityMl ?? null,
                    color: group.color ?? null, category: group.category ?? null, neckThreadSize: group.neckThreadSize ?? null, applicatorTypes: group.applicatorTypes ?? null } },
            variants: variants.sort((a, b) => (a.websiteSku ?? "").localeCompare(b.websiteSku ?? "")).map(p => ({
                id: p._id, websiteSku: p.websiteSku, graceSku: p.graceSku, itemName: p.itemName, itemDescription: p.itemDescription ?? null,
                stockStatus: p.stockStatus ?? null, caseQuantity: p.caseQuantity ?? null, priceTiers: rungsOf(p as unknown as Row),
                capColor: p.capColor ?? null, applicator: p.applicator ?? null, capStyle: p.capStyle ?? null, trimColor: p.trimColor ?? null,
                family: p.family ?? null, capacity: p.capacity ?? null, capacityMl: p.capacityMl ?? null, color: p.color ?? null, category: p.category ?? null, shopifyVariantId: p.shopifyVariantId ?? null, shopifySellable: p.shopifySellable ?? null,
            })),
        };
    },
});

export const updateProduct = mutation({
    args: { writeToken: v.string(), productId: v.id("products"), expect: productPatchV, patch: productPatchV, actor: actorV },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        return await applyProductPatch(ctx, args.productId, args.expect as Row, args.patch as Row, args.actor, "team-hub");
    },
});

export const updateGroup = mutation({
    args: { writeToken: v.string(), groupId: v.id("productGroups"), expect: groupPatchV, patch: groupPatchV, actor: actorV },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        return await applyGroupPatch(ctx, args.groupId, args.expect as Row, args.patch as Row, args.actor, "team-hub");
    },
});

/** Put one field back to what it was before one logged edit — only while it still holds that edit's value. */
export const revertChange = mutation({
    args: { writeToken: v.string(), changeId: v.id("catalogChangeLog"), actor: actorV },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        const change = await ctx.db.get(args.changeId);
        if (!change) return { ok: false as const, error: "That history entry no longer exists." };
        if (change.revertedBy) return { ok: false as const, error: "That change has already been reverted." };
        const expect = { [change.field]: JSON.parse(change.after) }, patch = { [change.field]: JSON.parse(change.before) };
        const result = change.targetType === "product"
            ? await applyProductPatch(ctx, change.targetId as Id<"products">, expect, patch, args.actor, "team-hub-revert", change._id)
            : await applyGroupPatch(ctx, change.targetId as Id<"productGroups">, expect, patch, args.actor, "team-hub-revert", change._id);
        if (result.ok && result.changes.length) await ctx.db.patch(change._id, { revertedBy: result.changes[0].logId });
        return result;
    },
});

export const recordShopifyPush = mutation({
    args: { writeToken: v.string(), changeId: v.id("catalogChangeLog"), status: v.union(v.literal("ok"), v.literal("failed"), v.literal("off")), detail: v.union(v.string(), v.null()) },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        await ctx.db.patch(args.changeId, { shopifyPush: { status: args.status, detail: args.detail, at: Date.now() } });
        return { ok: true };
    },
});

export const changeLogFor = query({
    args: { writeToken: v.string(), targets: v.array(v.object({ targetType: v.union(v.literal("product"), v.literal("group")), targetId: v.string() })) },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        const entries = (await Promise.all(args.targets.slice(0, 120).map(t =>
            ctx.db.query("catalogChangeLog").withIndex("by_target", q => q.eq("targetType", t.targetType).eq("targetId", t.targetId)).order("desc").take(15)))).flat();
        return entries.sort((a, b) => b.at - a.at).slice(0, 60).map(e => ({ id: e._id, targetType: e.targetType, targetId: e.targetId, label: e.label, field: e.field,
            before: e.before, after: e.after, actorEmail: e.actorEmail, at: e.at, source: e.source, reverted: Boolean(e.revertedBy), shopifyPush: e.shopifyPush ?? null }));
    },
});
