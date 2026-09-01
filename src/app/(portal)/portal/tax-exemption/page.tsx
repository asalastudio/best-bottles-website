export const dynamic = "force-dynamic";

import { PageHeader, PortalTag } from "@/components/portal/ui";
import ResaleCertificateForm from "@/components/portal/ResaleCertificateForm";
import { getCertificatesForViewer } from "@/lib/portal/certificates";
import { getPortalShellData } from "@/lib/portal/server";
import { createCertificateUploadUrlAction, submitCertificateAction } from "../actions";

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
    const [{ certificates, active }, shell] = await Promise.all([
        getCertificatesForViewer(),
        getPortalShellData(),
    ]);

    const pending = certificates.find((cert) => cert.status === "pending") ?? null;
    // A rejection is only worth surfacing while it is the newest thing that
    // happened — once a replacement is in review, the old reason is noise.
    const latestRejection =
        !pending && !active && certificates[0]?.status === "rejected" ? certificates[0] : null;

    return (
        <div className="px-6 py-6 max-w-[900px]">
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
                            <dl className="grid grid-cols-[132px_1fr] gap-x-4 gap-y-1.5 mt-3">
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
                        <PortalTag variant="green">Tax Exempt</PortalTag>
                    </div>

                    {!active.shopifySyncedAt && (
                        // Approved here but never written to Shopify — checkout will
                        // still charge tax, so say so rather than imply otherwise.
                        <p className="font-sans text-[12px] text-amber-700 mt-4 pt-4 border-t border-neutral-100">
                            This exemption hasn&rsquo;t finished syncing to checkout yet. Orders placed
                            right now may still be taxed — your account manager has been notified.
                        </p>
                    )}
                </div>
            )}

            {pending && (
                <div className="bg-white rounded-lg border border-amber-200 px-5 py-5 mb-5">
                    <p className="font-sans text-sm font-medium text-neutral-900">Under review</p>
                    <p className="font-sans text-[13px] text-neutral-500 mt-1.5 leading-relaxed">
                        Submitted {formatDate(pending.submittedAt)}. A Best Bottles employee is
                        verifying permit {pending.permitNumber} against {pending.issuingState}&rsquo;s
                        registry. Orders placed now are charged sales tax; once approved, tax comes
                        off automatically.
                    </p>
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

            {!pending && !active && (
                <ResaleCertificateForm
                    createUploadUrl={createCertificateUploadUrlAction}
                    submitAction={submitCertificateAction}
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
                                className={`grid grid-cols-[1fr_90px_120px_130px] gap-4 items-center px-5 py-3 ${
                                    i < certificates.length - 1 ? "border-b border-neutral-100" : ""
                                }`}
                            >
                                <p className="font-sans text-[13px] text-neutral-900">
                                    {cert.legalBusinessName}
                                </p>
                                <p className="font-sans text-[13px] text-neutral-500">{cert.issuingState}</p>
                                <p className="font-sans text-[13px] text-neutral-500 tabular-nums">
                                    {formatDate(cert.submittedAt)}
                                </p>
                                <div className="flex justify-end">
                                    <PortalTag variant={statusVariant(cert.status)}>
                                        {STATUS_LABEL[cert.status] ?? cert.status}
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
