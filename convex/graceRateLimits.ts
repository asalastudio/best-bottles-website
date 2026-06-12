import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const check = mutation({
    args: {
        route: v.string(),
        identifier: v.string(),
        limit: v.number(),
        windowMs: v.number(),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        const windowStart = Math.floor(now / args.windowMs) * args.windowMs;
        const safeIdentifier = args.identifier.slice(0, 160);
        const key = `${args.route}:${safeIdentifier}:${windowStart}`;
        const existing = await ctx.db
            .query("graceRateLimits")
            .withIndex("by_key", (q) => q.eq("key", key))
            .unique();

        if (!existing) {
            await ctx.db.insert("graceRateLimits", {
                key,
                route: args.route,
                identifier: safeIdentifier,
                windowStart,
                count: 1,
                updatedAt: now,
            });
            return {
                allowed: true,
                remaining: Math.max(0, args.limit - 1),
                resetAt: windowStart + args.windowMs,
            };
        }

        if (existing.count >= args.limit) {
            return {
                allowed: false,
                remaining: 0,
                resetAt: windowStart + args.windowMs,
            };
        }

        await ctx.db.patch(existing._id, {
            count: existing.count + 1,
            updatedAt: now,
        });
        return {
            allowed: true,
            remaining: Math.max(0, args.limit - existing.count - 1),
            resetAt: windowStart + args.windowMs,
        };
    },
});
