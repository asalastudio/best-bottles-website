import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { enforceGraceRateLimit } from "@/lib/graceRateLimitServer";

/**
 * Grace AI file upload endpoint.
 *
 * Used by Pattern H (reference image match) and Pattern I (brand mockup
 * logo). Accepts multipart/form-data with `file`, `ownerKey`, and `kind`
 * (either "reference" or "logo"). Validates MIME and size, then writes to
 * Convex storage via the two-step generateUploadUrl + recordUpload flow.
 *
 * Returns: { id, blobId, url, mime, size }
 */

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED = new Set([
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
]);

function isValidOwnerKey(ownerKey: string): boolean {
    return /^(anon-[a-z0-9-]{8,}|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(ownerKey);
}

let _convex: ConvexHttpClient | null = null;
function getConvex() {
    if (!_convex) {
        const url = process.env.NEXT_PUBLIC_CONVEX_URL;
        if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL not set");
        _convex = new ConvexHttpClient(url);
    }
    return _convex;
}

export async function POST(req: NextRequest) {
    try {
        const rateLimited = await enforceGraceRateLimit(req, {
            route: "grace-upload",
            limit: 12,
            windowMs: 60 * 60_000,
        });
        if (rateLimited) return rateLimited;

        const form = await req.formData();
        const file = form.get("file");
        const ownerKey = (form.get("ownerKey") as string) ?? "";
        const kindRaw = (form.get("kind") as string) ?? "reference";
        const kind = (kindRaw === "logo" ? "logo" : "reference") as "logo" | "reference";

        if (!(file instanceof File)) {
            return NextResponse.json({ error: "Missing file" }, { status: 400 });
        }
        if (!ownerKey) {
            return NextResponse.json({ error: "Missing ownerKey" }, { status: 400 });
        }
        if (!isValidOwnerKey(ownerKey)) {
            return NextResponse.json({ error: "Invalid ownerKey" }, { status: 400 });
        }
        if (file.size > MAX_BYTES) {
            return NextResponse.json({ error: "File exceeds 8MB limit." }, { status: 413 });
        }
        if (!ACCEPTED.has(file.type.toLowerCase())) {
            return NextResponse.json({ error: `Unsupported MIME type: ${file.type}` }, { status: 415 });
        }

        const convex = getConvex();
        const writeToken = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
        if (!writeToken) {
            return NextResponse.json({ error: "Upload service is not configured." }, { status: 500 });
        }

        // Step 1 — get one-shot upload URL from Convex storage
        const uploadUrl = await convex.mutation(api.graceUploads.generateUploadUrl, { writeToken });

        // Step 2 — POST the file blob to that URL
        const upload = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": file.type },
            body: file,
        });
        if (!upload.ok) {
            return NextResponse.json({ error: "Storage upload failed." }, { status: 502 });
        }
        const { storageId } = await upload.json() as { storageId: string };

        // Step 3 — register the upload + get serving URL
        const record = await convex.mutation(api.graceUploads.recordUpload, {
            writeToken,
            blobId: storageId,
            mime: file.type,
            size: file.size,
            ownerKey,
            kind,
        });

        return NextResponse.json({
            id: record.id,
            blobId: storageId,
            url: record.url,
            mime: file.type,
            size: file.size,
        });
    } catch (err) {
        console.error("[Grace upload] Error:", err);
        return NextResponse.json(
            { error: "Upload failed. Please try again." },
            { status: 500 },
        );
    }
}
