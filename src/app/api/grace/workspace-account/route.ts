import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { CLERK_ENABLED } from "@/lib/clerk";
import { getPortalConvex, getPortalConvexWriteToken } from "@/lib/portal/convexClient";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

/** The browser never chooses an organization or receives the server credential. */
export async function GET() {
    if (!CLERK_ENABLED) return NextResponse.json(null, { headers });
    const { userId, orgId } = await auth();
    if (!userId || !orgId) return NextResponse.json(null, { headers });

    try {
        const scope = { clerkOrgId: orgId, writeToken: getPortalConvexWriteToken() };
        const convex = getPortalConvex();
        const [account, projects] = await Promise.all([
            convex.query(api.portal.getAccountByOrg, scope),
            convex.query(api.portal.listGraceProjectsByOrg, scope),
        ]);
        return NextResponse.json({
            userId,
            orgId,
            account: account ? { companyName: account.companyName, tier: account.tier } : null,
            projects: projects.map(({ name, updatedAt, savedBottleCount }) => ({ name, updatedAt, savedBottleCount })),
        }, { headers });
    } catch {
        // Do not expose backend error details or query arguments (including credentials).
        return NextResponse.json({ error: "Account details are unavailable." }, { status: 503, headers });
    }
}
