#!/usr/bin/env tsx
/**
 * Replace one register body plate with an approved re-render (same geometry, new pixels).
 *
 *   npx tsx scripts/register/plates/push-plate.ts --body cylinder-9ml-17-415 --glass Clear --candidate clear            # dry run
 *   npx tsx scripts/register/plates/push-plate.ts --body cylinder-9ml-17-415 --glass Clear --candidate clear --apply    # upload + write dev, approved
 *
 * Reads output/register-plates/<body>/<glass>/final/<candidate>.png (fit_plate.py qa) and the anchors in
 * inputs/placement.json: the anchors and px/mm do not change, because the render was fitted and its alpha
 * locked to the plate's own outline. The row keeps the plate key, so every SKU of that glass draws the new
 * plate on its next page load. Dev only. Needs NEXT_PUBLIC_CONVEX_URL and BEST_BOTTLES_CONVEX_WRITE_TOKEN
 * (.env.local) and BLOB_READ_WRITE_TOKEN (the environment, .env.local or .env.blob.local — pull it with
 * `vercel env pull .env.blob.local --environment=development`).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { createBlobStore } from "../../paperdoll/lib/store-blob.mjs";

const ROOT = resolve(__dirname, "..", "..", "..");
config({ path: [resolve(ROOT, ".env.local"), resolve(ROOT, ".env.blob.local")], quiet: true });
const argv = process.argv.slice(2);
const arg = (name: string, fallback: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : fallback; };
const body = arg("body", "cylinder-9ml-17-415");
const glass = arg("glass", "Clear");
const candidate = arg("candidate", "");
const apply = argv.includes("--apply");
const slug = glass.toLowerCase().replace(/ /g, "-");
const BASE = resolve(ROOT, "output", "register-plates", body, slug);

async function main() {
    if (!candidate) throw new Error("--candidate <name> is required (a file in final/)");
    const url = process.env.NEXT_PUBLIC_CONVEX_URL, token = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
    if (!url || !token) throw new Error("NEXT_PUBLIC_CONVEX_URL and BEST_BOTTLES_CONVEX_WRITE_TOKEN are required");
    if (url.includes("precise-raccoon-123")) throw new Error("this loader writes dev only");
    const placement = JSON.parse(readFileSync(resolve(BASE, "inputs", "placement.json"), "utf8")) as { axisX: number; seatY: number; shoulderY: number | null; baselineY: number; pxPerMm: number; canvas: [number, number] };
    const qa = JSON.parse(readFileSync(resolve(BASE, "qa.json"), "utf8")) as { candidates: Record<string, { fitted: { iou: number; edgeP95Px: number; edgeMaxPx: number }; prompt: string | null }> };
    const verdict = qa.candidates[candidate];
    if (!verdict) throw new Error(`candidate ${candidate} has no qa.json entry; run fit_plate.py qa`);
    const bytes = readFileSync(resolve(BASE, "final", `${candidate}.png`));
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const [width, height] = placement.canvas;

    const client = new ConvexHttpClient(url);
    const current = await client.query(api.register.body, { bodyId: body });
    const plate = current?.plates.find((p) => p.glass === glass);
    if (!plate) throw new Error(`no ${glass} plate for ${body} on dev`);
    if (plate.image.width !== width || plate.image.height !== height) throw new Error(`canvas mismatch: dev plate is ${plate.image.width}x${plate.image.height}, final is ${width}x${height}`);
    console.log(`${plate.plateKey}: dev rev ${plate.revision} sha ${plate.image.sha256.slice(0, 12)} → ${candidate} sha ${sha256.slice(0, 12)} (${bytes.length} bytes), fitted IoU ${verdict.fitted.iou} p95 ${verdict.fitted.edgeP95Px}px`);

    const key = `register/plates/${body}/${slug}/${sha256}.png`;
    if (!apply) { console.log(`dry run: would upload ${key} and write the row approved. Add --apply.`); return; }
    if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN is not set. Run: vercel env pull .env.blob.local --environment=development");
    const store = createBlobStore();
    const { url: blobUrl } = await store.putObject(key, bytes, "image/png");
    const row = {
        plateKey: plate.plateKey, bodyId: body, glass,
        image: { url: blobUrl, key, sha256, bytes: bytes.length, width, height },
        thumb: null,
        pxPerMm: placement.pxPerMm,
        anchors: { axisX: placement.axisX, seatY: placement.seatY, baselineY: placement.baselineY, shoulderY: placement.shoulderY ?? null },
        anchorStatus: "approved" as const,
        anchorMeasuredBy: "scripts/register/plates/fit_plate.py",
        source: {
            library: "gpt-image-2.5-sunburst (enhanced; approved by Jordan)",
            path: plate.source.path,
            psdSha256: null,
            layer: `geometry: ${plate.plateKey} rev ${plate.revision} locked outline; material: ${glass}, candidate ${candidate}; baked on bone #F5F3EF`,
        },
        derivedFrom: plate.image.sha256,
        storageProvider: "vercel-blob" as const,
    };
    console.log("plates:", JSON.stringify(await client.mutation(api.register.upsertBodyPlates, { writeToken: token, rows: [row] })));
    console.log("counts:", JSON.stringify(await client.query(api.register.counts, {})));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
