import "server-only";
import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { CLERK_ENABLED } from "@/lib/clerk";
import { api } from "../../../convex/_generated/api";
import { getPortalConvex, getPortalConvexWriteToken } from "./convexClient";
import { verifyPortalOrganizationMembership } from "./membership";

/** No caller-supplied identity, email matching, customer creation or approval. */
export const ensurePortalProfileForViewer = cache(async () => {
    if (!CLERK_ENABLED) return null;
    const { userId, orgId } = await auth();
    if (!userId || !orgId) return null;
    const organization = await verifyPortalOrganizationMembership({ clerkUserId: userId, clerkOrgId: orgId });
    return getPortalConvex().mutation(api.portalAccountFoundation.ensurePendingAccount, {
        writeToken: getPortalConvexWriteToken(), clerkOrgId: orgId,
        clerkUserId: userId, companyName: organization.name,
    });
});
