import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

const MAX_PATCHES_PER_RUN = 250;

function isSanityCdnUrl(value: string) {
    try {
        return new URL(value).hostname === "cdn.sanity.io";
    } catch {
        return value.includes("cdn.sanity.io/");
    }
}

export const applyImageTruthPatch = internalMutation({
    args: {
        sourceLabel: v.string(),
        onlyIfMissing: v.optional(v.boolean()),
        groupHeroPatches: v.array(v.object({
            slug: v.string(),
            heroImageUrl: v.string(),
        })),
        variantImagePatches: v.optional(v.array(v.object({
            websiteSku: v.string(),
            imageUrl: v.optional(v.union(v.string(), v.null())),
            imageUrlCapOff: v.optional(v.union(v.string(), v.null())),
        }))),
    },
    handler: async (ctx, args) => {
        const onlyIfMissing = args.onlyIfMissing ?? true;
        const groupHeroPatches = args.groupHeroPatches.slice(0, MAX_PATCHES_PER_RUN);
        const variantImagePatches = (args.variantImagePatches ?? []).slice(0, MAX_PATCHES_PER_RUN);

        const result = {
            sourceLabel: args.sourceLabel,
            onlyIfMissing,
            groupHeroes: {
                requested: args.groupHeroPatches.length,
                processed: groupHeroPatches.length,
                patched: 0,
                skippedAlreadySet: 0,
                skippedSameValue: 0,
                notFound: [] as string[],
                rejectedSanity: [] as string[],
            },
            variants: {
                requested: args.variantImagePatches?.length ?? 0,
                processed: variantImagePatches.length,
                patched: 0,
                skippedAlreadySet: 0,
                skippedSameValue: 0,
                notFound: [] as string[],
                rejectedSanity: [] as string[],
            },
            truncated: args.groupHeroPatches.length > MAX_PATCHES_PER_RUN ||
                (args.variantImagePatches?.length ?? 0) > MAX_PATCHES_PER_RUN,
        };

        for (const patch of groupHeroPatches) {
            if (isSanityCdnUrl(patch.heroImageUrl)) {
                result.groupHeroes.rejectedSanity.push(patch.slug);
                continue;
            }

            const group = await ctx.db
                .query("productGroups")
                .withIndex("by_slug", (q) => q.eq("slug", patch.slug))
                .first();

            if (!group) {
                result.groupHeroes.notFound.push(patch.slug);
                continue;
            }
            if (group.heroImageUrl === patch.heroImageUrl) {
                result.groupHeroes.skippedSameValue++;
                continue;
            }
            if (onlyIfMissing && group.heroImageUrl) {
                result.groupHeroes.skippedAlreadySet++;
                continue;
            }

            await ctx.db.patch(group._id, { heroImageUrl: patch.heroImageUrl });
            result.groupHeroes.patched++;
        }

        for (const patch of variantImagePatches) {
            if (
                (patch.imageUrl && isSanityCdnUrl(patch.imageUrl)) ||
                (patch.imageUrlCapOff && isSanityCdnUrl(patch.imageUrlCapOff))
            ) {
                result.variants.rejectedSanity.push(patch.websiteSku);
                continue;
            }

            const product = await ctx.db
                .query("products")
                .withIndex("by_websiteSku", (q) => q.eq("websiteSku", patch.websiteSku))
                .first();

            if (!product) {
                result.variants.notFound.push(patch.websiteSku);
                continue;
            }

            const next: { imageUrl?: string; imageUrlCapOff?: string } = {};
            if (patch.imageUrl && product.imageUrl !== patch.imageUrl) {
                if (!onlyIfMissing || !product.imageUrl) next.imageUrl = patch.imageUrl;
            }
            if (patch.imageUrlCapOff && product.imageUrlCapOff !== patch.imageUrlCapOff) {
                if (!onlyIfMissing || !product.imageUrlCapOff) next.imageUrlCapOff = patch.imageUrlCapOff;
            }

            if (Object.keys(next).length === 0) {
                const hasDifferentExisting = Boolean(
                    (patch.imageUrl && product.imageUrl && product.imageUrl !== patch.imageUrl) ||
                    (patch.imageUrlCapOff && product.imageUrlCapOff && product.imageUrlCapOff !== patch.imageUrlCapOff),
                );
                if (hasDifferentExisting) result.variants.skippedAlreadySet++;
                else result.variants.skippedSameValue++;
                continue;
            }

            await ctx.db.patch(product._id, next);
            result.variants.patched++;
        }

        return result;
    },
});
