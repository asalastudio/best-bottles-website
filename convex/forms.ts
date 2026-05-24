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
        rfqLineItems: v.optional(v.array(v.object({
            sku: v.string(),
            websiteSku: v.optional(v.string()),
            variantId: v.optional(v.string()),
            productGroupSlug: v.optional(v.string()),
            name: v.string(),
            quantity: v.number(),
            unitPrice: v.optional(v.union(v.number(), v.null())),
            notes: v.optional(v.string()),
            family: v.optional(v.string()),
            capacity: v.optional(v.string()),
            color: v.optional(v.string()),
            applicator: v.optional(v.union(v.string(), v.null())),
            capColor: v.optional(v.union(v.string(), v.null())),
            neckThreadSize: v.optional(v.union(v.string(), v.null())),
        }))),
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
