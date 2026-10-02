import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

type Address = NonNullable<Doc<"portalAccounts">["shippingAddress"]>;
const addressKeys: (keyof Address)[] = ["contactName", "company", "phone", "address1", "address2", "city", "provinceCode", "zip", "countryCode"];
function sameAddress(a: Address | undefined, b: Address | undefined) {
    return a === b || Boolean(a && b && addressKeys.every(key => a[key] === b[key]));
}

/** Local save, optimistic concurrency precondition and retry receipt commit together. */
export async function saveAddressReconciliation(ctx: MutationCtx, account: Doc<"portalAccounts">, input: {
    clerkUserId: string; shippingAddress: Address; billingAddress?: Address;
    expectedVersion: number; requestId: string;
}) {
    if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0 || !/^[A-Za-z0-9_-]{8,100}$/.test(input.requestId)) throw new Error("invalid_address_precondition");
    const payload = JSON.stringify([input.requestId, input.expectedVersion,
        addressKeys.map(key => input.shippingAddress[key]),
        input.billingAddress ? addressKeys.map(key => input.billingAddress![key]) : null]);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
    const fingerprint = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
    const receipt = await ctx.db.query("portalAddressSaveRequests")
        .withIndex("by_org_request", q => q.eq("clerkOrgId", account.clerkOrgId).eq("requestId", input.requestId)).unique();
    const version = account.addressVersion ?? 0;
    if (receipt) {
        if (receipt.requestedBy !== input.clerkUserId || receipt.fingerprint !== fingerprint) throw new Error("address_request_reused");
        if (version !== receipt.resultVersion) throw new Error("address_version_conflict");
        return;
    }
    if (input.expectedVersion !== version) throw new Error("address_version_conflict");
    const shippingChanged = !sameAddress(account.shippingAddress, input.shippingAddress);
    const billingChanged = !sameAddress(account.billingAddress, input.billingAddress);
    const changed = shippingChanged || billingChanged || !account.addressRevision;
    const now = Date.now();
    await ctx.db.insert("portalAddressSaveRequests", {
        clerkOrgId: account.clerkOrgId, requestId: input.requestId, fingerprint,
        requestedBy: input.clerkUserId, requestedAt: now, resultVersion: changed ? version + 1 : version,
    });
    if (!changed) return;
    const revision = shippingChanged || !account.addressRevision ? (account.addressRevision ?? 0) + 1 : account.addressRevision;
    const state = account.shopifyCustomerId ? "awaiting_review" as const : "awaiting_identity" as const;
    if (revision !== account.addressRevision) {
        if (account.addressRevision) {
            const previous = await ctx.db.query("portalAddressReconciliations")
                .withIndex("by_org_revision", q => q.eq("clerkOrgId", account.clerkOrgId).eq("revision", account.addressRevision!)).unique();
            // Keep only revision/audit metadata for superseded, never-sent work.
            if (previous) await ctx.db.patch(previous._id, { state: "superseded", shippingAddress: undefined });
        }
        await ctx.db.insert("portalAddressReconciliations", {
            clerkOrgId: account.clerkOrgId, revision, shippingAddress: input.shippingAddress,
            shopifyCustomerId: account.shopifyCustomerId, state,
            requestedAt: now, requestedBy: input.clerkUserId,
        });
    }
    await ctx.db.patch(account._id, {
        shippingAddress: input.shippingAddress, billingAddress: input.billingAddress,
        addressVersion: version + 1, addressRevision: revision,
        addressSyncStatus: account.addressRevision === revision ? account.addressSyncStatus : state,
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
