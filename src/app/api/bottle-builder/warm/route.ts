import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { loadBuilderFamilies, loadBuilderFamily } from "@/lib/bottle-builder/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Keeps every family's builder cache warm, so no visitor lands on the cold
 * path (1.3–4.2 s assembling a family from Convex; 4 s on staging, measured
 * 2026-09-24). Vercel Cron calls this hourly (vercel.json) with
 * `Authorization: Bearer $CRON_SECRET`. Expire, then rebuild in the same
 * request: each run leaves a fresh entry for every family, not only the ones
 * a visitor already paid for. */
export async function GET(request: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
        return new NextResponse("Unauthorized", { status: 401 });
    }
    const started = Date.now();
    revalidateTag("bottle-components", "max");
    const families = await loadBuilderFamilies();
    const warmed: Record<string, number> = {};
    for (const { family } of families) {
        const at = Date.now();
        await loadBuilderFamily(family);
        warmed[family] = Date.now() - at;
    }
    return NextResponse.json({ ok: true, ms: Date.now() - started, warmed });
}
