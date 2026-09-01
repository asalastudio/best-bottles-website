"use client";

/**
 * The tax-exemption card: current status, certificates on file, and the form
 * to add one.
 *
 * Jordan's model is one price for everybody — the only thing an account
 * changes is whether tax is charged. So for a buyer this card IS the account,
 * and its job is to answer one question without them having to ask anyone:
 * am I being charged tax right now, and if so what do I do about it?
 *
 * That is why the status is never a bare "Taxable". Nothing filed, filed and
 * waiting on us, rejected for a fixable reason, and lapsed are four different
 * situations with four different next steps, and the lapsed one is the
 * expensive one — it starts charging tax to somebody who used to be exempt
 * and has no reason to look.
 */

import { useActionState } from "react";
import { PortalTag } from "@/components/portal/ui";
import {
    exemptionDetail, exemptionLabel, exemptionTone, type ExemptionLike,
} from "@/lib/portal/exemption";

type Certificate = {
    _id: string;
    permitNumber: string;
    issuingState: string;
    issuedOn?: string;
    expiresOn?: string;
    status: "submitted" | "approved" | "rejected" | "revoked";
    submittedAt: number;
    reviewedAt?: number;
    reviewNote?: string;
    fileName?: string;
    documentUrl?: string | null;
};

const STATUS_TONE: Record<Certificate["status"], "green" | "gold" | "muted"> = {
    approved: "green", submitted: "gold", rejected: "muted", revoked: "muted",
};

export function ResaleCertificateCard({
    exemption, certificates, action,
}: {
    exemption: ExemptionLike;
    certificates: Certificate[];
    action: (
        prev: { error?: string; ok?: boolean } | null,
        formData: FormData,
    ) => Promise<{ error?: string; ok?: boolean }>;
}) {
    const [state, formAction, pending] = useActionState(action, null);
    const detail = exemptionDetail(exemption);

    return (
        <div className="bg-white rounded-lg border border-neutral-200 mb-4">
            <div className="px-5 py-3 border-b border-neutral-200 flex items-center justify-between">
                <h2 className="font-sans text-[14px] font-semibold text-neutral-900">
                    Tax Exemption
                </h2>
                <PortalTag variant={exemptionTone(exemption)}>
                    {exemptionLabel(exemption)}
                </PortalTag>
            </div>

            <div className="px-5 py-4">
                {detail && (
                    <p className="font-sans text-sm text-neutral-600 mb-4">{detail}</p>
                )}

                {certificates.length > 0 && (
                    <table className="w-full mb-5 text-sm font-sans">
                        <thead>
                            <tr className="text-left text-neutral-400 text-[12px]">
                                <th className="pb-2 font-medium">State</th>
                                <th className="pb-2 font-medium">Permit</th>
                                <th className="pb-2 font-medium">Expires</th>
                                <th className="pb-2 font-medium">Status</th>
                                <th className="pb-2 font-medium">Document</th>
                            </tr>
                        </thead>
                        <tbody>
                            {certificates.map((c) => (
                                <tr key={c._id} className="border-t border-neutral-100">
                                    <td className="py-2 text-neutral-900">{c.issuingState}</td>
                                    <td className="py-2 text-neutral-600">{c.permitNumber}</td>
                                    {/* a blanket certificate has no expiry — say so rather
                                        than leaving a blank that reads as missing data */}
                                    <td className="py-2 text-neutral-600">
                                        {c.expiresOn ?? "No expiry"}
                                    </td>
                                    <td className="py-2">
                                        <PortalTag variant={STATUS_TONE[c.status]}>
                                            {c.status}
                                        </PortalTag>
                                        {c.reviewNote && (
                                            <span className="block text-[12px] text-neutral-500 mt-1">
                                                {c.reviewNote}
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-2">
                                        {c.documentUrl ? (
                                            <a href={c.documentUrl} target="_blank" rel="noreferrer"
                                               className="text-muted-gold underline">
                                                {c.fileName ?? "View"}
                                            </a>
                                        ) : <span className="text-neutral-400">—</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                <form action={formAction} className="border-t border-neutral-100 pt-4">
                    <p className="font-sans text-[13px] font-semibold text-neutral-900 mb-3">
                        {certificates.length ? "Add another certificate" : "Add a resale certificate"}
                    </p>
                    <div className="grid grid-cols-4 gap-3">
                        <Field label="Permit / licence number" name="permitNumber" required
                               placeholder="SR-KH-123456" />
                        {/* the buyer's OWN state: CDTFA is California's authority,
                            a Texas buyer files a Texas form */}
                        <Field label="Issuing state" name="issuingState" required
                               placeholder="CA" maxLength={2} />
                        <Field label="Issued" name="issuedOn" type="date" />
                        <Field label="Expires" name="expiresOn" type="date"
                               hint="Leave blank if blanket" />
                    </div>
                    <div className="mt-3">
                        <label className="block font-sans text-[12px] text-neutral-500 mb-1">
                            Certificate scan (PDF or photo, max 8MB)
                        </label>
                        <input type="file" name="certificate"
                               accept="application/pdf,image/jpeg,image/png,image/heic,image/webp"
                               className="font-sans text-sm text-neutral-700" />
                    </div>

                    {state?.error && (
                        <p className="mt-3 font-sans text-sm text-red-600">{state.error}</p>
                    )}
                    {state?.ok && (
                        <p className="mt-3 font-sans text-sm text-emerald-700">
                            Submitted. Our team reviews certificates within one business day —
                            orders are charged tax until it is approved.
                        </p>
                    )}

                    <button type="submit" disabled={pending}
                            className="mt-4 px-4 py-2 rounded-md bg-neutral-900 text-white
                                       font-sans text-sm font-medium disabled:opacity-50">
                        {pending ? "Submitting…" : "Submit certificate"}
                    </button>
                </form>
            </div>
        </div>
    );
}

function Field({ label, name, type = "text", required, placeholder, maxLength, hint }: {
    label: string; name: string; type?: string; required?: boolean;
    placeholder?: string; maxLength?: number; hint?: string;
}) {
    return (
        <label className="block">
            <span className="block font-sans text-[12px] text-neutral-500 mb-1">
                {label}{required && <span className="text-neutral-400"> *</span>}
            </span>
            <input
                name={name} type={type} required={required}
                placeholder={placeholder} maxLength={maxLength}
                className="w-full px-2.5 py-1.5 rounded-md border border-neutral-200
                           font-sans text-sm text-neutral-900"
            />
            {hint && (
                <span className="block font-sans text-[11px] text-neutral-400 mt-1">{hint}</span>
            )}
        </label>
    );
}
