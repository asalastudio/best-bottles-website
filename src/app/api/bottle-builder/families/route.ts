import { NextResponse } from "next/server";
import { BUILDER_FAMILIES_CDN_CACHE, loadBuilderFamilies } from "@/lib/bottle-builder/server";

/** The /matrix page streams this list into its own response; this route is the
 * client's fallback when that stream failed, and it no longer costs a function
 * call per visitor (it answered `max-age=0, must-revalidate` and missed the CDN
 * every time, 2.8 s on a cold function, 2026-09-26). */
export async function GET() {
    try {
        return NextResponse.json({ families: await loadBuilderFamilies() }, {
            headers: { "Cache-Control": BUILDER_FAMILIES_CDN_CACHE },
        });
    } catch {
        return NextResponse.json({ error: "We couldn’t load the other bottle families. Please try again." }, { status: 503 });
    }
}
