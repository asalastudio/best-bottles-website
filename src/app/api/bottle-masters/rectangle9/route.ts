import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { rectangleApplicatorReviewSku, RECTANGLE_APPLICATOR_REVIEW_VERSION } from "@/lib/products/rectangle-applicator";
import type { BuilderKit } from "@/lib/bottle-builder/model";

/** Image candidates stay local until the exact masters are visually approved. */
export async function GET(request: Request) {
    const url = new URL(request.url);
    if (process.env.NODE_ENV !== "development" || process.env.VERCEL
        || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const sku = rectangleApplicatorReviewSku(url.searchParams.get("sku"));
    if (!sku) return NextResponse.json({ error: "Not found" }, { status: 404 });
    try {
        const review = JSON.parse(readFileSync("public/local-kits/rectangle9-applicator-2026-11-01/kits.json", "utf8")) as
            { version: string; rows: Record<string, BuilderKit> };
        const kit = review.version === RECTANGLE_APPLICATOR_REVIEW_VERSION ? review.rows[sku] : null;
        if (!kit || kit.sku !== sku) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json({ kit, version: review.version }, { headers: { "Cache-Control": "private, no-store" } });
    } catch {
        return NextResponse.json({ error: "Master unavailable" }, { status: 503 });
    }
}
