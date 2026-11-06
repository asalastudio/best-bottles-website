import { readFileSync } from "node:fs";
import { NextResponse } from "next/server";
import type { BuilderKit } from "@/lib/bottle-builder/model";
import { pillarReviewSku, PILLAR_MASTER_VERSION } from "@/lib/products/pillar-master";

export async function GET(request: Request) {
    const url = new URL(request.url);
    const sku = pillarReviewSku(url.searchParams.get("sku"));
    const version = url.searchParams.get("v");
    if (!sku || process.env.VERCEL || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
        || (version && version !== PILLAR_MASTER_VERSION)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const directory = sku.startsWith("GBPillar9Spry") ? "pillar-masters" : "pillar-caps";
    try {
        const { rows } = JSON.parse(readFileSync(`public/local-kits/${directory}-2026-11-04/kits.json`, "utf8")) as
            { rows: Record<string, BuilderKit> };
        const kit = rows[sku];
        if (!kit) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json({ kit, version: PILLAR_MASTER_VERSION }, { headers: { "Cache-Control": "private, no-store" } });
    } catch {
        return NextResponse.json({ error: "Master unavailable" }, { status: 503 });
    }
}
