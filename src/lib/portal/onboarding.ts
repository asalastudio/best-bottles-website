import "server-only";
import { cache } from "react";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { CLERK_ENABLED } from "@/lib/clerk";
import { api } from "../../../convex/_generated/api";
import { getPortalConvex, getPortalConvexWriteToken } from "./convexClient";

/** No caller-supplied identity, email matching, customer creation or approval. */
export const ensurePortalProfileForViewer = cache(async () => {
    if (!CLERK_ENABLED) return null;
    const { userId, orgId } = await auth();
    if (!userId || !orgId) return null;
    const client = await clerkClient();
    // Fresh membership protects provisioning after a membership is revoked,
    // even while an older session still contains the selected organization.
    for (let offset = 0; ; offset += 100) {
        const page = await client.users.getOrganizationMembershipList({ userId, limit: 100, offset });
        const membership = page.data.find(item => item.organization.id === orgId);
        if (membership) {
            return getPortalConvex().mutation(api.portalAccountFoundation.ensurePendingAccount, {
                writeToken: getPortalConvexWriteToken(), clerkOrgId: orgId,
                clerkUserId: userId, companyName: membership.organization.name,
            });
        }
        if (!page.data.length || offset + page.data.length >= page.totalCount) break;
    }
    throw new Error("active_organization_membership_required");
});
