import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import type { BuilderKit } from "@/lib/bottle-builder/model";
import { cylinder9MasterSku, CYLINDER9_MASTER_VERSION } from "@/lib/products/cylinder9-master";
import { approvedComponentKit, APPROVED_KIT_VERSION } from "@/lib/paper-doll/approved-component-kits";

// Immutable versioned review file. Read once, avoiding the unrelated local-kit
// inventories on every catalog tile request. No remote data or writes.
let review: { version: string; rows: Record<string, BuilderKit> } | undefined;
export async function GET(request: Request) {
    const url = new URL(request.url);
    if (process.env.NODE_ENV !== "development" || process.env.VERCEL
        || !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(url.host)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const sku = cylinder9MasterSku(url.searchParams.get("sku"));
    if (!sku) return NextResponse.json({ error: "Not found" }, { status: 404 });
    try {
        review ??= JSON.parse(readFileSync("public/local-kits/cylinder9-masters-2026-11-01/kits.json", "utf8"));
        const currentLotion = /^LBCyl.*9Ltn/.test(sku) ? approvedComponentKit(sku) : null;
        const kit = currentLotion ?? (review?.version === CYLINDER9_MASTER_VERSION ? review.rows[sku] : null);
        if (!kit || kit.sku !== sku) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json({ kit, version: currentLotion ? APPROVED_KIT_VERSION : CYLINDER9_MASTER_VERSION },
            { headers: { "Cache-Control": "private, no-store" } });
    } catch {
        return NextResponse.json({ error: "Master unavailable" }, { status: 503 });
    }
}
