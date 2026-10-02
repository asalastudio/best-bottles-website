import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

type Address = NonNullable<Doc<"portalAccounts">["shippingAddress"]>;
const addressKeys: (keyof Address)[] = ["contactName", "company", "phone", "address1", "address2", "city", "provinceCode", "zip", "countryCode"];
function sameAddress(a: Address | undefined, b: Address | undefined) {
    return a === b || Boolean(a && b && addressKeys.every(key => a[key] === b[key]));
}

/** Local save and reconciliation intent commit together. No Shopify writes here. */
export async function saveAddressReconciliation(ctx: MutationCtx, account: Doc<"portalAccounts">, input: {
    clerkUserId: string; shippingAddress: Address; billingAddress?: Address;
}) {
    const shippingChanged = !sameAddress(account.shippingAddress, input.shippingAddress);
    const billingChanged = !sameAddress(account.billingAddress, input.billingAddress);
    // Retry the same save without generating another revision. Legacy addresses
    // get one intent on the first save even when their contents are unchanged.
    if (!shippingChanged && !billingChanged && account.addressRevision) return;
    const now = Date.now();
    const revision = shippingChanged || !account.addressRevision ? (account.addressRevision ?? 0) + 1 : account.addressRevision;
    const state = account.shopifyCustomerId ? "awaiting_review" as const : "awaiting_identity" as const;
    if (revision !== account.addressRevision) {
        if (account.addressRevision) {
            const previous = await ctx.db.query("portalAddressReconciliations")
                .withIndex("by_org_revision", q => q.eq("clerkOrgId", account.clerkOrgId).eq("revision", account.addressRevision!)).unique();
            if (previous) await ctx.db.patch(previous._id, { state: "superseded" });
        }
        await ctx.db.insert("portalAddressReconciliations", {
            clerkOrgId: account.clerkOrgId, revision, shippingAddress: input.shippingAddress,
            shopifyCustomerId: account.shopifyCustomerId, state,
            requestedAt: now, requestedBy: input.clerkUserId,
        });
    }
    await ctx.db.patch(account._id, {
        shippingAddress: input.shippingAddress, billingAddress: input.billingAddress,
        addressRevision: revision, addressSyncStatus: account.addressRevision === revision ? account.addressSyncStatus : state,
        addressUpdatedAt: now, addressUpdatedBy: input.clerkUserId,
    });
}

/** Advance only an unsent current intent after an explicit customer link. */
export async function reconcileAddressIdentity(ctx: MutationCtx, account: Doc<"portalAccounts">, shopifyCustomerId: string) {
    if (!account.addressRevision) return;
    const intent = await ctx.db.query("portalAddressReconciliations")
        .withIndex("by_org_revision", q => q.eq("clerkOrgId", account.clerkOrgId).eq("revision", account.addressRevision!)).unique();
    if (!intent || intent.state !== "awaiting_identity") return;
    await ctx.db.patch(intent._id, { shopifyCustomerId, state: "awaiting_review" });
    await ctx.db.patch(account._id, { addressSyncStatus: "awaiting_review" });
}
