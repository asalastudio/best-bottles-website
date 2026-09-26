import { NextResponse } from "next/server";
import { loadBuilderBodyKits, loadBuilderFamilies, loadBuilderFamily } from "@/lib/bottle-builder/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CONCURRENCY = 4;

/** Keeps the builder's data cache warm, so no visitor lands on the cold path
 * (1.3–4.2 s assembling a family from Convex; 0.3–1.4 s for a bottle's kits).
 * Vercel Cron calls this hourly (vercel.json) with `Authorization: Bearer
 * $CRON_SECRET` — set on Production since 2026-09-25.
 *
 * Reads only. A fresh entry is a no-op, a stale one is refreshed in the
 * background (unstable_cache is stale-while-revalidate; Vercel keeps the
 * function alive until those writes land), a missing one — a new deployment's
 * key, or an eviction — is built here. The route used to call
 * revalidateTag("bottle-components") first; Next applies a tag at the end of
 * the request, so every entry this run wrote was born stale, and every read in
 * the run bypassed the cache and rebuilt every family from Convex. Kit
 * layers are warmed too: they are the first request a visitor waits on after
 * picking a bottle. */
export async function GET(request: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
        return new NextResponse("Unauthorized", { status: 401 });
    }
    const started = Date.now();
    const families = await loadBuilderFamilies();
    const warmed: Record<string, { ms: number; bodies: number }> = {};
    const failed: string[] = [];
    await pool(families.map(({ family }) => async () => {
        const at = Date.now();
        try {
            const bodies = await loadBuilderFamily(family);
            await pool(bodies.map(body => () => loadBuilderBodyKits(family, body.id)), 2);
            warmed[family] = { ms: Date.now() - at, bodies: bodies.length };
        } catch {
            failed.push(family);
        }
    }), CONCURRENCY);
    // A failed family shows as a 500 in the cron log instead of a quiet 200.
    return NextResponse.json({ ok: failed.length === 0, ms: Date.now() - started, warmed, failed }, { status: failed.length ? 500 : 200 });
}

async function pool(tasks: Array<() => Promise<unknown>>, size: number) {
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(size, tasks.length) }, async () => {
        while (next < tasks.length) await tasks[next++]();
    }));
}
