import { customerDeclaredExpirationLabel, customerDeclaredExpirationIsPast } from "@/lib/portal/certificateExpiration";
export const dynamic = "force-dynamic";

import { PageHeader, PortalTag } from "@/components/portal/ui";
import CertificateStatusRefresh from "@/components/portal/CertificateStatusRefresh";
import ResaleCertificateForm from "@/components/portal/ResaleCertificateForm";
import { getCertificatesForViewer } from "@/lib/portal/certificates";
import { getPortalShellData } from "@/lib/portal/server";
import { createCertificateUploadUrlAction, submitCertificateAction, validateCertificateUploadAction } from "../actions";

function formatDate(value: number | undefined) {
    if (!value) return "—";
    return new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

const STATUS_LABEL: Record<string, string> = {
    pending: "Awaiting review",
    approved: "Approved",
    rejected: "Rejected",
    expired: "Expired",
    revoked: "Superseded",
};

function statusVariant(status: string): "gold" | "green" | "muted" {
    if (status === "approved") return "green";
    if (status === "pending") return "gold";
    return "muted";
}

export default async function PortalTaxExemption() {
    const [{ certificates, active, asOf }, shell] = await Promise.all([
        getCertificatesForViewer(),
        getPortalShellData(),
    ]);

    const pending = certificates.find((cert) => cert.status === "pending") ?? null;
    // A rejection is only worth surfacing while it is the newest thing that
    // happened — once a replacement is in review, the old reason is noise.
    const latestRejection =
        !pending && !active && certificates[0]?.status === "rejected" ? certificates[0] : null;

    return (
        <div className="mx-auto max-w-[900px] px-4 py-4 lg:px-6 lg:py-6">
            <CertificateStatusRefresh />
            <PageHeader
                eyebrow="Tax Exemption"
                title="Resale certificate"
                subtitle="Anyone can buy. Buying untaxed requires an approved resale certificate, reviewed by a Best Bottles employee."
            />

            {active && (
                <div className="bg-white rounded-lg border border-emerald-200 px-5 py-5 mb-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="font-sans text-sm font-medium text-neutral-900">
                                Resale certificate verified
                            </p>
                            <dl className="mt-3 grid grid-cols-1 gap-y-1.5 sm:grid-cols-[132px_1fr] sm:gap-x-4">
                                <dt className="font-sans text-[12px] text-neutral-400">Permit no.</dt>
                                <dd className="font-sans text-[13px] text-neutral-700 tabular-nums">{active.permitNumber}</dd>
                                <dt className="font-sans text-[12px] text-neutral-400">Issuing state</dt>
                                <dd className="font-sans text-[13px] text-neutral-700">{active.issuingState}</dd>
                                <dt className="font-sans text-[12px] text-neutral-400">Expires</dt>
                                <dd className="font-sans text-[13px] text-neutral-700">
                                    {active.expiresAt ? formatDate(active.expiresAt) : "No expiry on file"}
                                </dd>
                            </dl>
                        </div>
                        <PortalTag variant={active.shopifySyncedAt ? "green" : "gold"}>{active.shopifySyncedAt ? "Checkout exempt" : "Approved · sync pending"}</PortalTag>
                    </div>

                    {!active.shopifySyncedAt && (
                        // An approval is not proof of the current checkout state.
                        <p className="font-sans text-[12px] text-amber-700 mt-4 pt-4 border-t border-neutral-100">
                            Checkout sync is not yet confirmed. Orders placed
                            right now may still be taxed. Your status is visible to staff; email delivery is not active.
                        </p>
                    )}
                </div>
            )}

            {shell.account?.certificateTaxStatus === "review_required" && (
                <div className="mb-5 rounded-lg border border-amber-200 bg-white px-5 py-5">
                    <p className="text-sm font-medium">Checkout status needs review</p>
                    <p className="mt-1.5 text-sm text-neutral-500">A previous exemption may still apply while staff reconciles checkout. A replacement submission does not confirm or remove it.</p>
                </div>
            )}

            {pending && (
                <div className="bg-white rounded-lg border border-amber-200 px-5 py-5 mb-5">
                    <p className="font-sans text-sm font-medium text-neutral-900">Under review</p>
                    <p className="font-sans text-[13px] text-neutral-500 mt-1.5 leading-relaxed">
                        Submitted {formatDate(pending.submittedAt)}. A Best Bottles employee is
                        verifying permit {pending.permitNumber} against {pending.issuingState}&rsquo;s
                        registry. Approval and successful checkout sync are required to confirm
                        this submission&rsquo;s exemption.
                    </p>
                    <p className="mt-2 text-[13px] text-neutral-600">Your declared expiration (not yet verified): {customerDeclaredExpirationLabel(pending.customerDeclaredExpiration)}</p>
                    {customerDeclaredExpirationIsPast(pending.customerDeclaredExpiration, asOf) && <p className="mt-1 text-xs text-amber-700">This is a past date. Staff will check the supporting document.</p>}
                </div>
            )}

            {latestRejection && (
                <div className="bg-white rounded-lg border border-red-200 px-5 py-5 mb-5">
                    <p className="font-sans text-sm font-medium text-neutral-900">
                        Certificate not accepted
                    </p>
                    <p className="font-sans text-[13px] text-neutral-600 mt-1.5 leading-relaxed">
                        {latestRejection.reviewNote}
                    </p>
                    <p className="font-sans text-[12px] text-neutral-400 mt-2">
                        Correct the issue and submit again below.
                    </p>
                </div>
            )}

            {!active && (
                <ResaleCertificateForm
                    createUploadUrl={createCertificateUploadUrlAction}
                    submitAction={submitCertificateAction}
                    validateUpload={validateCertificateUploadAction}
                    defaultBusinessName={shell.account?.companyName}
                />
            )}

            {certificates.length > 0 && (
                <div className="mt-8">
                    <h2 className="font-sans text-[13px] font-semibold text-neutral-900 mb-3">
                        History
                    </h2>
                    <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
                        {certificates.map((cert, i) => (
                            <div
                                key={cert._id}
                                data-portal-table-row
                                className={`grid grid-cols-[1fr_90px_120px_130px] gap-4 items-center px-5 py-3 ${
                                    i < certificates.length - 1 ? "border-b border-neutral-100" : ""
                                }`}
                            >
                                <p data-label="Business" className="font-sans text-[13px] text-neutral-900">
                                    {cert.legalBusinessName}
                                    <span className="mt-1 block text-xs text-neutral-500">Declared expiration: {customerDeclaredExpirationLabel(cert.customerDeclaredExpiration)}</span>
                                </p>
                                <p data-label="State" className="font-sans text-[13px] text-neutral-500">{cert.issuingState}</p>
                                <p data-label="Submitted" className="font-sans text-[13px] text-neutral-500 tabular-nums">
                                    {formatDate(cert.submittedAt)}
                                </p>
                                <div data-label="Status" className="flex justify-end">
                                    <PortalTag variant={statusVariant(cert.status)}>
                                        {cert.status === "approved" && cert.expiresAt !== undefined && cert.expiresAt <= asOf ? "Expired" : cert.status === "approved" && !cert.shopifySyncedAt ? "Approved · sync pending" : STATUS_LABEL[cert.status] ?? cert.status}
                                    </PortalTag>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
