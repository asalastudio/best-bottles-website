#!/usr/bin/env node
// Publish the kit layer fixes built by scripts/paperdoll/kit_layer_fixes.py: upload every new layer to
// Blob (content-addressed, never overwriting the old object) and upsert the rows. Dry run by default.
// Dev deployment from .env.local; --prod targets production and is only for after Jordan's sign-off.
//
//   node scripts/paperdoll/publish-kit-fixes.mjs [--apply] [--prod] [--only sku,sku] [--fix overcapPatch,...] [--family cylinder-]
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";
import { createBlobStore, verifyPublicUrl } from "./lib/store-blob.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
for (const file of [".env.local", ".env.blob.local"]) {
    try {
        for (const line of (await readFile(resolve(ROOT, file), "utf8")).split("\n")) {
            const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
            if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, "");
        }
    } catch {}
}
const args = process.argv.slice(2); const value = k => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const apply = args.includes("--apply"), prod = args.includes("--prod");
const only = value("--only")?.split(",").filter(Boolean); const fixFilter = value("--fix")?.split(",").filter(Boolean); const familyPrefix = value("--family");
const PROD_URL = "https://precise-raccoon-123.convex.cloud";
const url = prod ? PROD_URL : process.env.NEXT_PUBLIC_CONVEX_URL;
if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL missing");
if (prod && !/precise-raccoon/.test(url)) throw new Error("prod URL mismatch");
const OUT = resolve(ROOT, "output/kit-fixes");
const target = prod ? "prod" : "dev";               // fixes built from this deployment's own dump
const manifest = JSON.parse(await readFile(resolve(OUT, `manifest-${target}.json`), "utf8"));
const dump = new Map((await readFile(resolve(OUT, `kits-${target}.jsonl`), "utf8")).split("\n").filter(l => l.startsWith("{")).map(l => JSON.parse(l)).map(r => [r.sku, r]));
const convex = new ConvexHttpClient(url);
// every layer this lane has published so far (dev and prod ledgers): a live row made only of dump layers
// and lane layers is ours to rewrite; anything else means another lane touched it since the dump
const laneShas = new Set();
for (const suffix of ["-dev", "-prod"]) {
    try {
        const ledger = JSON.parse(await readFile(resolve(ROOT, `data/asset-ledger/kit-layer-fixes-2026-09-25${suffix}.json`), "utf8"));
        for (const run of Array.isArray(ledger) ? ledger : [ledger]) for (const k of run.kits) for (const p of k.parts) laneShas.add(p.sha256);
    } catch {}
}

let skus = Object.keys(manifest.kits).filter(s => !only || only.includes(s)).filter(s => !fixFilter || manifest.kits[s].fixes.some(f => fixFilter.includes(f)))
    .filter(s => !familyPrefix || (dump.get(s)?.familyId ?? "").startsWith(familyPrefix));
const plan = [], skipped = [];
for (const sku of skus) {
    const entry = manifest.kits[sku];
    const source = dump.get(sku);
    if (!source) { console.error(`${sku}: not in kits-${target}.jsonl`); process.exit(1); }
    // the row we replace must still be the row we built from: every live layer is either from the dump
    // this lane built on or a layer this lane published. Anything else is skipped and reported, never
    // overwritten (production rows were promoted at other times and can differ from dev).
    const live = await convex.query(api.productKits.forSku, { websiteSku: source.websiteSku, graceSku: source.graceSku });
    if (!live) { skipped.push({ sku, why: "no live kit" }); continue; }
    const known = new Set([...source.parts.map(p => p.image.sha256), ...laneShas]);
    const foreign = (live.parts ?? []).map(p => p.image.sha256).filter(sha => !known.has(sha));
    if (foreign.length) { skipped.push({ sku, why: `live layers this lane does not know: ${foreign.map(s => s.slice(0, 8)).join(", ")}` }); continue; }
    const liveShas = (live.parts ?? []).map(p => p.image.sha256).sort().join(",");
    const wantShas = entry.parts.map(p => p.image.sha256).sort().join(",");
    if (liveShas === wantShas) continue;                       // already published exactly this
    plan.push({ sku, entry, source });
}
if (skipped.length) {
    console.log(`skipped ${skipped.length} rows (left untouched on ${url}):`);
    for (const s of skipped) console.log(`  ${s.sku}: ${s.why}`);
}
const uploads = new Map();
for (const { entry } of plan) for (const p of entry.parts) if (p.image.file && !uploads.has(p.image.sha256)) uploads.set(p.image.sha256, p);
console.log(`${apply ? "APPLY" : "DRY RUN"} → ${url}: ${plan.length} kits, ${uploads.size} new layer files`);
for (const { sku, entry } of plan) console.log(`  ${sku}: ${entry.fixes.join("+")} → ${entry.parts.map(p => `${p.slot}${p.image.file ? "*" : ""}`).join(" ")}`);
if (!apply) process.exit(0);

const store = createBlobStore();
const blobBase = [...dump.values()][0].parts[0].image.url.split("/kits/")[0];
for (const [sha, p] of uploads) {
    const bytes = await readFile(resolve(OUT, p.image.file));
    const key = `kits/cylinder-master/${sha}.${p.slot}.webp`;
    const expected = { expectedBytes: bytes.length, expectedContentType: "image/webp" };
    const existing = await verifyPublicUrl(`${blobBase}/${key}`, expected).catch(() => ({ ok: false }));
    let url = `${blobBase}/${key}`;
    if (existing.ok) {
        console.log(`exists   ${key}`);
    } else {
        const put = await store.putObject(key, bytes, "image/webp");
        // a fresh object can 404 for a moment behind the CDN: give it a few seconds before calling it a failure
        let verdict = await verifyPublicUrl(put.url, expected);
        for (let attempt = 0; !verdict.ok && attempt < 6; attempt++) {
            await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
            verdict = await verifyPublicUrl(put.url, expected);
        }
        if (!verdict.ok) { console.error(sha, verdict.problems); process.exit(1); }
        url = put.url;
        console.log(`uploaded ${key}`);
    }
    p.image.url = url; p.image.key = key;
}
const rows = plan.map(({ sku, entry, source }) => {
    const { _id, _creationTime, importedAt, revision, updatedAt, conflicts, ...rest } = source;
    const PART_KEYS = ["slot", "variantKey", "zOrder", "explodeIndex", "bounds", "assembled", "exploded", "image", "image2x", "mask", "derivation"];
    const parts = entry.parts.map(p => {
        const image = p.image.file ? (uploads.get(p.image.sha256) ?? p).image : p.image;
        const { file, ...asset } = image;
        return Object.fromEntries(PART_KEYS.map(k => [k, k === "image" ? asset : p[k]]));
    });
    return { ...rest, parts, builder: { name: "kit-layer-fixes-2026-09-25", version: "1.0.0", builtAt: Date.now() }, storageProvider: "vercel-blob" };
});
const outcomes = [];
for (let i = 0; i < rows.length; i += 50) {
    outcomes.push(...await convex.mutation(api.productKits.upsertMany, { writeToken: process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN, rows: rows.slice(i, i + 50) }));
}
await mkdir(resolve(ROOT, "data/asset-ledger"), { recursive: true });
const log = resolve(ROOT, `data/asset-ledger/kit-layer-fixes-2026-09-25${prod ? "-prod" : "-dev"}.json`);
const run = { appliedAt: new Date().toISOString(), deployment: url, kits: plan.map(p => ({ sku: p.sku, fixes: p.entry.fixes, parts: p.entry.parts.map(q => ({ slot: q.slot, sha256: q.image.sha256, donor: q.donor ?? null })) })), outcomes };
let runs = [];
try { const prior = JSON.parse(await readFile(log, "utf8")); runs = Array.isArray(prior) ? prior : [prior]; } catch {}
await writeFile(log, JSON.stringify([...runs, run], null, 1) + "\n");
console.log(outcomes.map(o => `${o.sku}: ${o.outcome}${o.error ? ` (${o.error})` : ""}`).join("\n"));
