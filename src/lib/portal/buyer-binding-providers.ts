import "server-only";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { api } from "../../../convex/_generated/api";
import type { BuyerScope } from "../../../convex/lib/buyerBinding";
import { getPortalConvex, getPortalConvexWriteToken } from "./convexClient";
import { requireStaffViewer } from "./staff";
import { createBuyerBindingService, type BindingConfig, type BindingTarget, type BuyerSessionProof,
    type ClerkBuyerEvidence, type ShopifyBuyerEvidence } from "./buyer-binding";

export const BUYER_OWNERSHIP_QUERY = `query BuyerOwnership($customerId: ID!) {
  shop { myshopifyDomain }
  customer(id: $customerId) {
    id defaultEmailAddress { emailAddress } verifiedEmail
    companyContactProfiles {
      id company { id } customer { id }
      roleAssignments(first: 100) {
        nodes { id role { id name } companyLocation { id company { id } } }
        pageInfo { hasNextPage }
      }
    }
  }
}`;
const idV = z.object({ id: z.string() });
const ownershipV = z.object({
    shop: z.object({ myshopifyDomain: z.string() }),
    customer: z.object({ id: z.string(), verifiedEmail: z.literal(true),
        defaultEmailAddress: z.object({ emailAddress: z.string().email() }),
        companyContactProfiles: z.array(z.object({ id: z.string(), company: idV, customer: idV,
            roleAssignments: z.object({
                nodes: z.array(z.object({ id: z.string(), role: z.object({ id: z.string(), name: z.string() }),
                    companyLocation: z.object({ id: z.string(), company: idV }) })),
                pageInfo: z.object({ hasNextPage: z.literal(false) }),
            }),
        })),
    }),
});
export function normalizeBuyerOwnership(raw: unknown, target: BindingTarget, shopDomain: string): ShopifyBuyerEvidence {
    const data = ownershipV.parse(raw);
    if (data.shop.myshopifyDomain !== shopDomain || data.customer.id !== target.customerId) throw new Error("buyer_shop_mismatch");
    const contacts = data.customer.companyContactProfiles.filter(contact => contact.id === target.companyContactId);
    if (contacts.length !== 1) throw new Error("buyer_contact_unverified");
    const contact = contacts[0];
    if (contact.customer.id !== target.customerId || contact.company.id !== target.companyId) throw new Error("buyer_contact_unverified");
    const assignments = contact.roleAssignments.nodes.filter(role => role.companyLocation.id === target.companyLocationId);
    if (assignments.length !== 1 || assignments[0].companyLocation.company.id !== target.companyId
        || assignments[0].role.name !== "Ordering only") throw new Error("buyer_location_role_unverified");
    return { ...target, shopDomain, verifiedEmail: data.customer.defaultEmailAddress.emailAddress,
        roleAssignmentId: assignments[0].id, roleId: assignments[0].role.id, roleName: "Ordering only" };
}

function assertInstance(config: BindingConfig) {
    const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
    // Production-only cutover: no dev identity enrollment or migration bypass.
    if (!key.startsWith("pk_live_") || !process.env.CLERK_SECRET_KEY?.startsWith("sk_live_")
        || Buffer.from(key.slice(8), "base64").toString().replace(/\$$/, "") !== config.clerkInstanceHost
        || process.env.NEXT_PUBLIC_CLERK_ENABLED !== "true"
        || process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN !== config.shopDomain) throw new Error("buyer_environment_unverified");
}

export async function readClerkBuyerEvidence(scope: BuyerScope): Promise<ClerkBuyerEvidence> {
    const client = await clerkClient();
    const user = await client.users.getUser(scope.clerkUserId);
    const email = user.emailAddresses.find(item => item.id === user.primaryEmailAddressId);
    if (user.id !== scope.clerkUserId || user.banned || user.locked || !email || email.verification?.status !== "verified") {
        throw new Error("buyer_clerk_identity_unverified");
    }
    // Bounded exhaustive membership search; an incomplete result never grants access.
    for (let offset = 0; offset < 10_000; offset += 100) {
        const page = await client.users.getOrganizationMembershipList({ userId: scope.clerkUserId, limit: 100, offset });
        const memberships = page.data.filter(item => item.organization.id === scope.clerkOrgId);
        if (memberships.length > 1) throw new Error("buyer_membership_ambiguous");
        if (memberships.length === 1) return { clerkUserId: user.id, clerkOrgId: scope.clerkOrgId,
            clerkMembershipId: memberships[0].id, clerkEmailId: email.id, verifiedEmail: email.emailAddress };
        if (!page.data.length || offset + page.data.length >= page.totalCount) break;
    }
    throw new Error("buyer_membership_required");
}

/** Separate pinned read client: do not change the legacy Admin transport's version. */
export async function readShopifyBuyerEvidence(target: BindingTarget, shopDomain: string): Promise<ShopifyBuyerEvidence> {
    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shopDomain)) throw new Error("buyer_shop_unverified");
    const token = process.env.SHOPIFY_ADMIN_TOKEN;
    if (!token) throw new Error("buyer_provider_unavailable");
    const result = await fetch(`https://${shopDomain}/admin/api/2026-04/graphql.json`, {
        method: "POST", cache: "no-store", signal: AbortSignal.timeout(10_000),
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
        body: JSON.stringify({ query: BUYER_OWNERSHIP_QUERY, variables: { customerId: target.customerId } }),
    });
    if (!result.ok) throw new Error("buyer_provider_unavailable");
    const json = await result.json();
    if (json.errors?.length) throw new Error("buyer_provider_unavailable");
    return normalizeBuyerOwnership(json.data, target, shopDomain);
}

/** No route imports this. A reviewed auth owner must supply the Customer Account
 * session reader; there is deliberately no default/fallback token implementation.
 */
export function createServerBuyerBindings(config: BindingConfig,
    readBuyerSession: (scope: BuyerScope, locationId: string) => Promise<BuyerSessionProof | null>) {
    const pinned = structuredClone(config);
    const credential = () => { assertInstance(pinned); return getPortalConvexWriteToken(); };
    return createBuyerBindingService({ config: pinned,
        requireStaff: async () => { assertInstance(pinned); return requireStaffViewer(); },
        readViewer: async () => {
            assertInstance(pinned);
            const { userId, orgId } = await auth();
            return userId && orgId ? { clerkUserId: userId, clerkOrgId: orgId,
                clerkInstanceHost: pinned.clerkInstanceHost, shopDomain: pinned.shopDomain } : null;
        },
        readClerkEvidence: async scope => { assertInstance(pinned); return readClerkBuyerEvidence(scope); },
        readShopifyEvidence: target => readShopifyBuyerEvidence(target, pinned.shopDomain),
        readBuyerSession,
        store: {
            read: (scope, forPurchase = false) => getPortalConvex().query(api.portalBuyerBindings.read, { ...scope, forPurchase, writeToken: credential() }),
            propose: args => getPortalConvex().mutation(api.portalBuyerBindings.propose, { ...args, writeToken: credential() }),
            review: args => getPortalConvex().mutation(api.portalBuyerBindings.review, { ...args, writeToken: credential() }),
            revoke: args => getPortalConvex().mutation(api.portalBuyerBindings.revoke, { ...args, writeToken: credential() }),
        },
    });
}
