import "server-only";

import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { CLERK_ENABLED } from "@/lib/clerk";

let convexClient: ConvexHttpClient | null = null;

const DISABLED_VIEWER = {
    clerkUserId: null,
    clerkOrgId: null,
};

function getConvex() {
    if (!convexClient) {
        const url = process.env.NEXT_PUBLIC_CONVEX_URL;
        if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
        convexClient = new ConvexHttpClient(url);
    }
    return convexClient;
}

function getConvexWriteToken() {
    const token = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
    if (!token) throw new Error("BEST_BOTTLES_CONVEX_WRITE_TOKEN is not set");
    return token;
}

export async function getPortalViewer() {
    if (!CLERK_ENABLED) {
        return DISABLED_VIEWER;
    }

    const { userId, orgId } = await auth();
    return {
        clerkUserId: userId ?? null,
        clerkOrgId: orgId ?? null,
    };
}

export async function requirePortalViewer() {
    if (!CLERK_ENABLED) {
        throw new Error("Portal auth is disabled.");
    }

    const viewer = await getPortalViewer();
    if (!viewer.clerkUserId) throw new Error("Unauthenticated");
    if (!viewer.clerkOrgId) throw new Error("No active organization selected.");
    return {
        clerkUserId: viewer.clerkUserId,
        clerkOrgId: viewer.clerkOrgId,
    };
}

export async function getPortalShellData() {
    const viewer = await getPortalViewer();
    if (!viewer.clerkOrgId) {
        return {
            viewer,
            account: null,
            inTransitCount: 0,
            draftCount: 0,
        };
    }

    const shell = await getConvex().query(api.portal.getShellData, {
        clerkOrgId: viewer.clerkOrgId,
    });

    return {
        viewer,
        ...shell,
    };
}

export async function getPortalDashboardData() {
    if (!CLERK_ENABLED) {
        return {
            viewer: DISABLED_VIEWER,
            account: null,
            stats: {
                ytdSpend: 0,
                activeOrderCount: 0,
                inTransitCount: 0,
                unitsInFlight: 0,
                availableCredit: 0,
            },
            activeOrders: [],
            recentOrders: [],
            drafts: [],
            quickReorder: [],
            exemption: null,
        };
    }

    const viewer = await requirePortalViewer();
    const dashboard = await getConvex().query(api.portal.getDashboardData, {
        clerkOrgId: viewer.clerkOrgId,
    });
    // derived, not the seeded boolean — see getPortalAccountData
    const exemption = await getConvex().query(
        api.resaleCertificates.getExemptionStatus,
        { clerkOrgId: viewer.clerkOrgId },
    );
    return { viewer, ...dashboard, exemption };
}

export async function getPortalOrdersData() {
    if (!CLERK_ENABLED) {
        return { viewer: DISABLED_VIEWER, orders: [] };
    }

    const viewer = await requirePortalViewer();
    const orders = await getConvex().query(api.portal.listOrdersByOrg, {
        clerkOrgId: viewer.clerkOrgId,
    });
    return { viewer, orders };
}

export async function getPortalAccountData() {
    if (!CLERK_ENABLED) {
        return { viewer: DISABLED_VIEWER, account: null, orders: [] };
    }

    const viewer = await requirePortalViewer();
    const account = await getConvex().query(api.portal.getAccountByOrg, {
        clerkOrgId: viewer.clerkOrgId,
    });
    const orders = await getConvex().query(api.portal.listOrdersByOrg, {
        clerkOrgId: viewer.clerkOrgId,
    });
    // Exemption is DERIVED from the certificates on file, never read off
    // portalAccounts.taxExempt. That boolean was seeded from QuickBooks and
    // cannot expire; a resale certificate can, and the day one lapses a
    // stored flag would keep asserting an exemption the business is no
    // longer entitled to claim.
    const exemption = await getConvex().query(
        api.resaleCertificates.getExemptionStatus,
        { clerkOrgId: viewer.clerkOrgId },
    );
    return { viewer, account, orders, exemption };
}

export async function getPortalDraftsData() {
    if (!CLERK_ENABLED) {
        return { viewer: DISABLED_VIEWER, drafts: [] };
    }

    const viewer = await requirePortalViewer();
    const drafts = await getConvex().query(api.portal.listDraftsByOrg, {
        clerkOrgId: viewer.clerkOrgId,
    });
    return { viewer, drafts };
}

export async function getPortalGraceWorkspace(projectId?: string) {
    if (!CLERK_ENABLED) {
        return {
            viewer: DISABLED_VIEWER,
            projects: [],
            activeProject: null,
            messages: [],
        };
    }

    const viewer = await requirePortalViewer();
    const workspace = await getConvex().query(api.portal.getGraceWorkspaceByOrg, {
        clerkOrgId: viewer.clerkOrgId,
        projectId: (projectId ?? undefined) as never,
    });
    return { viewer, ...workspace };
}

export async function createPortalDraftForViewer(name?: string) {
    const viewer = await requirePortalViewer();
    return await getConvex().mutation(api.portal.createDraft, {
        writeToken: getConvexWriteToken(),
        clerkOrgId: viewer.clerkOrgId,
        name,
    });
}

export async function createPortalDraftFromOrderForViewer(orderId: string) {
    const viewer = await requirePortalViewer();
    return await getConvex().mutation(api.portal.createDraftFromOrder, {
        writeToken: getConvexWriteToken(),
        clerkOrgId: viewer.clerkOrgId,
        orderId,
    });
}

export async function createGraceProjectForViewer(name?: string) {
    const viewer = await requirePortalViewer();
    return await getConvex().mutation(api.portal.createGraceProject, {
        writeToken: getConvexWriteToken(),
        clerkOrgId: viewer.clerkOrgId,
        name,
    });
}

export async function askGraceForViewerProject(projectId: string, message: string) {
    const viewer = await requirePortalViewer();

    const workspace = await getConvex().query(api.portal.getGraceWorkspaceByOrg, {
        clerkOrgId: viewer.clerkOrgId,
        projectId: projectId as never,
    });

    if (!workspace.activeProject) {
        throw new Error("Grace project not found.");
    }

    const history = [
        ...workspace.messages.map((entry) => ({
            role: entry.role,
            content: entry.content,
        })),
        {
            role: "user" as const,
            content: message,
        },
    ];

    const assistantMessage = await getConvex().action(api.grace.askGrace, {
        messages: history,
        voiceMode: false,
    });

    await getConvex().mutation(api.portal.saveGraceChatTurn, {
        writeToken: getConvexWriteToken(),
        clerkOrgId: viewer.clerkOrgId,
        clerkUserId: viewer.clerkUserId,
        projectId: projectId as never,
        userMessage: message,
        assistantMessage,
    });

    return { assistantMessage };
}
