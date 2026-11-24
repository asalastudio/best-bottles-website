import { NextResponse } from "next/server";
import { BUILDER_FAMILIES_CDN_CACHE, loadBuilderFamilies, loadBuilderFamilyPreviews } from "@/lib/bottle-builder/server";
import { collectDisplayDerivatives } from "@/lib/products/display-derivative.server";

/** The family screen's bottle groups for a page that opened on a bottle (a family,
 * product or collection link) and so did not stream them. Asked for once, when the
 * customer first opens the family screen; CDN-cached like the family list. */
export async function GET() {
    try {
        const families = await loadBuilderFamilyPreviews(await loadBuilderFamilies());
        return NextResponse.json({ families, displayDerivatives: collectDisplayDerivatives(families.flatMap(f => f.bodies)) }, {
            headers: { "Cache-Control": BUILDER_FAMILIES_CDN_CACHE },
        });
    } catch {
        return NextResponse.json({ error: "We couldn’t load the bottle previews." }, { status: 503 });
    }
}
