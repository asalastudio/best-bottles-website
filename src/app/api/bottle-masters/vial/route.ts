import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import type { BuilderKit } from "@/lib/bottle-builder/model";
import { vialReviewSku, VIAL_MASTER_REVIEW_VERSION } from "@/lib/products/vial-master";

/** Reviewed candidates use exact source assemblies and remain localhost-only. */
export async function GET(request: Request) {
    const url = new URL(request.url);
    if (process.env.NODE_ENV !== "development" || process.env.VERCEL
        || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (url.searchParams.has("v") && url.searchParams.get("v") !== VIAL_MASTER_REVIEW_VERSION) {
        return NextResponse.json({ error: "Unknown master version" }, { status: 404 });
    }
    const sku = vialReviewSku(url.searchParams.get("sku"));
    if (!sku) return NextResponse.json({ error: "Not found" }, { status: 404 });
    try {
        const review = JSON.parse(readFileSync("public/local-kits/vial-masters-2026-11-03/kits.json", "utf8")) as
            { version: string; rows: Record<string, BuilderKit> };
        if (review.version !== VIAL_MASTER_REVIEW_VERSION) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const capped = /^GBV(?:Amb|Blu|Gr)?1Drm(?:Black|Wht)CapSht$/.test(sku);
        const kit = capped
            ? (JSON.parse(readFileSync("public/local-kits/vial-4ml-measured-2026-10-31/kits.json", "utf8")) as { rows: Record<string, BuilderKit> }).rows[sku]
            : review.rows[sku];
        if (!kit || kit.sku !== sku) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json({ kit, version: review.version }, { headers: { "Cache-Control": "private, no-store" } });
    } catch {
        return NextResponse.json({ error: "Master unavailable" }, { status: 503 });
    }
}
