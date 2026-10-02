import CertificateStatusRefresh from "@/components/portal/CertificateStatusRefresh";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { PortalTag } from "@/components/portal/ui";
import PortalAccountForm from "@/components/portal/PortalAccountForm";
import { listClerkOrganizationsForStaff, listPortalAccountsForStaff } from "@/lib/portal/accounts";
import { isStaffAccessError } from "@/lib/portal/staff";
import { upsertPortalAccountAction } from "./actions";

export const metadata = { title: { absolute: "Wholesale Accounts — Best Bottles" } };

const FALLBACK_TIERS = ["The Scaler", "The Builder"];

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
    const knownTiers = [...new Set(accounts.map((a) => a.tier).filter((tier): tier is string => Boolean(tier)))];

    return (
        <div className="min-h-screen bg-neutral-50 px-6 py-10">
            <div className="max-w-[1000px] mx-auto">
                <CertificateStatusRefresh />
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
                            profile. Pricing, Shopify linkage and certificate approval require separate review.
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
                                className={`grid grid-cols-[1fr_100px_1fr_130px_90px] gap-4 items-center px-5 py-3 ${
                                    i < accounts.length - 1 ? "border-b border-neutral-100" : ""
                                }`}
                            >
                                <div>
                                    <p className="font-sans text-[13px] font-medium text-neutral-900">
                                        <Link href={`/team/resale-certificates?org=${encodeURIComponent(account.clerkOrgId)}`}>{account.companyName}</Link>
                                    </p>
                                    <p className="font-sans text-[12px] text-neutral-400 tabular-nums">
                                        {account.accountNumber ?? "Profile awaiting review"}
                                    </p>
                                </div>
                                <p className="font-sans text-[13px] text-neutral-500">{account.tier ?? "Not assigned"}</p>
                                <p className="font-sans text-[12px] text-neutral-400 truncate">
                                    {account.billingEmail ?? (
                                        // Without this, an approved certificate has nowhere to go.
                                        <span className="text-amber-700">No billing email</span>
                                    )}
                                </p>
                                {/* The Team Hub counts accounts with no shipping
                                    address, because those customers cannot submit
                                    an order at all. That count has to land
                                    somewhere that says which ones. */}
                                <p className="font-sans text-[12px] truncate">
                                    {account.shippingAddress ? (
                                        <span className="text-neutral-400">
                                            {[account.shippingAddress.city, account.shippingAddress.provinceCode]
                                                .filter(Boolean)
                                                .join(", ") || "Address on file"}
                                        </span>
                                    ) : (
                                        <span className="text-amber-700">No shipping address</span>
                                    )}
                                    {account.shippingAddress && (
                                        <span className="block text-amber-700">
                                            {account.addressSyncStatus === "awaiting_identity" ? "Shopify link pending" : account.addressSyncStatus === "awaiting_review" ? "Shopify address review pending" : "Shopify address unverified"}
                                        </span>
                                    )}
                                </p>
                                <div className="flex justify-end">
                                    <PortalTag variant={account.taxExempt ? "green" : "muted"}>
                                        {account.certificateTaxStatus === "review_required" ? "Check sync" : account.certificateTaxStatus === "sync_pending" ? "Sync pending" : account.certificateTaxStatus === "under_review" ? "Under review" : account.taxExempt ? "Exempt" : "Taxable"}
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
                />
            </div>
        </div>
    );
}
