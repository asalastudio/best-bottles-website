export const dynamic = "force-dynamic";
import { PageHeader, PortalButton, PortalTag } from "@/components/portal/ui";
import { getPortalAccountData } from "@/lib/portal/server";

function formatCurrency(value: number | null | undefined) {
    if (typeof value !== "number") return "—";
    return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function complianceStatusLabel(status: string | null | undefined) {
    switch (status) {
        case "current":
            return "Current";
        case "expiring_soon":
            return "Expiring Soon";
        case "expired":
            return "Expired";
        case "not_on_file":
            return "Not on File";
        default:
            return "Not on File";
    }
}

function complianceStatusVariant(status: string | null | undefined): "green" | "gold" | "muted" {
    switch (status) {
        case "current":
            return "green";
        case "expiring_soon":
            return "gold";
        case "expired":
        case "not_on_file":
        default:
            return "muted";
    }
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
                <div className="space-y-4">
                    <div className="grid grid-cols-[1fr_320px] gap-4">
                        <div className="bg-white rounded-lg border border-neutral-200">
                            <div className="px-5 py-3 border-b border-neutral-200 flex items-center justify-between">
                                <h2 className="font-sans text-[14px] font-semibold text-neutral-900">Account Details</h2>
                                <div className="flex items-center gap-2">
                                    <PortalTag variant={account.taxExempt ? "green" : "muted"}>
                                        {account.taxExempt ? "Tax Exempt" : "Taxable"}
                                    </PortalTag>
                                    <PortalTag variant="muted">{account.netTerms}</PortalTag>
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
                            <div className="flex flex-col gap-2">
                                <PortalButton size="sm" type="button">Email Account Manager</PortalButton>
                                <PortalButton variant="outline" size="sm" type="button">Schedule a Call</PortalButton>
                            </div>
                        </div>
                    </div>

                    {/* Business License & Compliance */}
                    <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
                        <div className="px-5 py-3 border-b border-neutral-200 flex items-center justify-between">
                            <h2 className="font-sans text-[14px] font-semibold text-neutral-900">Business License & Compliance</h2>
                            <div className="flex items-center gap-2">
                                <PortalTag variant={complianceStatusVariant(account.complianceStatus)}>
                                    {complianceStatusLabel(account.complianceStatus)}
                                </PortalTag>
                                <PortalButton size="sm" type="button">Update Documents</PortalButton>
                            </div>
                        </div>
                        <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                            <div>
                                <p className="font-sans text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-1">
                                    Business License #
                                </p>
                                <p className="font-sans text-[14px] text-neutral-900">
                                    {account.businessLicenseNumber ?? "—"}
                                </p>
                            </div>
                            <div>
                                <p className="font-sans text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-1">
                                    License Expiry
                                </p>
                                <p className="font-sans text-[14px] text-neutral-900">
                                    {account.businessLicenseExpiry
                                        ? new Date(account.businessLicenseExpiry).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                        })
                                        : "—"}
                                </p>
                            </div>
                            <div>
                                <p className="font-sans text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-1">
                                    Resale Certificate Expiry
                                </p>
                                <p className="font-sans text-[14px] text-neutral-900">
                                    {account.resaleCertificateExpiry
                                        ? new Date(account.resaleCertificateExpiry).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                        })
                                        : "—"}
                                </p>
                            </div>
                        </div>
                        <div className="px-5 py-3 bg-neutral-50 border-t border-neutral-100">
                            <p className="font-sans text-[12px] text-neutral-500">
                                Keep your business license and resale certificate current to maintain tax-exempt status. Upload updated documents before expiry to avoid interruption.
                            </p>
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
