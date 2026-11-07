import { NextRequest, NextResponse } from "next/server";
import { catalogHeroesForSkus } from "@/lib/products/catalog-heroes.server";

const MAX_SKUS = 50;

/**
 * Hero rows for explicit website SKUs, for client surfaces whose SKUs are not
 * known on the server (the Grace workspace cart). Read-only public data.
 */
export function GET(request: NextRequest) {
    const skus = request.nextUrl.searchParams.getAll("sku").map(sku => sku.trim()).filter(Boolean);
    if (skus.length === 0 || skus.length > MAX_SKUS) {
        return NextResponse.json({ error: `Pass 1 to ${MAX_SKUS} sku parameters` }, { status: 400 });
    }
    return NextResponse.json({ catalogHeroes: catalogHeroesForSkus(skus) }, {
        headers: { "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" },
    });
}
