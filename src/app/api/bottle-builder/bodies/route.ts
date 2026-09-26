import { NextResponse } from "next/server";
import { BUILDER_CDN_CACHE, loadBuilderFamily } from "@/lib/bottle-builder/server";
import { builderCollectionBodies, BUILDER_COLLECTION_FITMENTS } from "@/lib/bottle-builder/collection-context";

/** The chosen bottle's full configurations (kit-less, as the family cache holds
 * them). First paint only carries one configuration per glass colour. */
export async function GET(request: Request) {
    const url = new URL(request.url);
    const family = url.searchParams.get("family") ?? "";
    const bodyId = url.searchParams.get("bodyId") ?? "";
    const shop = url.searchParams.get("shop") ?? "";
    if (!family || family.length > 100 || !bodyId || bodyId.length > 200 || shop.length > 100) {
        return NextResponse.json({ error: "Choose a bottle to load its options." }, { status: 400 });
    }
    try {
        const body = (await loadBuilderFamily(family)).find(item => item.id === bodyId);
        if (!body) return NextResponse.json({ error: "This bottle is no longer available." }, { status: 404 });
        const [scoped] = builderCollectionBodies([body], shop && BUILDER_COLLECTION_FITMENTS[shop] ? shop : undefined);
        return NextResponse.json({ configurations: scoped?.configurations ?? [] }, {
            headers: { "Cache-Control": BUILDER_CDN_CACHE },
        });
    } catch {
        return NextResponse.json({ error: "We couldn’t load this bottle’s options. Please try again." }, { status: 503 });
    }
}
