import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import type { BuilderKit } from "@/lib/bottle-builder/model";
import { elegant60100ReviewSku, ELEGANT60_100_MASTER_REVIEW_VERSION } from "@/lib/products/elegant60-100-master";

/** Reviewed candidates use exact source assemblies and remain localhost-only. */
export async function GET(request: Request) {
    const url = new URL(request.url);
    if (process.env.NODE_ENV !== "development" || process.env.VERCEL
        || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (url.searchParams.has("v") && url.searchParams.get("v") !== ELEGANT60_100_MASTER_REVIEW_VERSION) {
        return NextResponse.json({ error: "Unknown master version" }, { status: 404 });
    }
    const sku = elegant60100ReviewSku(url.searchParams.get("sku"));
    if (!sku) return NextResponse.json({ error: "Not found" }, { status: 404 });
    try {
        const review = JSON.parse(readFileSync("public/local-kits/elegant60-100-masters-2026-11-03/kits.json", "utf8")) as
            { version: string; rows: Record<string, BuilderKit> };
        const kit = review.version === ELEGANT60_100_MASTER_REVIEW_VERSION ? review.rows[sku] : null;
        if (!kit || kit.sku !== sku) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json({ kit, version: review.version }, { headers: { "Cache-Control": "private, no-store" } });
    } catch {
        return NextResponse.json({ error: "Master unavailable" }, { status: 503 });
    }
}
