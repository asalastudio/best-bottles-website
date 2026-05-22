import { internalQuery, mutation } from "./_generated/server";
import { v } from "convex/values";

export const submit = mutation({
    args: {
        formType: v.union(
            v.literal("sample"),
            v.literal("quote"),
            v.literal("contact"),
            v.literal("newsletter")
        ),
        name: v.optional(v.string()),
        email: v.string(),
        company: v.optional(v.string()),
        phone: v.optional(v.string()),
        message: v.optional(v.string()),
        products: v.optional(v.string()),
        quantities: v.optional(v.string()),
        source: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("formSubmissions", {
            ...args,
            submittedAt: Date.now(),
        });
    },
});

// Internal-only: form submissions contain customer contact information and
// should never be readable from the public Convex client.
export const listByType = internalQuery({
    args: { formType: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("formSubmissions")
            .withIndex("by_type", (q) => q.eq("formType", args.formType as "sample" | "quote" | "contact" | "newsletter"))
            .order("desc")
            .take(50);
    },
});
