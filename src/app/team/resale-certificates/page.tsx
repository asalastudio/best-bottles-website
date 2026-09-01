export const dynamic = "force-dynamic";

import Link from "next/link";
import { PortalTag } from "@/components/portal/ui";
import { listAllCertificatesForStaff } from "@/lib/portal/certificates";
import { isStaffAccessError } from "@/lib/portal/staff";
import { approveCertificateAction, rejectCertificateAction } from "@/app/(portal)/portal/actions";

export const metadata = { title: { absolute: "Certificate Review Queue — Best Bottles" } };

function formatAge(ts: number) {
    const days = Math.floor((Date.now() - ts) / 86_400_000);
    if (days < 1) return "Today";
    if (days === 1) return "1 day ago";
    return `${days} days ago`;
}

function money(value: number, currencyCode: string) {
    return value.toLocaleString("en-US", { style: "currency", currency: currencyCode });
}

function formatDate(ts: number | undefined) {
    if (!ts) return "—";
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function AccessDenied() {
    return (
        <div className="min-h-screen bg-bone px-6 py-24">
            <div className="max-w-[640px] mx-auto bg-white border border-champagne/40 rounded-xl px-8 py-8">
                <p className="text-[11px] uppercase tracking-[0.28em] text-muted-gold font-semibold mb-3">
                    Staff Only
                </p>
                <h1 className="font-serif text-3xl text-obsidian mb-3">
                    You don&rsquo;t have access to the review queue
                </h1>
                <p className="text-sm text-slate leading-relaxed">
                    Certificate review is limited to Best Bottles staff. If you should have access,
                    ask an administrator to add you to the team hub.
                </p>
            </div>
        </div>
    );
}

const inputClass =
    "h-8 px-2 font-sans text-[13px] text-neutral-900 bg-white border border-neutral-300 rounded-md " +
    "focus:outline-none focus:border-neutral-500";

function Stat({ label, value, tone }: { label: string; value: number; tone: "gold" | "green" | "red" | "muted" }) {
    const toneClass = {
        gold: "text-amber-700",
        green: "text-emerald-700",
        red: "text-red-600",
        muted: "text-neutral-900",
    }[tone];
    return (
        <div className="bg-white rounded-lg border border-neutral-200 px-4 py-3">
            <p className={`font-sans text-[24px] font-semibold tabular-nums leading-none ${toneClass}`}>{value}</p>
            <p className="font-sans text-[11px] font-medium text-neutral-400 uppercase tracking-wide mt-1.5">{label}</p>
        </div>
    );
}

function StatusTag({ row }: { row: { status: string; lapsed: boolean; awaitingShopifySync: boolean } }) {
    if (row.lapsed) return <PortalTag variant="muted">Lapsed</PortalTag>;
    if (row.status === "approved") {
        return row.awaitingShopifySync
            ? <PortalTag variant="gold">Not synced</PortalTag>
            : <PortalTag variant="green">Exempt</PortalTag>;
    }
    if (row.status === "pending") return <PortalTag variant="gold">Awaiting review</PortalTag>;
    if (row.status === "rejected") return <PortalTag variant="muted">Rejected</PortalTag>;
    if (row.status === "expired") return <PortalTag variant="muted">Expired</PortalTag>;
    return <PortalTag variant="muted">Superseded</PortalTag>;
}

export default async function CertificateReviewQueue() {
    let data;
    try {
        data = await listAllCertificatesForStaff();
    } catch (err) {
        if (isStaffAccessError(err)) return <AccessDenied />;
        throw err;
    }

    const { certificates, counts } = data;
    const pending = certificates.filter((c) => c.status === "pending");
    const attention = certificates.filter((c) => c.awaitingShopifySync || c.lapsed);

    return (
        <div className="min-h-screen bg-neutral-50 px-6 py-10">
            <div className="max-w-[1180px] mx-auto">
                <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
                    <div>
                        <p className="font-sans text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-1">
                            Staff · Tax Compliance
                        </p>
                        <h1 className="font-sans text-[22px] font-semibold text-neutral-900 leading-tight">
                            Certificate Review Queue
                        </h1>
                        <p className="font-sans text-sm text-neutral-500 mt-1">
                            Every resale certificate across all wholesale accounts. Verify each permit
                            against the issuing state&rsquo;s registry before approving.
                        </p>
                    </div>
                    <Link
                        href="/team/portal-accounts"
                        className="font-sans text-[13px] text-muted-gold underline underline-offset-2 hover:text-gold-dim"
                    >
                        Wholesale accounts →
                    </Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                    <Stat label="Awaiting review" value={counts.pending} tone="gold" />
                    <Stat label="Tax exempt" value={counts.approved} tone="green" />
                    <Stat label="Not synced" value={counts.awaitingSync} tone="red" />
                    <Stat label="Lapsed" value={counts.lapsed} tone="red" />
                    <Stat label="Expired" value={counts.expired} tone="muted" />
                    <Stat label="Rejected" value={counts.rejected} tone="muted" />
                </div>

                {attention.length > 0 && (
                    // These two states cost real money in opposite directions, so
                    // they get their own band rather than sitting in a long table.
                    <div className="bg-white rounded-lg border border-red-200 px-5 py-4 mb-6">
                        <h2 className="font-sans text-[13px] font-semibold text-neutral-900 mb-2">
                            Needs attention
                        </h2>
                        <ul className="flex flex-col gap-1.5">
                            {attention.map((row) => (
                                <li key={row._id} className="font-sans text-[13px] text-neutral-600">
                                    <span className="font-medium text-neutral-900">{row.companyName}</span>
                                    {row.awaitingShopifySync && !row.lapsed && (
                                        <> — approved but never written to Shopify. This account is still being charged tax.</>
                                    )}
                                    {row.lapsed && (
                                        <> — expired {formatDate(row.expiresAt)}. Shopify may still be exempting it.</>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <h2 className="font-sans text-[13px] font-semibold text-neutral-900 mb-3">
                    Awaiting review ({pending.length})
                </h2>
                {pending.length === 0 ? (
                    <div className="bg-white rounded-lg border border-neutral-200 px-5 py-8 text-center mb-8">
                        <p className="font-sans text-sm text-neutral-500">Nothing awaiting review.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3 mb-8">
                        {pending.map((cert) => (
                            <div key={cert._id} className="bg-white rounded-lg border border-neutral-200 px-5 py-4">
                                <div className="flex items-start justify-between gap-6 flex-wrap">
                                    <div className="min-w-[240px]">
                                        <p className="font-sans text-sm font-medium text-neutral-900">
                                            {cert.companyName}
                                            {cert.accountNumber && (
                                                <span className="font-normal text-neutral-400"> · {cert.accountNumber}</span>
                                            )}
                                        </p>
                                        <p className="font-sans text-[13px] text-neutral-500 mt-1">
                                            {cert.legalBusinessName} · {cert.issuingState} · permit{" "}
                                            <span className="tabular-nums">{cert.permitNumber}</span>
                                        </p>
                                        <p className="font-sans text-[12px] text-neutral-400 mt-1">
                                            Submitted {formatAge(cert.submittedAt)}
                                        </p>
                                    </div>
                                    <div className="pt-1 text-right">
                                        {cert.documentUrl ? (
                                            <Link href={cert.documentUrl} target="_blank" rel="noopener noreferrer"
                                                className="font-sans text-[13px] text-muted-gold underline underline-offset-2 hover:text-gold-dim">
                                                View document ↗
                                            </Link>
                                        ) : (
                                            <span className="font-sans text-[13px] text-amber-700">No document attached</span>
                                        )}
                                        {!cert.billingEmail && (
                                            // Approval would succeed here and the exemption would
                                            // have nowhere to go.
                                            <p className="font-sans text-[12px] text-red-600 mt-1">
                                                Account has no billing email — approval can&rsquo;t sync
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {cert.pendingWindow && cert.pendingWindow.orders.length > 0 && (
                                    <div className="mt-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-md">
                                        <p className="font-sans text-[13px] text-neutral-900">
                                            <span className="font-medium">
                                                {money(cert.pendingWindow.taxTotal, cert.pendingWindow.currencyCode)}
                                            </span>{" "}
                                            in sales tax across {cert.pendingWindow.orders.length}{" "}
                                            {cert.pendingWindow.orders.length === 1 ? "order" : "orders"} placed
                                            while this was awaiting review.
                                        </p>
                                        <p className="font-sans text-[12px] text-neutral-500 mt-1">
                                            {cert.pendingWindow.orders
                                                .map((o) => `${o.name} · ${money(o.tax, o.currencyCode)}`)
                                                .join("   ")}
                                        </p>
                                        <p className="font-sans text-[12px] text-neutral-400 mt-1.5">
                                            Refund in Shopify after approving — Shopify has no API to
                                            un-collect tax on a completed order.
                                        </p>
                                    </div>
                                )}

                                <div className="flex flex-wrap items-end gap-6 mt-4 pt-4 border-t border-neutral-100">
                                    <form action={approveCertificateAction} className="flex items-end gap-2">
                                        <input type="hidden" name="certificateId" value={cert._id} />
                                        <div>
                                            <label className="block font-sans text-[11px] font-medium text-neutral-500 uppercase tracking-wide mb-1.5"
                                                htmlFor={`expiry-${cert._id}`}>Expires</label>
                                            <input id={`expiry-${cert._id}`} type="date" name="expiresAt" className={inputClass} />
                                        </div>
                                        <button type="submit"
                                            className="h-8 px-3 font-sans text-[13px] font-medium rounded-md border bg-neutral-900 text-white border-neutral-900 hover:bg-neutral-800">
                                            Approve
                                        </button>
                                    </form>

                                    <form action={rejectCertificateAction} className="flex items-end gap-2 flex-1 min-w-[300px]">
                                        <input type="hidden" name="certificateId" value={cert._id} />
                                        <div className="flex-1">
                                            <label className="block font-sans text-[11px] font-medium text-neutral-500 uppercase tracking-wide mb-1.5"
                                                htmlFor={`reason-${cert._id}`}>Reason (shown to the customer)</label>
                                            <input id={`reason-${cert._id}`} name="reviewNote" required
                                                placeholder="e.g. Permit number not found in the CDTFA registry"
                                                className={`${inputClass} w-full`} />
                                        </div>
                                        <button type="submit"
                                            className="h-8 px-3 font-sans text-[13px] font-medium rounded-md border bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50">
                                            Reject
                                        </button>
                                    </form>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <h2 className="font-sans text-[13px] font-semibold text-neutral-900 mb-3">
                    All certificates ({certificates.length})
                </h2>
                <div className="bg-white rounded-lg border border-neutral-200 overflow-x-auto">
                    <div className="min-w-[880px]">
                        <div className="grid grid-cols-[1.4fr_60px_130px_120px_120px_130px] gap-4 px-5 py-3 bg-neutral-50 border-b border-neutral-200">
                            {["Account", "State", "Permit no.", "Submitted", "Expires", "Status"].map((h) => (
                                <p key={h} className="font-sans text-[11px] font-medium text-neutral-400 uppercase tracking-wide">{h}</p>
                            ))}
                        </div>
                        {certificates.length === 0 ? (
                            <p className="px-5 py-8 text-center font-sans text-sm text-neutral-500">
                                No certificates submitted yet.
                            </p>
                        ) : (
                            certificates.map((row, i) => (
                                <div key={row._id}
                                    className={`grid grid-cols-[1.4fr_60px_130px_120px_120px_130px] gap-4 items-center px-5 py-3 ${
                                        i < certificates.length - 1 ? "border-b border-neutral-100" : ""
                                    }`}>
                                    <div>
                                        <p className="font-sans text-[13px] text-neutral-900">{row.companyName}</p>
                                        <p className="font-sans text-[12px] text-neutral-400">{row.legalBusinessName}</p>
                                    </div>
                                    <p className="font-sans text-[13px] text-neutral-500">{row.issuingState}</p>
                                    <p className="font-sans text-[13px] text-neutral-500 tabular-nums">{row.permitNumber}</p>
                                    <p className="font-sans text-[13px] text-neutral-500 tabular-nums">{formatDate(row.submittedAt)}</p>
                                    <p className="font-sans text-[13px] text-neutral-500 tabular-nums">{formatDate(row.expiresAt)}</p>
                                    <div className="flex justify-start"><StatusTag row={row} /></div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
