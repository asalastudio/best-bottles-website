"use server";

import { revalidatePath } from "next/cache";
import { upsertPortalAccountAsStaff } from "@/lib/portal/accounts";
import { isStaffAccessError } from "@/lib/portal/staff";

export type AccountFormState = {
    error: string | null;
    created: string | null;
};

const REQUIRED: Array<[keyof typeof LABELS, string]> = [
    ["clerkOrgId", "clerkOrgId"],
    ["companyName", "companyName"],
    ["accountNumber", "accountNumber"],
    ["tier", "tier"],
    ["accountManager", "accountManager"],
    ["netTerms", "netTerms"],
    ["memberSince", "memberSince"],
];

const LABELS = {
    clerkOrgId: "Choose the Clerk organization this account belongs to.",
    companyName: "Enter the company name.",
    accountNumber: "Enter an account number.",
    tier: "Enter the pricing tier.",
    accountManager: "Enter the account manager.",
    netTerms: "Enter the payment terms.",
    memberSince: "Enter when this account started.",
} as const;

export async function upsertPortalAccountAction(
    _prev: AccountFormState,
    formData: FormData,
): Promise<AccountFormState> {
    const values = Object.fromEntries(
        Object.keys(LABELS).map((key) => [key, String(formData.get(key) ?? "").trim()]),
    ) as Record<keyof typeof LABELS, string>;

    for (const [field] of REQUIRED) {
        if (!values[field]) return { error: LABELS[field], created: null };
    }

    const billingEmail = String(formData.get("billingEmail") ?? "").trim().toLowerCase();
    if (billingEmail && !billingEmail.includes("@")) {
        return { error: "That billing email doesn't look like an address.", created: null };
    }

    try {
        await upsertPortalAccountAsStaff({ ...values, billingEmail: billingEmail || undefined });
    } catch (err) {
        if (isStaffAccessError(err)) {
            return { error: "You don't have permission to create accounts.", created: null };
        }
        return {
            error: "We couldn't save that account. Check the details and try again.",
            created: null,
        };
    }

    revalidatePath("/team/portal-accounts");
    return { error: null, created: values.companyName };
}
