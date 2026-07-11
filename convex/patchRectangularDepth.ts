import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Populate `depthMm` for a single (family, capacityMl, widthMm) cohort of
 * rectangular-family rows. Used after migrateDiameterToWidthDepth has
 * left depthMm null on Elegant/Flair/Rectangle rows and a measured depth
 * value comes in from Grace specs / live site / FireCrawl.
 *
 * Why widthMm is part of the key (not just family + capacityMl): the same
 * family + capacity can have multiple widthMm cohorts due to contamination
 * (e.g. Elegant 100ml has both widthMm=35 correct rows and widthMm=78
 * contamination rows). Keying on the triple ensures we only patch the
 * cohort whose width matches the depth being supplied.
 *
 * Idempotent: rows already at the target depthMm are counted under
 * `alreadyCorrect` and left untouched.
 *
 * Usage:
 *   Dry-run dev:
 *     npx convex run patchRectangularDepth:patchRectangularDepth \
 *       '{"family":"Elegant","capacityMl":100,"widthMm":35,"depthMm":24,"dryRun":true}'
 *   Apply dev:
 *     npx convex run patchRectangularDepth:patchRectangularDepth \
 *       '{"family":"Elegant","capacityMl":100,"widthMm":35,"depthMm":24}'
 *   Apply prod:
 *     CONVEX_DEPLOY_KEY=<prod-key> npx convex run \
 *       patchRectangularDepth:patchRectangularDepth \
 *       '{"family":"Elegant","capacityMl":100,"widthMm":35,"depthMm":24}'
 */
export const patchRectangularDepth = internalMutation({
    args: {
        family: v.string(),
        capacityMl: v.number(),
        widthMm: v.number(),
        depthMm: v.number(),
        dryRun: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const dryRun = !!args.dryRun;

        const familyRows = await ctx.db
            .query("products")
            .withIndex("by_family", (q) => q.eq("family", args.family))
            .collect();

        const cohort = familyRows.filter(
            (r) =>
                r.capacityMl === args.capacityMl &&
                (r as unknown as { widthMm?: number | null }).widthMm ===
                    args.widthMm,
        );

        let updated = 0;
        let alreadyCorrect = 0;

        for (const row of cohort) {
            const current = (row as unknown as { depthMm?: number | null })
                .depthMm;
            if (current === args.depthMm) {
                alreadyCorrect++;
                continue;
            }
            if (!dryRun) {
                await ctx.db.patch(row._id, {
                    depthMm: args.depthMm,
                } as Record<string, unknown>);
            }
            updated++;
        }

        return {
            dryRun,
            family: args.family,
            capacityMl: args.capacityMl,
            widthMm: args.widthMm,
            depthMm: args.depthMm,
            cohortSize: cohort.length,
            updated,
            alreadyCorrect,
        };
    },
});
