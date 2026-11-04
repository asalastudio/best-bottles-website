import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import type { BuilderKit } from "@/lib/bottle-builder/model";
import { elegant15ReviewSku, ELEGANT15_MASTER_REVIEW_VERSION } from "@/lib/products/elegant15-master";

/** Use the same local recipes as the Elegant product pages, without publishing the pilot. */
export async function GET(request: Request) {
    const url = new URL(request.url);
    if (process.env.NODE_ENV !== "development" || process.env.VERCEL
        || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (url.searchParams.has("v") && url.searchParams.get("v") !== ELEGANT15_MASTER_REVIEW_VERSION) {
        return NextResponse.json({ error: "Unknown master version" }, { status: 404 });
    }
    const sku = elegant15ReviewSku(url.searchParams.get("sku"));
    if (!sku) return NextResponse.json({ error: "Not found" }, { status: 404 });
    try {
        const review = JSON.parse(readFileSync("public/local-kits/remaining-13-415-2026-11-01/kits.json", "utf8")) as
            { version: string; rows: Record<string, BuilderKit> };
        // The 13-415 batch is frozen; SKUs it never covered are added beside it.
        const additions = JSON.parse(readFileSync("public/local-kits/elegant15-additions-2026-11-03/kits.json", "utf8")) as
            { rows: Record<string, BuilderKit> };
        const kit = review.version === ELEGANT15_MASTER_REVIEW_VERSION ? review.rows[sku] ?? additions.rows[sku] : null;
        if (!kit || kit.sku !== sku || kit.register?.bodyId !== "elegant-15ml-13-415") {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        return NextResponse.json({ kit, version: review.version }, { headers: { "Cache-Control": "private, no-store" } });
    } catch {
        return NextResponse.json({ error: "Master unavailable" }, { status: 503 });
    }
}
