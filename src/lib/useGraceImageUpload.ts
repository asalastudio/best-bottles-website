"use client";

import { useCallback, useState } from "react";
import { useGrace } from "@/components/useGrace";
import { getAnonOwnerKey } from "@/lib/graceAnonOwnerKey";
import type { ProductCard, ReferenceMatchPayload } from "@/components/GraceContext";

/**
 * End-to-end image-upload + vision flow for Grace's reference-match
 * pattern (PRD Pattern H). Bypasses the Realtime session — runs purely client-side
 * with two server endpoints (/api/grace/upload + /api/grace/vision) and
 * the existing searchCatalog tool.
 *
 * Flow:
 *   1. uploadAndAnalyze(file) — uploads file → vision → searchCatalog
 *   2. Appends a user message with the image attachment (so it shows in chat)
 *   3. Appends a Grace message with Pattern H action (image + matches)
 *
 * Returns `{ uploadAndAnalyze, status }` for the composer to wire.
 */
export type UploadStatus = "idle" | "uploading" | "analyzing" | "searching" | "done" | "error";

type GraceUploadResponse = { url?: string; error?: string };
type GraceVisionResponse = { description?: string; searchTerms?: string; error?: string };
type GraceSearchResponse = { result?: ProductCard[] | string; error?: string };

const IMAGE_ANALYSIS_UNAVAILABLE =
    "I couldn't analyze that image yet. Please try again in a moment, or describe the bottle shape, color, size, and closure and I can search from that.";

class GraceImageFlowError extends Error {
    constructor(readonly customerMessage: string) {
        super(customerMessage);
        this.name = "GraceImageFlowError";
    }
}

function isSensitiveProviderMessage(message: string): boolean {
    return /(api key|openai|platform\.openai|sk-[a-z0-9]|401|403|unauthorized|convex|token|NEXT_PUBLIC_)/i.test(message);
}

function friendlyUploadError(error?: string): string {
    const message = error?.trim();
    if (!message) return "I couldn't upload that image. Please use a PNG, JPG, or WebP under 8MB.";
    if (/8mb/i.test(message)) return "That image is over the 8MB limit. Please attach a smaller PNG, JPG, or WebP.";
    if (/unsupported mime|unsupported.*type/i.test(message)) return "That file type is not supported. Please attach a PNG, JPG, or WebP image.";
    if (isSensitiveProviderMessage(message)) return "I couldn't upload that image right now. Please try again in a moment.";
    return message;
}

function friendlyImageError(error?: string): string {
    const message = error?.trim();
    if (!message || isSensitiveProviderMessage(message)) return IMAGE_ANALYSIS_UNAVAILABLE;
    return message;
}

function customerMessageForError(error: unknown): string {
    if (error instanceof GraceImageFlowError) return error.customerMessage;
    return IMAGE_ANALYSIS_UNAVAILABLE;
}

export function useGraceImageUpload() {
    const { appendInlineMessage } = useGrace();
    const [status, setStatus] = useState<UploadStatus>("idle");
    const [error, setError] = useState<string | null>(null);

    const uploadAndAnalyze = useCallback(
        async (file: File, opts?: { userText?: string }) => {
            setStatus("uploading");
            setError(null);
            try {
                // 1. Upload to Convex storage via /api/grace/upload
                const ownerKey = getAnonOwnerKey();
                const form = new FormData();
                form.append("file", file);
                form.append("ownerKey", ownerKey);
                form.append("kind", "reference");
                const upRes = await fetch("/api/grace/upload", {
                    method: "POST",
                    headers: { "x-grace-owner-key": ownerKey },
                    body: form,
                });
                const upData = (await upRes.json()) as GraceUploadResponse;
                if (!upRes.ok || !upData.url) {
                    throw new GraceImageFlowError(friendlyUploadError(upData.error));
                }
                const imageUrl = upData.url;

                // 2. Append user message immediately so the upload feels responsive
                const typedHint = opts?.userText?.trim();
                const userText = (typedHint ?? "Find bottles similar to this reference.").trim();
                appendInlineMessage({
                    role: "user",
                    content: userText,
                    attachments: [
                        {
                            id: `upload-${Date.now()}`,
                            name: file.name,
                            mime: file.type,
                            size: file.size,
                            url: imageUrl,
                            kind: "reference",
                        },
                    ],
                });

                // 3. Vision analysis — describe the image in catalog-relevant terms
                setStatus("analyzing");
                const visionRes = await fetch("/api/grace/vision", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "x-grace-owner-key": ownerKey },
                    body: JSON.stringify({ imageUrl, ownerKey }),
                });
                const visionData = (await visionRes.json()) as GraceVisionResponse;
                if (!visionRes.ok || !visionData.description) {
                    throw new GraceImageFlowError(friendlyImageError(visionData.error));
                }
                const description = visionData.description.trim();
                const searchTerms = [visionData.searchTerms ?? description, typedHint].filter(Boolean).join(" ").trim();

                // 4. Use the search terms to find matches in the catalog
                setStatus("searching");
                let searchFailed = false;
                let matches: ProductCard[] = [];
                try {
                    const searchRes = await fetch("/api/grace/tools", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "x-grace-owner-key": ownerKey },
                        body: JSON.stringify({
                            tool_name: "searchCatalog",
                            parameters: { searchTerm: searchTerms, familyLimit: null, categoryLimit: null, applicatorFilter: null, returnRaw: true },
                        }),
                    });
                    const searchData = (await searchRes.json()) as GraceSearchResponse;
                    if (searchRes.ok && Array.isArray(searchData.result)) {
                        matches = searchData.result.slice(0, 3);
                    } else {
                        searchFailed = true;
                    }
                } catch (searchError) {
                    console.warn("[Grace upload] Catalog search failed after image analysis:", searchError);
                    searchFailed = true;
                }

                // 5. Build Pattern H payload, append as Grace message with action
                const payload: ReferenceMatchPayload = {
                    referenceUrl: imageUrl,
                    description,
                    matches: matches.map((m) => ({
                        ...m,
                        heroImageUrl: null,
                        reasoning: "Matched on shape, capacity, and applicator.",
                    })),
                };
                appendInlineMessage({
                    role: "grace",
                    content: searchFailed
                        ? `I analyzed the reference — ${description}. I couldn't reach catalog search for matches yet.`
                        : matches.length > 0
                            ? `Closest matches based on what I see — ${description}`
                            : `Looked at your reference — ${description}. Nothing in the catalog is a confident match. Try a clearer photo or a closer crop.`,
                    action: { type: "displayReferenceMatch", payload },
                });

                setStatus("done");
            } catch (e) {
                console.error("[Grace upload] Error:", e);
                const customerMessage = customerMessageForError(e);
                setStatus("error");
                setError(customerMessage);
                appendInlineMessage({
                    role: "grace",
                    content: customerMessage,
                });
            }
        },
        [appendInlineMessage],
    );

    return { uploadAndAnalyze, status, error };
}
