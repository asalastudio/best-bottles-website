"use client";

import { useActionState, useRef, useState } from "react";
import { PortalButton } from "@/components/portal/ui";
import type { CertificateSubmitState } from "@/app/(portal)/portal/actions";

/**
 * Resale certificate submission.
 *
 * The document is uploaded straight to Convex storage from the browser, so the
 * file never travels through a server action — a scanned permit can be several
 * megabytes, comfortably past the body limit a form post should carry. Only the
 * resulting storage id is submitted.
 */

// The 50 states plus DC — Shopify issues a reseller exemption for each. Kept
// here rather than imported so this stays a client module.
const US_STATES: Array<[string, string]> = [
    ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
    ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
    ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"],
    ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"],
    ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"],
    ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
    ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"],
    ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"],
    ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"],
    ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"],
    ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"],
    ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"],
    ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
];

const MAX_BYTES = 15 * 1024 * 1024;

const labelClass =
    "block font-sans text-[11px] font-medium text-neutral-500 uppercase tracking-wide mb-1.5";
const fieldClass =
    "w-full h-9 px-3 font-sans text-sm text-neutral-900 bg-white border border-neutral-300 rounded-md " +
    "focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-300";

export default function ResaleCertificateForm({
    createUploadUrl,
    submitAction,
    defaultBusinessName,
}: {
    createUploadUrl: () => Promise<string>;
    submitAction: (
        prev: CertificateSubmitState,
        formData: FormData,
    ) => Promise<CertificateSubmitState>;
    defaultBusinessName?: string;
}) {
    const [state, formAction, pending] = useActionState(submitAction, {
        ok: false,
        error: null,
    });

    const [storageId, setStorageId] = useState("");
    const [fileName, setFileName] = useState("");
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);

    async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploadError(null);
        if (file.size > MAX_BYTES) {
            setUploadError("That file is over 15 MB. Upload a smaller scan or a PDF.");
            if (fileInput.current) fileInput.current.value = "";
            return;
        }

        setUploading(true);
        try {
            const url = await createUploadUrl();
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": file.type || "application/octet-stream" },
                body: file,
            });
            if (!res.ok) throw new Error(String(res.status));

            const { storageId: id } = (await res.json()) as { storageId: string };
            setStorageId(id);
            setFileName(file.name);
        } catch {
            setUploadError("That upload didn't complete. Check your connection and try again.");
            setStorageId("");
            setFileName("");
            if (fileInput.current) fileInput.current.value = "";
        } finally {
            setUploading(false);
        }
    }

    if (state.ok) {
        return (
            <div className="bg-white rounded-lg border border-neutral-200 px-5 py-5">
                <p className="font-sans text-sm font-medium text-neutral-900">
                    Certificate submitted for review
                </p>
                <p className="font-sans text-[13px] text-neutral-500 mt-1.5 leading-relaxed">
                    A Best Bottles employee will verify the permit against the issuing
                    state&rsquo;s registry. Orders placed meanwhile are charged sales tax; once
                    approved, tax comes off automatically at checkout.
                </p>
            </div>
        );
    }

    return (
        <form action={formAction} className="bg-white rounded-lg border border-neutral-200 px-5 py-5">
            <input type="hidden" name="documentStorageId" value={storageId} />

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                    <label className={labelClass} htmlFor="legalBusinessName">
                        Legal business name
                    </label>
                    <input
                        id="legalBusinessName"
                        name="legalBusinessName"
                        required
                        defaultValue={defaultBusinessName}
                        placeholder="As it appears on the certificate"
                        className={fieldClass}
                    />
                </div>

                <div>
                    <label className={labelClass} htmlFor="issuingState">Issuing state</label>
                    <select id="issuingState" name="issuingState" required defaultValue="" className={fieldClass}>
                        <option value="" disabled>Select a state</option>
                        {US_STATES.map(([code, name]) => (
                            <option key={code} value={code}>{name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className={labelClass} htmlFor="permitNumber">Seller&rsquo;s permit no.</label>
                    <input
                        id="permitNumber"
                        name="permitNumber"
                        required
                        placeholder="e.g. 123-456789"
                        className={fieldClass}
                    />
                </div>

                <div className="sm:col-span-2">
                    <label className={labelClass} htmlFor="certificateDocument">
                        Certificate document
                    </label>
                    <input
                        ref={fileInput}
                        id="certificateDocument"
                        type="file"
                        accept="application/pdf,image/png,image/jpeg"
                        onChange={handleFile}
                        className="block w-full font-sans text-[13px] text-neutral-600 file:mr-3 file:h-8 file:px-3 file:rounded-md file:border file:border-neutral-300 file:bg-white file:font-sans file:text-[13px] file:text-neutral-700 hover:file:bg-neutral-50"
                    />
                    <p className="font-sans text-[12px] text-neutral-400 mt-1.5">
                        CDTFA-230 or your state&rsquo;s equivalent. PDF, PNG or JPEG, up to 15 MB.
                        {uploading && <span className="text-neutral-600"> Uploading…</span>}
                        {fileName && !uploading && (
                            <span className="text-emerald-700"> Attached: {fileName}</span>
                        )}
                    </p>
                    {uploadError && (
                        <p className="font-sans text-[12px] text-red-600 mt-1">{uploadError}</p>
                    )}
                </div>
            </div>

            {state.error && (
                <p className="font-sans text-[13px] text-red-600 mt-4">{state.error}</p>
            )}

            <div className="flex items-center gap-3 mt-5">
                <PortalButton type="submit" disabled={pending || uploading}>
                    {pending ? "Submitting…" : "Submit for review"}
                </PortalButton>
                <p className="font-sans text-[12px] text-neutral-400">
                    Nothing here blocks browsing or buying.
                </p>
            </div>
        </form>
    );
}
