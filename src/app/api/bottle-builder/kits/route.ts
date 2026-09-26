import { NextResponse } from "next/server";
import { BUILDER_CDN_CACHE, loadBuilderBodyKits } from "@/lib/bottle-builder/server";

export async function GET(request: Request) {
    const url = new URL(request.url);
    const family = url.searchParams.get("family") ?? "";
    const bodyId = url.searchParams.get("bodyId") ?? "";
    if (!family || family.length > 100 || !bodyId || bodyId.length > 200) {
        return NextResponse.json({ error: "Choose a bottle to load its finishes." }, { status: 400 });
    }
    try {
        return NextResponse.json({ kits: await loadBuilderBodyKits(family, bodyId) }, {
            headers: { "Cache-Control": BUILDER_CDN_CACHE },
        });
    } catch {
        return NextResponse.json({ error: "We couldn’t load this bottle’s imagery. Please try again." }, { status: 503 });
    }
}
