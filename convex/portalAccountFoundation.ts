import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { verifyWriteToken, serverQuery } from "./portalAuth";

/** Called only after the Next server verifies current Clerk membership. */
export const ensurePendingAccount = mutation({
    args: { writeToken: v.string(), clerkOrgId: v.string(), clerkUserId: v.string(), companyName: v.string() },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        if (!args.clerkOrgId.trim() || !args.clerkUserId.trim() || !args.companyName.trim()) throw new Error("invalid_profile_identity");
        const existing = await ctx.db.query("portalAccounts")
            .withIndex("by_clerkOrgId", q => q.eq("clerkOrgId", args.clerkOrgId)).unique();
        if (existing) return { accountId: existing._id, created: false };
        const accountId = await ctx.db.insert("portalAccounts", {
            clerkOrgId: args.clerkOrgId, companyName: args.companyName,
            profileStatus: "pending", profileCreatedAt: Date.now(), profileCreatedBy: args.clerkUserId,
            taxExempt: false,
        });
        return { accountId, created: true };
    },
});

/** Scope is supplied by the authenticated Next server, never by a browser. */
export const getAddressReconciliation = serverQuery({
    args: { clerkOrgId: v.string() },
    handler: async (ctx, args) => {
        const account = await ctx.db.query("portalAccounts")
            .withIndex("by_clerkOrgId", q => q.eq("clerkOrgId", args.clerkOrgId)).unique();
        if (!account?.addressRevision) return null;
        return ctx.db.query("portalAddressReconciliations")
            .withIndex("by_org_revision", q => q.eq("clerkOrgId", args.clerkOrgId).eq("revision", account.addressRevision!)).unique();
    },
});
