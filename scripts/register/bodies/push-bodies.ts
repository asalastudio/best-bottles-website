#!/usr/bin/env tsx
/**
 * Load the catalogue Sunburst bodies into registerBodyPlates (dev only).
 *
 *   npx tsx scripts/register/bodies/push-bodies.ts                    # dry run
 *   npx tsx scripts/register/bodies/push-bodies.ts --apply            # upload + write as "measured"
 *   npx tsx scripts/register/bodies/push-bodies.ts --apply --approve [--except plateKey,...]
 *
 * Reads data/register/bodies/bodies-measurements.json and output/register-bodies/final/. Only plates with
 * status "ok" are approvable; "review" plates and plates whose two scales disagree by more than 5% load as
 * "measured" until they are ruled on. The pilot body (cylinder-9ml-17-415) is owned by push-phase3.ts and
 * skipped here. Blob keys are content-addressed and write-once. Token from .env.local / .env.blob.local.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { createBlobStore } from "../../paperdoll/lib/store-blob.mjs";

const ROOT = resolve(__dirname, "..", "..", "..");
const BASE = resolve(ROOT, "output", "register-bodies");
config({ path: [resolve(ROOT, ".env.local"), resolve(ROOT, ".env.blob.local")], quiet: true });
const argv = process.argv.slice(2);
const apply = argv.includes("--apply"), approve = argv.includes("--approve");
const except = new Set(argv.includes("--except") ? argv[argv.indexOf("--except") + 1].split(",").map(s => s.trim()) : []);
const PILOT = "cylinder-9ml-17-415";

type Plate = {
    plateKey: string; bodyId: string; glass: string; status: string; file: string; width: number; height: number; sha256: string; pxPerMm: number;
    anchors: { axisX: number; seatY: number; shoulderY: number; baselineY: number };
    scale: { flag: boolean; basis: string; gapPct: number | null };
    source: { masterGlass: string; role: string; cut: string; psd: string | null; derivedFrom: string | null };
    bakedOnBone: { bone: string } | null;
};

async function main() {
    const plates = (JSON.parse(readFileSync(resolve(ROOT, "data", "register", "bodies", "bodies-measurements.json"), "utf8")) as Plate[])
        .filter(p => p.file && p.bodyId !== PILOT);
    const url = process.env.NEXT_PUBLIC_CONVEX_URL, token = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
    if (!url || !token) throw new Error("NEXT_PUBLIC_CONVEX_URL and BEST_BOTTLES_CONVEX_WRITE_TOKEN are required");
    if (url.includes("precise-raccoon-123")) throw new Error("this loader writes dev only");
    if (apply && !process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN is not set (.env.blob.local)");
    const store = apply ? createBlobStore() : null;
    const rows = [];
    const tally: Record<string, number> = {};
    for (const p of plates) {
        const approvable = p.status === "ok" && !p.scale.flag;
        const status = approve && approvable && !except.has(p.plateKey) ? "approved" : "measured";
        tally[status] = (tally[status] ?? 0) + 1;
        const key = `register/plates/${p.bodyId}/${p.glass.toLowerCase().replace(/ /g, "-")}/${p.sha256}.png`;
        const bytes = readFileSync(resolve(BASE, p.file));
        const { url: blobUrl } = store ? await store.putObject(key, bytes, "image/png") : { url: `(dry run) ${key}` };
        rows.push({
            plateKey: p.plateKey, bodyId: p.bodyId, glass: p.glass,
            image: { url: blobUrl, key, sha256: p.sha256, bytes: bytes.length, width: p.width, height: p.height }, thumb: null,
            pxPerMm: p.pxPerMm, anchors: { axisX: p.anchors.axisX, seatY: p.anchors.seatY, baselineY: p.anchors.baselineY, shoulderY: p.anchors.shoulderY },
            anchorStatus: status as "approved" | "measured", anchorMeasuredBy: "scripts/register/bodies/build_bodies.py",
            source: { library: "gpt-image-2.5-sunburst", path: p.source.psd ?? p.source.cut, psdSha256: null,
                      layer: `geometry: ${p.source.masterGlass}; material: ${p.source.role}${p.bakedOnBone ? "; baked on bone " + p.bakedOnBone.bone : ""}` },
            derivedFrom: p.source.derivedFrom, storageProvider: "vercel-blob" as const,
        });
    }
    console.log(`${rows.length} plates: ${JSON.stringify(tally)}${apply ? "" : " (dry run: nothing uploaded or written)"}`);
    if (!apply) return;
    const client = new ConvexHttpClient(url);
    const outcomes: Record<string, number> = {};
    for (let i = 0; i < rows.length; i += 25) {
        const res = await client.mutation(api.register.upsertBodyPlates, { writeToken: token, rows: rows.slice(i, i + 25) });
        for (const r of res) { outcomes[r.outcome] = (outcomes[r.outcome] ?? 0) + 1; if (r.outcome === "error") console.log(`  ${r.key}: ${r.error}`); }
    }
    console.log("upserts:", JSON.stringify(outcomes));
    console.log("counts:", JSON.stringify(await client.query(api.register.counts, {})));
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
