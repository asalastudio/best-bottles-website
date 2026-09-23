import { internalMutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { FOUR_FAMILY_COMPONENT_REPAIR as scope, assertTasselGroup, planCircleKitRepair, planTasselMembership } from "./repairs/fourFamilyComponents";

/**
 * Explicit operator repair, NOT a query-time override. Deployment alone changes no data.
 * Defaults to dry-run; validates the entire scope before writing in one transaction.
 * Returns all replaced fields for the SKU-scoped rollback receipt.
 */
export const run = internalMutation({
    args: { dryRun: v.optional(v.boolean()) },
    handler: async (ctx, { dryRun = true }) => {
        const kitChanges = [];
        for (const recipe of scope.kitRoles) {
            const rows = await ctx.db.query("productKits").withIndex("by_websiteSku", q => q.eq("websiteSku", recipe.sku)).collect();
            if (rows.length !== 1 || rows[0].sku !== recipe.sku) throw new Error(`Expected one exact kit: ${recipe.sku}`);
            const kit = rows[0];
            const plates = await ctx.db.query("productPlates").withIndex("by_sku", q => q.eq("sku", kit.sku)).collect();
            if (plates.length !== 1) throw new Error(`Expected one exact plate: ${recipe.sku}`);
            const patch = planCircleKitRepair(recipe.sku, kit, plates[0].front.sha256);
            if (patch) kitChanges.push({ id: kit._id, sku: recipe.sku,
                before: { anchors: kit.anchors, parts: kit.parts, revision: kit.revision, importedAt: kit.importedAt },
                after: { ...patch, revision: kit.revision + 1, importedAt: Date.now() } });
        }

        const groups = new Map<string, Doc<"productGroups">>();
        for (const slug of new Set(scope.membership.flatMap(r => [r.fromGroup, r.proposedGroup]))) {
            const rows = await ctx.db.query("productGroups").withIndex("by_slug", q => q.eq("slug", slug)).collect();
            if (rows.length > 1) throw new Error(`Duplicate group: ${slug}`);
            if (rows[0]) groups.set(slug, rows[0]);
        }
        const newGroups = new Map<string, Omit<Doc<"productGroups">, "_id" | "_creationTime">>();
        const productChanges = [];
        for (const recipe of scope.membership) {
            const source = groups.get(recipe.fromGroup);
            if (!source) throw new Error(`Missing source group: ${recipe.fromGroup}`);
            assertTasselGroup(source, recipe.identity);
            const target = groups.get(recipe.proposedGroup);
            if (target) assertTasselGroup(target, recipe.identity);
            const rows = await ctx.db.query("products").withIndex("by_websiteSku", q => q.eq("websiteSku", recipe.sku)).collect();
            if (rows.length !== 1) throw new Error(`Expected one exact product: ${recipe.sku}`);
            const product = rows[0];
            const currentGroup = product.productGroupId ? await ctx.db.get(product.productGroupId) : null;
            if (!currentGroup) throw new Error(`Missing product group: ${recipe.sku}`);
            const patch = planTasselMembership(product, currentGroup.slug);
            if (!patch) continue;
            if (!target && !newGroups.has(recipe.proposedGroup)) {
                // Whitelist bottle facts. Never inherit a plain-bulb hero, primary SKU or Shopify parent.
                newGroups.set(recipe.proposedGroup, {
                    slug: recipe.proposedGroup, displayName: `${source.displayName} with Tassel`,
                    family: source.family, capacity: source.capacity, capacityMl: source.capacityMl,
                    color: source.color, category: source.category, bottleCollection: source.bottleCollection,
                    neckThreadSize: source.neckThreadSize, variantCount: 0, priceRangeMin: null, priceRangeMax: null,
                    applicatorTypes: [patch.applicator],
                });
            }
            productChanges.push({ id: product._id, sku: recipe.sku, before: {
                productGroupId: product.productGroupId!, applicator: product.applicator,
            }, after: patch, product });
        }

        const groupChanges = [];
        // Recount only touched groups, from their actual variants plus these exact moves.
        const touched = new Set(productChanges.flatMap(p => [
            [...groups.values()].find(g => g._id === p.before.productGroupId)!.slug, p.after.groupSlug,
        ]));
        for (const slug of touched) {
            const group = groups.get(slug);
            const existing = group ? await ctx.db.query("products").withIndex("by_productGroupId", q => q.eq("productGroupId", group._id)).collect() : [];
            const movedIds = new Set(productChanges.map(p => p.id));
            const variants = existing.filter(p => !movedIds.has(p._id)).concat(productChanges
                .filter(p => p.after.groupSlug === slug).map(p => ({ ...p.product, applicator: p.after.applicator })));
            if (!variants.length) throw new Error(`Repair would empty an existing route: ${slug}`);
            const prices = variants.map(p => p.webPrice1pc).filter((p): p is number => p !== null);
            const primary = variants.find(p => p.websiteSku === group?.primaryWebsiteSku)
                ?? variants.find(p => p.graceSku === group?.primaryGraceSku) ?? variants[0];
            const after = { variantCount: variants.length, priceRangeMin: prices.length ? Math.min(...prices) : null,
                priceRangeMax: prices.length ? Math.max(...prices) : null,
                applicatorTypes: [...new Set(variants.map(p => p.applicator).filter((a): a is NonNullable<typeof a> => !!a))],
                primaryWebsiteSku: primary.websiteSku, primaryGraceSku: primary.graceSku };
            groupChanges.push({ slug, id: group?._id ?? null, before: group ? {
                variantCount: group.variantCount, priceRangeMin: group.priceRangeMin, priceRangeMax: group.priceRangeMax,
                applicatorTypes: group.applicatorTypes ?? null, primaryWebsiteSku: group.primaryWebsiteSku ?? null,
                primaryGraceSku: group.primaryGraceSku ?? null,
            } : null, after });
        }

        if (!dryRun) {
            const ids = new Map<string, Id<"productGroups">>([...groups].map(([slug, g]) => [slug, g._id]));
            for (const [slug, fields] of newGroups) ids.set(slug, await ctx.db.insert("productGroups", fields));
            for (const change of kitChanges) await ctx.db.patch(change.id, change.after);
            for (const change of productChanges) await ctx.db.patch(change.id, {
                applicator: change.after.applicator, productGroupId: ids.get(change.after.groupSlug)!,
            });
            for (const change of groupChanges) {
                change.id = ids.get(change.slug)!;
                await ctx.db.patch(change.id, change.after);
            }
        }
        return { version: scope.version, dryRun, kitChanges,
            productChanges: productChanges.map(({ id, sku, before, after }) => ({ id, sku, before, after })),
            newGroups: [...newGroups.keys()], groupChanges };
    },
});
