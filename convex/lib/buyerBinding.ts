import { v } from "convex/values";

/** A purchase-only association. Never an org-wide billing/order-data link. */
export const buyerScopeFields = {
    clerkInstanceHost: v.string(), clerkUserId: v.string(), clerkOrgId: v.string(), shopDomain: v.string(),
};
export const buyerProofFields = {
    ...buyerScopeFields,
    clerkMembershipId: v.string(), clerkEmailId: v.string(),
    customerId: v.string(), companyId: v.string(), companyContactId: v.string(), companyLocationId: v.string(),
    roleAssignmentId: v.string(), roleId: v.string(), roleName: v.literal("Ordering only"),
};
export const buyerProofV = v.object(buyerProofFields);
export const buyerBindingStateV = v.union(v.literal("proposed"), v.literal("approved"), v.literal("revoked"));

export type BuyerScope = {
    clerkInstanceHost: string; clerkUserId: string; clerkOrgId: string; shopDomain: string;
};
export type BuyerProof = BuyerScope & {
    clerkMembershipId: string; clerkEmailId: string;
    customerId: string; companyId: string; companyContactId: string; companyLocationId: string;
    roleAssignmentId: string; roleId: string; roleName: "Ordering only";
};
export const scopeKeys = ["clerkInstanceHost", "clerkUserId", "clerkOrgId", "shopDomain"] as const;
const proofKeys = [...scopeKeys, "clerkMembershipId", "clerkEmailId", "customerId", "companyId",
    "companyContactId", "companyLocationId", "roleAssignmentId", "roleId", "roleName"] as const;
export function sameBuyerProof(a: BuyerProof, b: BuyerProof) {
    return proofKeys.every(key => a[key] === b[key]);
}
export function sameBuyerScope(a: BuyerScope, b: BuyerScope) {
    return scopeKeys.every(key => a[key] === b[key]);
}
export function validateBuyerProof(proof: BuyerProof) {
    if (!/^[a-z0-9][a-z0-9.-]+$/.test(proof.clerkInstanceHost)
        || proof.clerkInstanceHost.endsWith(".clerk.accounts.dev")
        || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(proof.shopDomain)
        || !/^user_[A-Za-z0-9]+$/.test(proof.clerkUserId) || !/^org_[A-Za-z0-9]+$/.test(proof.clerkOrgId)
        || !/^orgmem_[A-Za-z0-9]+$/.test(proof.clerkMembershipId) || !/^idn_[A-Za-z0-9]+$/.test(proof.clerkEmailId)
        || proof.roleName !== "Ordering only") throw new Error("invalid_buyer_proof");
    for (const [key, type] of [["customerId", "Customer"], ["companyId", "Company"],
        ["companyContactId", "CompanyContact"], ["companyLocationId", "CompanyLocation"],
        ["roleAssignmentId", "CompanyContactRoleAssignment"], ["roleId", "CompanyContactRole"]] as const) {
        if (!new RegExp(`^gid://shopify/${type}/[1-9][0-9]*$`).test(proof[key])) throw new Error("invalid_buyer_proof");
    }
}
export function assertFreshBuyerProof(checkedAt: number, now: number) {
    if (!Number.isSafeInteger(checkedAt) || checkedAt > now || now - checkedAt > 30_000) {
        throw new Error("buyer_proof_expired");
    }
}
