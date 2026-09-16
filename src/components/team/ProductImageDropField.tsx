"use client";

import { useId, useRef, useState } from "react";
import { PRODUCT_IMAGE_ACCEPT, validateProductImageFile } from "@/lib/team/productImageUpload";
import { cn } from "@/lib/utils";

export default function ProductImageDropField({
    id,
    name,
    label,
    hint,
    value,
    onChange,
    createUploadUrl,
    resolveUrl,
}: {
    id: string;
    name: string;
    label: string;
    hint: string;
    value: string;
    onChange: (url: string) => void;
    createUploadUrl: () => Promise<string>;
    resolveUrl: (storageId: string) => Promise<string>;
}) {
    const inputId = useId();
    const fileInput = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function ingest(file: File) {
        const problem = validateProductImageFile(file);
        if (problem) {
            setError(problem);
            return;
        }
        setError(null);
        setUploading(true);
        try {
            const uploadUrl = await createUploadUrl();
            const uploaded = await fetch(uploadUrl, {
                method: "POST",
                headers: { "Content-Type": file.type || "application/octet-stream" },
                body: file,
            });
            if (!uploaded.ok) throw new Error(String(uploaded.status));
            const { storageId } = (await uploaded.json()) as { storageId?: string };
            if (!storageId) throw new Error("missing_storage_id");
            const url = await resolveUrl(storageId);
            onChange(url);
        } catch {
            setError("That upload didn't complete. Check your connection and try again.");
        } finally {
            setUploading(false);
            if (fileInput.current) fileInput.current.value = "";
        }
    }

    return (
        <div data-product-image-drop={name}>
            <p className="mb-1.5 font-sans text-[12px] font-semibold text-obsidian">{label}</p>
            <p className="mb-2 text-[12px] leading-5 text-slate">{hint}</p>
            <input type="hidden" name={name} id={id} value={value} />
            <label
                htmlFor={inputId}
                data-desktop-drop-zone
                onDragEnter={(event) => {
                    event.preventDefault();
                    setDragging(true);
                }}
                onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "copy";
                    setDragging(true);
                }}
                onDragLeave={(event) => {
                    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
                    setDragging(false);
                }}
                onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    const file = event.dataTransfer.files[0];
                    if (file) void ingest(file);
                }}
                className={cn(
                    "flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-5 text-center transition-colors lg:min-h-[168px]",
                    dragging ? "border-muted-gold bg-linen" : "border-champagne/80 bg-bone hover:border-muted-gold",
                    uploading && "pointer-events-none opacity-70",
                )}
            >
                <input
                    ref={fileInput}
                    id={inputId}
                    type="file"
                    accept={PRODUCT_IMAGE_ACCEPT}
                    className="sr-only"
                    disabled={uploading}
                    onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void ingest(file);
                    }}
                />
                {value ? (
                    // eslint-disable-next-line @next/next/no-img-element -- staff preview of a just-uploaded or pasted URL
                    <img src={value} alt="" className="h-20 w-20 rounded-md object-contain bg-white" />
                ) : (
                    <span className="grid h-11 w-11 place-items-center rounded-full border border-champagne bg-white text-lg text-obsidian" aria-hidden>
                        +
                    </span>
                )}
                <span className="font-sans text-[13px] font-medium text-obsidian">
                    {uploading ? "Uploading…" : value ? "Replace photo" : "Add photo"}
                </span>
                <span className="hidden font-sans text-[12px] text-slate lg:block">
                    Drop an image here, or click to browse. PNG, JPEG, or WebP, up to 8 MB.
                </span>
                <span className="font-sans text-[12px] text-slate lg:hidden">
                    Take or choose a photo. PNG, JPEG, or WebP, up to 8 MB.
                </span>
            </label>
            {value ? (
                <button
                    type="button"
                    className="mt-2 min-h-11 font-sans text-[12px] text-slate underline underline-offset-4 hover:text-obsidian lg:min-h-0"
                    onClick={() => {
                        onChange("");
                        setError(null);
                    }}
                >
                    Remove photo
                </button>
            ) : null}
            <label className="mt-3 block">
                <span className="mb-1.5 block font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-gold-dim">
                    Or paste a URL
                </span>
                <input
                    type="text"
                    inputMode="url"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder="https://"
                    className="h-11 w-full rounded-md border border-champagne/70 bg-white px-3 font-sans text-[16px] text-obsidian placeholder:text-ash lg:h-10 lg:text-sm"
                />
            </label>
            {error ? (
                <p className="mt-2 font-sans text-[12px] text-red-700" role="alert">
                    {error}
                </p>
            ) : null}
        </div>
    );
}
