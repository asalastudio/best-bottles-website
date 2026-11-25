import { NextResponse } from "next/server";
import { BUILDER_FAMILIES_CDN_CACHE, loadBuilderFamilies, loadBuilderFamilyPreviews } from "@/lib/bottle-builder/server";

/** The family screen's sizes and option counts for a page that opened on a bottle (a family,
 * product or collection link) and so did not stream them. Asked for once, when the
 * customer first opens the family screen; CDN-cached like the family list. */
export async function GET() {
    try {
        const families = await loadBuilderFamilyPreviews(await loadBuilderFamilies());
        return NextResponse.json({ families }, {
            headers: { "Cache-Control": BUILDER_FAMILIES_CDN_CACHE },
        });
    } catch {
        return NextResponse.json({ error: "We couldn’t load the bottle families." }, { status: 503 });
    }
}
