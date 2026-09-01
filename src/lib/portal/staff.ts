import "server-only";

import { currentUser } from "@clerk/nextjs/server";
import { CLERK_ENABLED } from "@/lib/clerk";
import { getUserEmailAddresses, hasTeamHubAccess } from "@/lib/teamAccess";

/**
 * The authorization gate for every Best Bottles staff surface.
 *
 * Shared rather than repeated: certificate approval and account provisioning
 * both decide who may act on a customer's tax status, and two copies of that
 * check would eventually disagree.
 */
export async function requireStaffViewer() {
    if (!CLERK_ENABLED) throw new Error("Portal auth is disabled.");

    const user = await currentUser();
    const emailAddresses = getUserEmailAddresses(user);

    if (!user || !hasTeamHubAccess(user.publicMetadata, { emailAddresses })) {
        throw new Error("staff_access_required");
    }

    return { clerkUserId: user.id, emailAddresses };
}

/** True when a thrown error is this gate refusing, rather than a real failure. */
export function isStaffAccessError(err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return message.includes("staff_access_required") || message.includes("Portal auth is disabled");
}
