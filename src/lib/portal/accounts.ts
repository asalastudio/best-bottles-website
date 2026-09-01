import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import { api } from "../../../convex/_generated/api";
import { getPortalConvex, getPortalConvexWriteToken } from "./convexClient";
import { requireStaffViewer } from "./staff";

/**
 * Wholesale account provisioning.
 *
 * A portal account is the join between a Clerk organization and everything Best
 * Bottles knows about a wholesale customer, so it cannot be created until the
 * Clerk org exists. Rather than asking staff to paste an `org_…` id, the form
 * offers the real organizations and marks the ones already claimed.
 */

export interface ClerkOrgOption {
    id: string;
    name: string;
    /** True when a portal account already points at this organization. */
    linked: boolean;
}

export async function listPortalAccountsForStaff() {
    await requireStaffViewer();
    return await getPortalConvex().query(api.portal.listPortalAccounts, {});
}

/**
 * Clerk organizations, annotated with whether they already have an account.
 *
 * Clerk is the source of truth for which organizations exist; Convex is the
 * source of truth for which are onboarded. Neither alone can answer "who can I
 * still set up", so this joins them.
 */
export async function listClerkOrganizationsForStaff(): Promise<ClerkOrgOption[]> {
    await requireStaffViewer();

    const [accounts, client] = await Promise.all([
        getPortalConvex().query(api.portal.listPortalAccounts, {}),
        clerkClient(),
    ]);

    const claimed = new Set(accounts.map((account) => account.clerkOrgId));
    const { data } = await client.organizations.getOrganizationList({ limit: 100 });

    return data
        .map((org) => ({ id: org.id, name: org.name, linked: claimed.has(org.id) }))
        .sort((a, b) => Number(a.linked) - Number(b.linked) || a.name.localeCompare(b.name));
}

export interface UpsertAccountInput {
    clerkOrgId: string;
    accountNumber: string;
    companyName: string;
    tier: string;
    accountManager: string;
    netTerms: string;
    memberSince: string;
    billingEmail?: string;
}

export async function upsertPortalAccountAsStaff(input: UpsertAccountInput) {
    await requireStaffViewer();

    return await getPortalConvex().mutation(api.portal.upsertPortalAccount, {
        writeToken: getPortalConvexWriteToken(),
        clerkOrgId: input.clerkOrgId,
        accountNumber: input.accountNumber,
        companyName: input.companyName,
        tier: input.tier,
        accountManager: input.accountManager,
        netTerms: input.netTerms,
        memberSince: input.memberSince,
        billingEmail: input.billingEmail,
        // taxExempt is deliberately not settable here — it belongs to the
        // certificate flow, so provisioning can never hand out an exemption.
    });
}
