#!/usr/bin/env tsx
/**
 * Phase 4, step 1: the legacy side of the parity gate.
 *
 *   npx tsx scripts/register/phase4/fetch-legacy-kits.ts
 *
 * Reads the pilot assemblies from data/register/assemblies.csv, fetches each
 * SKU's published productKits row from the dev deployment (public query, read
 * only), and saves the kit views plus every part image under
 * output/register-phase4/legacy/ (gitignored). Downloads are sequential with
 * retries: the Blob host's DNS fails under parallel load on this machine.
 * Re-runs skip files that already exist.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { pilotAssemblies, PILOT_BODY_ID } from "./pilot";

const ROOT = resolve(__dirname, "..", "..", "..");
const OUT = resolve(ROOT, "output", "register-phase4", "legacy");
config({ path: resolve(ROOT, ".env.local"), quiet: true });

type KitView = NonNullable<Awaited<ReturnType<ConvexHttpClient["query"]>>>;

async function fetchWithRetry(url: string, attempts = 4): Promise<Buffer> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return Buffer.from(await response.arrayBuffer());
        } catch (error) {
            lastError = error;
            await new Promise((done) => setTimeout(done, 500 * attempt));
        }
    }
    throw lastError;
}

async function main() {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is required (.env.local)");
    const client = new ConvexHttpClient(url);
    const rows = pilotAssemblies();
    console.log(`${rows.length} pilot assemblies (${PILOT_BODY_ID}) from the register; reading kits from ${url}`);

    mkdirSync(resolve(OUT, "parts"), { recursive: true });
    const kits: Record<string, KitView | null> = {};
    for (let start = 0; start < rows.length; start += 50) {
        const batch = rows.slice(start, start + 50);
        const found = await client.query(api.productKits.forSkus, {
            pairs: batch.map((row) => ({ graceSku: row.graceSku, websiteSku: row.websiteSku || null })),
        });
        for (const row of batch) {
            const key = row.websiteSku || row.graceSku;
            kits[row.graceSku] = (found as Record<string, KitView | null>)[key] ?? null;
        }
    }

    let downloaded = 0, reused = 0, failed = 0;
    const frames = new Map<string, number>();
    for (const [graceSku, kit] of Object.entries(kits)) {
        if (!kit) continue;
        const view = kit as unknown as { canvas: { width: number; height: number }; anchors: { axisX: number; seatY: number; baselineY: number }; parts: { slot: string; image: { url: string; sha256: string } }[] };
        const frameKey = `${view.canvas.width}x${view.canvas.height}@${view.anchors.axisX},${view.anchors.seatY},${view.anchors.baselineY}`;
        frames.set(frameKey, (frames.get(frameKey) ?? 0) + 1);
        for (const part of view.parts) {
            const ext = part.image.url.split("?")[0].split(".").pop() ?? "webp";
            const file = resolve(OUT, "parts", `${part.image.sha256}.${ext}`);
            if (existsSync(file)) { reused++; continue; }
            try {
                const bytes = await fetchWithRetry(part.image.url);
                const sha = createHash("sha256").update(bytes).digest("hex");
                if (sha !== part.image.sha256) throw new Error(`sha mismatch for ${graceSku} ${part.slot}: ${sha}`);
                writeFileSync(file, bytes);
                downloaded++;
            } catch (error) {
                failed++;
                console.error(`  ${graceSku} ${part.slot}: ${error instanceof Error ? error.message : error}`);
            }
        }
    }
    writeFileSync(resolve(OUT, "kits.json"), JSON.stringify({ fetchedAt: new Date().toISOString(), deployment: url, kits }, null, 1));
    const withKit = Object.values(kits).filter(Boolean).length;
    console.log(`kits: ${withKit} of ${rows.length} pilot SKUs have a published kit; ${rows.length - withKit} without`);
    console.log(`parts: ${downloaded} downloaded, ${reused} already present, ${failed} failed`);
    console.log("kit frames (canvas@axis,seat,foot → count):");
    for (const [key, count] of [...frames.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${key} → ${count}`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
