import "server-only";
import { clerkClient } from "@clerk/nextjs/server";

/** Call with server-authenticated scope. Recheck on every mutation; never cache. */
export async function verifyPortalOrganizationMembership(viewer: { clerkUserId: string; clerkOrgId: string }) {
    const client = await clerkClient();
    for (let offset = 0; ; offset += 100) {
        const page = await client.users.getOrganizationMembershipList({ userId: viewer.clerkUserId, limit: 100, offset });
        const membership = page.data.find(item => item.organization.id === viewer.clerkOrgId);
        if (membership) return membership.organization;
        if (!page.data.length || offset + page.data.length >= page.totalCount) break;
    }
    throw new Error("active_organization_membership_required");
}
