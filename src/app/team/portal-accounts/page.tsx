export const dynamic = "force-dynamic";

import Link from "next/link";
import { PortalTag } from "@/components/portal/ui";
import PortalAccountForm from "@/components/portal/PortalAccountForm";
import { listClerkOrganizationsForStaff, listPortalAccountsForStaff } from "@/lib/portal/accounts";
import { isStaffAccessError } from "@/lib/portal/staff";
import { upsertPortalAccountAction } from "./actions";

export const metadata = { title: { absolute: "Wholesale Accounts — Best Bottles" } };

const FALLBACK_TIERS = ["The Scaler", "The Builder"];
const FALLBACK_TERMS = ["Net 15", "Net 30", "Net 45", "Net 60", "Prepaid"];

function AccessDenied() {
    return (
        <div className="min-h-screen bg-bone px-6 py-24">
            <div className="max-w-[640px] mx-auto bg-white border border-champagne/40 rounded-xl px-8 py-8">
                <p className="text-[11px] uppercase tracking-[0.28em] text-muted-gold font-semibold mb-3">
                    Staff Only
                </p>
                <h1 className="font-serif text-3xl text-obsidian mb-3">
                    You don&rsquo;t have access to wholesale accounts
                </h1>
                <p className="text-sm text-slate leading-relaxed">
                    Account provisioning is limited to Best Bottles staff.
                </p>
            </div>
        </div>
    );
}

export default async function PortalAccountsPage() {
    let accounts;
    let organizations;
    try {
        [accounts, organizations] = await Promise.all([
            listPortalAccountsForStaff(),
            listClerkOrganizationsForStaff(),
        ]);
    } catch (err) {
        if (isStaffAccessError(err)) return <AccessDenied />;
        throw err;
    }

    // Offer what this business actually uses rather than a taxonomy invented
    // here, falling back only when there is nothing to learn from yet.
    const knownTiers = [...new Set(accounts.map((a) => a.tier).filter(Boolean))];
    const knownTerms = [...new Set(accounts.map((a) => a.netTerms).filter(Boolean))];

    return (
        <div className="min-h-screen bg-neutral-50 px-6 py-10">
            <div className="max-w-[1000px] mx-auto">
                <div className="flex items-end justify-between mb-6">
                    <div>
                        <p className="font-sans text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-1">
                            Staff · Wholesale
                        </p>
                        <h1 className="font-sans text-[22px] font-semibold text-neutral-900 leading-tight">
                            Wholesale Accounts
                        </h1>
                        <p className="font-sans text-sm text-neutral-500 mt-1">
                            A portal account is what turns a Clerk organization into a wholesale
                            customer with pricing, terms and tax status.
                        </p>
                    </div>
                    <Link
                        href="/team/resale-certificates"
                        className="font-sans text-[13px] text-muted-gold underline underline-offset-2 hover:text-gold-dim"
                    >
                        Certificate queue →
                    </Link>
                </div>

                <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden mb-6">
                    <div className="px-5 py-3 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
                        <h2 className="font-sans text-[13px] font-semibold text-neutral-900">
                            Existing accounts
                        </h2>
                        <PortalTag variant="muted">{accounts.length}</PortalTag>
                    </div>

                    {accounts.length === 0 ? (
                        <p className="px-5 py-8 text-center font-sans text-sm text-neutral-500">
                            No wholesale accounts yet.
                        </p>
                    ) : (
                        accounts.map((account, i) => (
                            <div
                                key={account._id}
                                className={`grid grid-cols-[1fr_110px_110px_1fr_90px] gap-4 items-center px-5 py-3 ${
                                    i < accounts.length - 1 ? "border-b border-neutral-100" : ""
                                }`}
                            >
                                <div>
                                    <p className="font-sans text-[13px] font-medium text-neutral-900">
                                        {account.companyName}
                                    </p>
                                    <p className="font-sans text-[12px] text-neutral-400 tabular-nums">
                                        {account.accountNumber}
                                    </p>
                                </div>
                                <p className="font-sans text-[13px] text-neutral-500">{account.tier}</p>
                                <p className="font-sans text-[13px] text-neutral-500">{account.netTerms}</p>
                                <p className="font-sans text-[12px] text-neutral-400 truncate">
                                    {account.billingEmail ?? (
                                        // Without this, an approved certificate has nowhere to go.
                                        <span className="text-amber-700">No billing email</span>
                                    )}
                                </p>
                                <div className="flex justify-end">
                                    <PortalTag variant={account.taxExempt ? "green" : "muted"}>
                                        {account.taxExempt ? "Exempt" : "Taxable"}
                                    </PortalTag>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <PortalAccountForm
                    organizations={organizations}
                    action={upsertPortalAccountAction}
                    knownTiers={knownTiers.length > 0 ? knownTiers : FALLBACK_TIERS}
                    knownTerms={knownTerms.length > 0 ? knownTerms : FALLBACK_TERMS}
                />
            </div>
        </div>
    );
}
