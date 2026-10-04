import "server-only";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { hasTeamHubAccess } from "@/lib/teamAccess";

const staffV = z.object({
    id: z.string(), banned: z.boolean(), locked: z.boolean(),
    public_metadata: z.record(z.string(), z.unknown()),
    email_addresses: z.array(z.object({
        email_address: z.string(), verification: z.object({ status: z.string() }).nullable(),
    })),
});

/** Binding-only staff gate. currentUser()/SDK GETs may be request-deduplicated.
 * A new signal opts out of Next request memoization; no-store disables its data
 * cache. Always read current privilege from Clerk, using only auth-derived ID.
 */
export async function requireFreshBindingStaff() {
    const { userId } = await auth();
    const secret = process.env.CLERK_SECRET_KEY;
    if (process.env.NEXT_PUBLIC_CLERK_ENABLED !== "true" || !secret?.startsWith("sk_live_")
        || !userId || !/^user_[A-Za-z0-9]+$/.test(userId)) throw new Error("staff_access_required");
    try {
        const response = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(userId)}`, {
            method: "GET", cache: "no-store", signal: AbortSignal.timeout(10_000),
            headers: { Authorization: `Bearer ${secret}` },
        });
        if (!response.ok) throw new Error("staff_access_required");
        const user = staffV.parse(await response.json());
        const emailAddresses = user.email_addresses.filter(email => email.verification?.status === "verified")
            .map(email => email.email_address);
        if (user.id !== userId || user.banned || user.locked || !hasTeamHubAccess(user.public_metadata, { emailAddresses })) {
            throw new Error("staff_access_required");
        }
        return { clerkUserId: userId };
    } catch { throw new Error("staff_access_required"); } // Never expose provider payloads or credentials.
}
