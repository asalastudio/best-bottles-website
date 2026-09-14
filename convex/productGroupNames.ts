/**
 * Display-name disambiguation for product groups.
 *
 * `buildGroupKey` separates groups by neck finish but `buildDisplayName` never
 * mentions one, so two genuinely different products can carry the same name.
 * A customer searching "9ml roll metal" saw this:
 *
 *     9 ml Clear Cylinder Roll-On Bottle     cylinder-9ml-clear-17-415-rollon
 *     9 ml Clear Cylinder Roll-On Bottle     cylinder-9ml-clear-13-415-rollon
 *
 * Two rows, indistinguishable on screen, different bore. There is no way to
 * pick correctly from that list.
 *
 * The fix cannot live in `buildDisplayName`, which sees one group at a time and
 * cannot know whether a name is taken. It has to be a pass over the finished
 * set. Naming every group by its neck was the alternative and it is worse: 366
 * of 380 groups have no ambiguity to resolve, and the suffix would be noise on
 * all of them.
 *
 * The separator is " — ", which is already the convention for component names
 * and which `convex/grace.ts` splits on to recover the base product type.
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { verifyWriteToken } from "./portalAuth";

/** "9 ml Clear Cylinder Roll-On Bottle" + "17-415" */
function withNeck(displayName: string, neck: string): string {
    return `${displayName} — ${neck} neck`;
}

export const disambiguateDisplayNames = mutation({
    args: { writeToken: v.string(), dryRun: v.optional(v.boolean()) },
    returns: v.object({
        collisions: v.number(),
        renamed: v.number(),
        unresolved: v.array(v.string()),
        examples: v.array(v.object({ from: v.string(), to: v.string(), slug: v.string() })),
    }),
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);

        // 380 rows. Small enough to read whole, unlike `products`, which
        // crossed Convex's per-execution limit at 2,330 documents.
        const groups = await ctx.db.query("productGroups").collect();

        const byName = new Map<string, typeof groups>();
        for (const group of groups) {
            const key = (group.displayName ?? "").trim();
            if (!key) continue;
            const bucket = byName.get(key);
            if (bucket) bucket.push(group);
            else byName.set(key, [group]);
        }

        let collisions = 0;
        let renamed = 0;
        const unresolved: string[] = [];
        const examples: Array<{ from: string; to: string; slug: string }> = [];

        for (const [name, bucket] of byName) {
            if (bucket.length < 2) continue;
            collisions += 1;

            for (const group of bucket) {
                const neck = group.neckThreadSize?.trim();
                if (!neck) {
                    // Nothing to disambiguate with. Renaming on some other axis
                    // would be a guess, and a guessed product name is worse
                    // than an ambiguous one.
                    unresolved.push(group.slug);
                    continue;
                }
                if (name.includes(neck)) continue;

                const next = withNeck(name, neck);
                if (examples.length < 4) {
                    examples.push({ from: name, to: next, slug: group.slug });
                }
                if (!args.dryRun) {
                    await ctx.db.patch(group._id, { displayName: next });
                }
                renamed += 1;
            }
        }

        return { collisions, renamed, unresolved, examples };
    },
});
