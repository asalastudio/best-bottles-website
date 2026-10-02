import type { BuyerProof } from "../../convex/lib/buyerBinding";

// Shopify identifiers from the verified pilot; Clerk identities and all emails
// are synthetic. Production Clerk IDs require fresh sign-in after cutover.
export const buyerProof: BuyerProof = {
    clerkInstanceHost: "clerk.example.test", clerkUserId: "user_fixtureBuyer", clerkOrgId: "org_fixtureBuyer",
    clerkMembershipId: "orgmem_fixtureBuyer", clerkEmailId: "idn_fixtureBuyer", shopDomain: "bestbottles-1580.myshopify.com",
    customerId: "gid://shopify/Customer/23909292343588", companyId: "gid://shopify/Company/16057663780",
    companyContactId: "gid://shopify/CompanyContact/4808474916", companyLocationId: "gid://shopify/CompanyLocation/19571835172",
    roleAssignmentId: "gid://shopify/CompanyContactRoleAssignment/52296450340",
    roleId: "gid://shopify/CompanyContactRole/23455007012", roleName: "Ordering only",
};
export const buyerScope = { clerkInstanceHost: buyerProof.clerkInstanceHost, clerkUserId: buyerProof.clerkUserId,
    clerkOrgId: buyerProof.clerkOrgId, shopDomain: buyerProof.shopDomain };
export const buyerTarget = { customerId: buyerProof.customerId, companyId: buyerProof.companyId,
    companyContactId: buyerProof.companyContactId, companyLocationId: buyerProof.companyLocationId };
