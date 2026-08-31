import { internalMutation } from "./_generated/server";
import {
    CYLINDER_SWIRL_WHITE_CAP_GROUP_SLUG,
    CYLINDER_SWIRL_WHITE_CAP_VARIANTS,
} from "../src/lib/products/cylinder-white-cap-repair";

/**
 * Restores the two real white-cap SKUs that complete the CYL-9ML cohort.
 *
 * Safety properties:
 * - idempotent when the canonical row already exists;
 * - reuses a single legacy website-SKU row when present;
 * - refuses to guess when duplicate product or group rows exist;
 * - always links to the exact 9 mL · 17-415 Swirl roll-on group.
 *
 * This is deliberately an internal mutation. Deploying the code does not run
 * it; production execution remains an explicit operator action.
 */
export const restoreSwirlWhiteCaps = internalMutation({
    args: {},
    handler: async (ctx) => {
        const groups = await ctx.db
            .query("productGroups")
            .withIndex("by_slug", (query) => query.eq("slug", CYLINDER_SWIRL_WHITE_CAP_GROUP_SLUG))
            .collect();

        if (groups.length !== 1) {
            throw new Error(
                `Expected exactly one ${CYLINDER_SWIRL_WHITE_CAP_GROUP_SLUG} group; received ${groups.length}`,
            );
        }

        const [group] = groups;
        if (
            group.family !== "Cylinder"
            || group.capacityMl !== 9
            || group.neckThreadSize !== "17-415"
            || group.paperDollFamilyKey !== "CYL-9ML"
        ) {
            throw new Error("Refusing repair because the target group is not CYL-9ML · 9 mL · 17-415");
        }

        const siblingVariants = await ctx.db
            .query("products")
            .withIndex("by_productGroupId", (query) => query.eq("productGroupId", group._id))
            .collect();
        const startingSkus = new Set(siblingVariants.map((variant) => variant.graceSku).filter(Boolean));
        if (startingSkus.size !== 18 && startingSkus.size !== 20) {
            throw new Error(
                `Refusing repair because the Swirl roll-on group has ${startingSkus.size} unique variants; expected 18 or 20`,
            );
        }
        const results: Array<{ graceSku: string; action: "inserted" | "updated" }> = [];

        for (const desired of CYLINDER_SWIRL_WHITE_CAP_VARIANTS) {
            const byGraceSku = await ctx.db
                .query("products")
                .withIndex("by_graceSku", (query) => query.eq("graceSku", desired.graceSku))
                .collect();
            const byWebsiteSku = await ctx.db
                .query("products")
                .withIndex("by_websiteSku", (query) => query.eq("websiteSku", desired.websiteSku))
                .collect();
            const matches = new Map(
                [...byGraceSku, ...byWebsiteSku].map((product) => [String(product._id), product]),
            );

            if (matches.size > 1) {
                throw new Error(
                    `Refusing to repair duplicate product rows for ${desired.graceSku}; received ${matches.size}`,
                );
            }

            const existing = [...matches.values()][0];
            const sibling = siblingVariants.find((variant) => variant.applicator === desired.applicator);
            const components = sibling?.components ?? existing?.components ?? [];
            const graceDescription = sibling?.graceDescription
                ?? existing?.graceDescription
                ?? "Accepts 17-415 thread. Compatible with 17-415 roller fitments and roll-on caps.";
            const fields = {
                ...desired,
                priceTiers: desired.priceTiers.map((tier) => ({ ...tier })),
                productGroupId: group._id,
                components,
                graceDescription,
            };

            if (existing) {
                await ctx.db.patch(existing._id, fields);
                results.push({ graceSku: desired.graceSku, action: "updated" });
            } else {
                await ctx.db.insert("products", fields);
                results.push({ graceSku: desired.graceSku, action: "inserted" });
            }
        }

        const finalVariants = await ctx.db
            .query("products")
            .withIndex("by_productGroupId", (query) => query.eq("productGroupId", group._id))
            .collect();
        const finalSkus = new Set(finalVariants.map((variant) => variant.graceSku).filter(Boolean));
        if (finalSkus.size !== 20) {
            throw new Error(`Repair verification expected 20 Swirl roll-on variants; received ${finalSkus.size}`);
        }
        for (const desired of CYLINDER_SWIRL_WHITE_CAP_VARIANTS) {
            if (!finalSkus.has(desired.graceSku)) {
                throw new Error(`Repair verification failed for ${desired.graceSku}`);
            }
        }

        await ctx.db.patch(group._id, { variantCount: finalSkus.size });
        return {
            groupSlug: group.slug,
            variantCount: finalSkus.size,
            results,
        };
    },
});
