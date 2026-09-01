import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { api } from "../../../convex/_generated/api";
import { getPortalConvex, getPortalConvexWriteToken } from "./convexClient";
import { CLERK_ENABLED } from "@/lib/clerk";
import { getUserEmailAddresses } from "@/lib/teamAccess";
import {
    ensureShopifyCustomer,
    normalizeCustomerEmail,
    ShopifyCustomerScopeError,
} from "@/lib/shopify-customers";

const DISABLED_VIEWER = {
    clerkUserId: null,
    clerkOrgId: null,
};

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

    const shell = await getPortalConvex().query(api.portal.getShellData, {
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
        };
    }

    const viewer = await requirePortalViewer();
    const dashboard = await getPortalConvex().query(api.portal.getDashboardData, {
        clerkOrgId: viewer.clerkOrgId,
    });
    return { viewer, ...dashboard };
}

export async function getPortalOrdersData() {
    if (!CLERK_ENABLED) {
        return { viewer: DISABLED_VIEWER, orders: [] };
    }

    const viewer = await requirePortalViewer();
    const orders = await getPortalConvex().query(api.portal.listOrdersByOrg, {
        clerkOrgId: viewer.clerkOrgId,
    });
    return { viewer, orders };
}

export async function getPortalAccountData() {
    if (!CLERK_ENABLED) {
        return { viewer: DISABLED_VIEWER, account: null, orders: [] };
    }

    const viewer = await requirePortalViewer();
    const account = await getPortalConvex().query(api.portal.getAccountByOrg, {
        clerkOrgId: viewer.clerkOrgId,
    });
    const orders = await getPortalConvex().query(api.portal.listOrdersByOrg, {
        clerkOrgId: viewer.clerkOrgId,
    });
    return { viewer, account, orders };
}

export async function getPortalDraftsData() {
    if (!CLERK_ENABLED) {
        return { viewer: DISABLED_VIEWER, drafts: [] };
    }

    const viewer = await requirePortalViewer();
    const drafts = await getPortalConvex().query(api.portal.listDraftsByOrg, {
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
    const workspace = await getPortalConvex().query(api.portal.getGraceWorkspaceByOrg, {
        clerkOrgId: viewer.clerkOrgId,
        projectId: (projectId ?? undefined) as never,
    });
    return { viewer, ...workspace };
}

export async function createPortalDraftForViewer(name?: string) {
    const viewer = await requirePortalViewer();
    return await getPortalConvex().mutation(api.portal.createDraft, {
        writeToken: getPortalConvexWriteToken(),
        clerkOrgId: viewer.clerkOrgId,
        name,
    });
}

export async function createPortalDraftFromOrderForViewer(orderId: string) {
    const viewer = await requirePortalViewer();
    return await getPortalConvex().mutation(api.portal.createDraftFromOrder, {
        writeToken: getPortalConvexWriteToken(),
        clerkOrgId: viewer.clerkOrgId,
        orderId,
    });
}

export async function createGraceProjectForViewer(name?: string) {
    const viewer = await requirePortalViewer();
    return await getPortalConvex().mutation(api.portal.createGraceProject, {
        writeToken: getPortalConvexWriteToken(),
        clerkOrgId: viewer.clerkOrgId,
        name,
    });
}

export async function saveProductToGraceProjectForViewer(args: {
    projectId?: string;
    projectName?: string;
    bottle: { description: string; sku?: string; notes?: string };
}) {
    const viewer = await requirePortalViewer();
    let projectId = args.projectId;
    if (!projectId) {
        const created = await getPortalConvex().mutation(api.portal.createGraceProject, {
            writeToken: getPortalConvexWriteToken(),
            clerkOrgId: viewer.clerkOrgId,
            name: args.projectName,
        });
        projectId = String(created.projectId);
    }

    const result = await getPortalConvex().mutation(api.portal.saveBottleToGraceProject, {
        writeToken: getPortalConvexWriteToken(),
        clerkOrgId: viewer.clerkOrgId,
        projectId: projectId as never,
        bottle: args.bottle,
    });
    return { ...result, projectId };
}

export async function askGraceForViewerProject(projectId: string, message: string) {
    const viewer = await requirePortalViewer();

    const workspace = await getPortalConvex().query(api.portal.getGraceWorkspaceByOrg, {
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

    const assistantMessage = await getPortalConvex().action(api.grace.askGrace, {
        messages: history,
        voiceMode: false,
    });

    await getPortalConvex().mutation(api.portal.saveGraceChatTurn, {
        writeToken: getPortalConvexWriteToken(),
        clerkOrgId: viewer.clerkOrgId,
        clerkUserId: viewer.clerkUserId,
        projectId: projectId as never,
        userMessage: message,
        assistantMessage,
    });

    return { assistantMessage };
}

// ─── Identity bridge (Clerk org ↔ Shopify customer) ─────────────────────────

export type PortalIdentity =
    | {
          status: "linked";
          shopifyCustomerId: string;
          billingEmail: string;
          /** True when this call created the Shopify customer rather than adopting one. */
          created: boolean;
      }
    | {
          status: "unavailable";
          reason:
              | "clerk_disabled"
              | "no_organization"
              | "no_portal_account"
              | "no_billing_email"
              | "shopify_scope_missing";
          detail?: string;
      };

/**
 * Resolve — creating if necessary — the Shopify customer that carries this
 * account's tax exemption, and persist the link.
 *
 * Safe to call on every request: once `shopifyCustomerId` is stored, this
 * short-circuits without touching Shopify.
 *
 * Returns a structured `unavailable` rather than throwing, because checkout must
 * still work for a signed-out shopper or an org with no portal account — they
 * simply pay tax.
 */
/**
 * Resolve — creating if necessary — the Shopify customer that carries an
 * account's tax exemption, and persist the link.
 *
 * Org-scoped and deliberately Clerk-free, because staff approve certificates for
 * accounts they are not a member of. `fallbackEmail` is only ever supplied by a
 * caller that knows it belongs to THIS account: seeding a wholesale customer with
 * a reviewing employee's address would attach the exemption to the wrong person.
 */
export async function ensureShopifyCustomerForOrg(
    clerkOrgId: string,
    opts: { fallbackEmail?: string | null; clerkUserId?: string | null } = {},
): Promise<PortalIdentity> {
    const account = await getPortalConvex().query(api.portal.getAccountByOrg, {
        clerkOrgId,
    });
    if (!account) return { status: "unavailable", reason: "no_portal_account" };

    if (account.shopifyCustomerId) {
        return {
            status: "linked",
            shopifyCustomerId: account.shopifyCustomerId,
            billingEmail: account.billingEmail ?? "",
            created: false,
        };
    }

    const billingEmail =
        normalizeCustomerEmail(account.billingEmail) ??
        normalizeCustomerEmail(opts.fallbackEmail);

    if (!billingEmail) return { status: "unavailable", reason: "no_billing_email" };

    try {
        const { customer, created } = await ensureShopifyCustomer({
            email: billingEmail,
            companyName: account.companyName,
            accountNumber: account.accountNumber,
        });

        await getPortalConvex().mutation(api.portal.linkShopifyCustomer, {
            writeToken: getPortalConvexWriteToken(),
            clerkOrgId,
            shopifyCustomerId: customer.customerId,
            billingEmail: customer.email || billingEmail,
            clerkUserId: opts.clerkUserId ?? undefined,
        });

        return {
            status: "linked",
            shopifyCustomerId: customer.customerId,
            billingEmail: customer.email || billingEmail,
            created,
        };
    } catch (err) {
        if (err instanceof ShopifyCustomerScopeError) {
            return {
                status: "unavailable",
                reason: "shopify_scope_missing",
                detail: err.message,
            };
        }
        throw err;
    }
}

/**
 * The signed-in member's own account. Safe to call on every request: once
 * `shopifyCustomerId` is stored this short-circuits without touching Shopify.
 *
 * Returns a structured `unavailable` rather than throwing, because checkout must
 * still work for a signed-out shopper — they simply pay tax.
 */
export async function ensurePortalShopifyCustomer(): Promise<PortalIdentity> {
    if (!CLERK_ENABLED) return { status: "unavailable", reason: "clerk_disabled" };

    const viewer = await getPortalViewer();
    if (!viewer.clerkOrgId) return { status: "unavailable", reason: "no_organization" };

    // Only here is a Clerk address an acceptable seed: it is the viewer's own
    // account. Unverified addresses are excluded by getUserEmailAddresses.
    const fallbackEmail = getUserEmailAddresses(await currentUser())[0] ?? null;

    return await ensureShopifyCustomerForOrg(viewer.clerkOrgId, {
        fallbackEmail,
        clerkUserId: viewer.clerkUserId,
    });
}
