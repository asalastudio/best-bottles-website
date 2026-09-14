export const dynamic = "force-dynamic";
import Link from "next/link";
import { PageHeader, PortalTag } from "@/components/portal/ui";
import { getPortalAccountData } from "@/lib/portal/server";

function formatCurrency(value: number | null | undefined) {
    if (typeof value !== "number") return "—";
    return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default async function PortalAccount() {
    const { account, orders } = await getPortalAccountData();
    const deliveredSpend = orders
        .filter((order) => order.status === "delivered")
        .reduce((sum, order) => sum + (order.totalAmount ?? 0), 0);

    return (
        <div className="px-6 py-6 max-w-[1200px]">
            <PageHeader eyebrow="Account" title="Account & Pricing" />

            {account ? (
                <div className="grid grid-cols-[1fr_320px] gap-4">
                    <div className="bg-white rounded-lg border border-neutral-200">
                        <div className="px-5 py-3 border-b border-neutral-200 flex items-center justify-between">
                            <h2 className="font-sans text-[14px] font-semibold text-neutral-900">Account Details</h2>
                            <div className="flex items-center gap-2">
                                <PortalTag variant={account.taxExempt ? "green" : "muted"}>
                                    {account.taxExempt ? "Tax Exempt" : "Taxable"}
                                </PortalTag>
                            </div>
                        </div>
                        <div className="px-5 py-4 grid grid-cols-2 gap-x-6 gap-y-4">
                            {[
                                ["Company", account.companyName],
                                ["Account Number", account.accountNumber],
                                ["Tier", account.tier],
                                ["Account Manager", account.accountManager],
                                ["Member Since", account.memberSince],
                                ["Delivered Spend", formatCurrency(deliveredSpend)],
                            ].map(([label, value]) => (
                                <div key={label}>
                                    <p className="font-sans text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-1">
                                        {label}
                                    </p>
                                    <p className="font-sans text-[14px] text-neutral-900">{value}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-lg border border-neutral-200 px-5 py-5">
                        <p className="font-sans text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-1">
                            Account Manager
                        </p>
                        <p className="font-sans text-[16px] font-semibold text-neutral-900">
                            {account.accountManager}
                        </p>
                        <p className="font-sans text-[13px] text-neutral-500 mt-1 mb-4">
                            Contact your account manager for custom pricing, samples, or support with order changes.
                        </p>
                        {/* Both of these used to be inert buttons. A control that
                            looks clickable and does nothing is the same broken
                            promise as a page of invented data, so they now go
                            somewhere real: the sales inbox and the contact form. */}
                        <div className="flex flex-col gap-2">
                            <a
                                href={`mailto:sales@bestbottles.com?subject=${encodeURIComponent(`Best Bottles account ${account.accountNumber} — ${account.companyName}`)}`}
                                className="inline-flex items-center justify-center h-8 px-3 text-[13px] font-sans font-medium rounded-md bg-neutral-900 text-white hover:bg-neutral-800 transition-colors"
                            >
                                Email your account manager
                            </a>
                            <Link
                                href="/contact"
                                className="inline-flex items-center justify-center h-8 px-3 text-[13px] font-sans font-medium rounded-md border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 transition-colors"
                            >
                                Request a call
                            </Link>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-lg border border-neutral-200 px-6 py-6">
                    <h2 className="font-sans text-[18px] font-semibold text-neutral-900 mb-2">
                        Account sync pending
                    </h2>
                    <p className="font-sans text-sm text-neutral-500 leading-relaxed">
                        Your Clerk organization is active, but there is no matching `portalAccounts` record in Convex yet.
                        Once your account is seeded, this page will show live terms, tax status, account manager, and spend.
                    </p>
                </div>
            )}
        </div>
    );
}
