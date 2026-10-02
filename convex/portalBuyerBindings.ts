import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { verifyWriteToken } from "./portalAuth";
import {
    assertFreshBuyerProof, buyerBindingStateV, buyerProofV, buyerScopeFields,
    sameBuyerProof, validateBuyerProof, type BuyerProof, type BuyerScope,
} from "./lib/buyerBinding";

const resultV = v.object({ id: v.id("portalBuyerBindings"), version: v.number(), state: buyerBindingStateV, proof: buyerProofV });
const project = (row: { _id: import("./_generated/dataModel").Id<"portalBuyerBindings">; version: number;
    state: "proposed" | "approved" | "revoked"; proof: BuyerProof }) => ({ id: row._id, version: row.version, state: row.state, proof: row.proof });

async function byScope(ctx: QueryCtx, scope: BuyerScope) {
    return ctx.db.query("portalBuyerBindings").withIndex("by_scope", q => q
        .eq("clerkInstanceHost", scope.clerkInstanceHost).eq("clerkUserId", scope.clerkUserId)
        .eq("clerkOrgId", scope.clerkOrgId).eq("shopDomain", scope.shopDomain)).unique();
}
async function assertNoLegacyConflict(ctx: QueryCtx, proof: BuyerProof) {
    // Read-only safety check. Never create or update portalAccounts here.
    for (const customerId of [proof.customerId, proof.customerId.split("/").at(-1)!]) {
        const account = await ctx.db.query("portalAccounts")
            .withIndex("by_shopifyCustomerId", q => q.eq("shopifyCustomerId", customerId)).unique();
        if (account && account.clerkOrgId !== proof.clerkOrgId) throw new Error("legacy_customer_binding_conflict");
    }
}

/** Trusted Next server only: staff authentication and fresh provider reads happen there.
 * This existing portal credential is never sent to a browser. No endpoint is mounted.
 */
export const propose = mutation({
    args: { writeToken: v.string(), proof: buyerProofV, checkedAt: v.number(), staffUserId: v.string() },
    returns: resultV,
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        validateBuyerProof(args.proof);
        assertFreshBuyerProof(args.checkedAt, Date.now());
        if (!/^user_[A-Za-z0-9]+$/.test(args.staffUserId)) throw new Error("staff_actor_required");
        await assertNoLegacyConflict(ctx, args.proof);
        const existing = await byScope(ctx, args.proof);
        if (existing) {
            if (!sameBuyerProof(existing.proof, args.proof)) throw new Error("buyer_binding_conflict");
            if (existing.state === "revoked") throw new Error("buyer_binding_revoked");
            return project(existing);
        }
        // Conservative single-customer claim across users, orgs AND Clerk instances.
        // A revoked row retains its claim: reassignment requires a separate reviewed migration.
        const owner = await ctx.db.query("portalBuyerBindings").withIndex("by_shop_customer", q => q
            .eq("shopDomain", args.proof.shopDomain).eq("customerId", args.proof.customerId)).unique();
        if (owner) throw new Error("buyer_customer_already_claimed");
        const id = await ctx.db.insert("portalBuyerBindings", {
            clerkInstanceHost: args.proof.clerkInstanceHost, clerkUserId: args.proof.clerkUserId,
            clerkOrgId: args.proof.clerkOrgId, shopDomain: args.proof.shopDomain, customerId: args.proof.customerId,
            proof: args.proof, state: "proposed", version: 1, proposedAt: Date.now(), proposedBy: args.staffUserId,
        });
        return { id, version: 1, state: "proposed" as const, proof: args.proof };
    },
});

export const read = query({
    args: { writeToken: v.string(), ...buyerScopeFields, forPurchase: v.optional(v.boolean()) }, returns: v.union(resultV, v.null()),
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        const row = await byScope(ctx, args);
        if (args.forPurchase && row?.state === "approved") await assertNoLegacyConflict(ctx, row.proof);
        return row ? project(row) : null;
    },
});

export const review = mutation({
    args: { writeToken: v.string(), id: v.id("portalBuyerBindings"), expectedVersion: v.number(),
        proof: buyerProofV, checkedAt: v.number(), staffUserId: v.string() },
    returns: resultV,
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        if (!/^user_[A-Za-z0-9]+$/.test(args.staffUserId)) throw new Error("staff_actor_required");
        validateBuyerProof(args.proof); assertFreshBuyerProof(args.checkedAt, Date.now());
        const row = await ctx.db.get(args.id);
        if (!row || row.version !== args.expectedVersion || row.state !== "proposed") throw new Error("buyer_review_conflict");
        if (!sameBuyerProof(row.proof, args.proof)) throw new Error("buyer_proof_changed");
        await assertNoLegacyConflict(ctx, args.proof);
        await ctx.db.patch(row._id, { state: "approved", version: row.version + 1, reviewedBy: args.staffUserId, reviewedAt: Date.now() });
        return { ...project(row), state: "approved" as const, version: row.version + 1 };
    },
});

export const revoke = mutation({
    args: { writeToken: v.string(), id: v.id("portalBuyerBindings"), expectedVersion: v.number(), staffUserId: v.string() },
    returns: resultV,
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        if (!/^user_[A-Za-z0-9]+$/.test(args.staffUserId)) throw new Error("staff_actor_required");
        const row = await ctx.db.get(args.id);
        if (!row || row.version !== args.expectedVersion || row.state === "revoked") throw new Error("buyer_review_conflict");
        await ctx.db.patch(row._id, { state: "revoked", version: row.version + 1, revokedBy: args.staffUserId, revokedAt: Date.now() });
        return { ...project(row), state: "revoked" as const, version: row.version + 1 };
    },
});
