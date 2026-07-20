#!/usr/bin/env node
/**
 * Push Madison scene-lane hero/lifestyle renders into Sanity as
 * marketingHeroAsset documents (2026-07-20).
 *
 * This is the ONLY publish path for marketing heroes. It writes exclusively
 * to Sanity — never Convex products, never Shopify media, never the Madison
 * pipeline sku-jobs chain — so marketing assets cannot pollute PDP truth.
 *
 * Manifest (JSON array):
 *   [{ "groupSlug": "cylinder-9ml-clear-17-415-rollon",
 *      "kind": "thumbnail" | "blog" | "social" | "campaign" | "other",
 *      "imageUrl": "https://<madison supabase render url>.png",
 *      "title": "Cylinder 9ml — river stones hero",
 *      "generator": "nano-banana-pro",           // optional
 *      "notes": "spring campaign, stone props"    // optional
 *   }, ...]
 *
 * Usage:
 *   node scripts/push-sanity-marketing-heroes.mjs --manifest heroes.json           # dry run
 *   node scripts/push-sanity-marketing-heroes.mjs --manifest heroes.json --apply
 *
 * Env: NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET (from
 * .env.local), SANITY_API_WRITE_TOKEN (write token — NOT committed).
 * Docs are upserted with deterministic ids marketingHeroAsset-{groupSlug}-{kind}
 * so re-pushing the same slot replaces the asset instead of duplicating it.
 */
import { readFileSync, existsSync } from "node:fs";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const manifestIdx = args.indexOf("--manifest");
if (manifestIdx === -1 || !args[manifestIdx + 1]) {
    console.error("Required: --manifest <file.json> [--apply]");
    process.exit(1);
}
const manifestPath = args[manifestIdx + 1];

// Load .env.local for project/dataset (token must come from real env or .env.local)
if (existsSync(".env.local")) {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
        const m = line.match(/^([A-Z_]+)=(.*)$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
}
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const token = process.env.SANITY_API_WRITE_TOKEN;
if (!projectId) { console.error("Missing NEXT_PUBLIC_SANITY_PROJECT_ID"); process.exit(1); }
if (!token && apply) { console.error("Missing SANITY_API_WRITE_TOKEN (required for --apply)"); process.exit(1); }

const VALID_KINDS = new Set(["thumbnail", "blog", "social", "campaign", "other"]);
const entries = JSON.parse(readFileSync(manifestPath, "utf8"));
if (!Array.isArray(entries) || entries.length === 0) {
    console.error("Manifest must be a non-empty JSON array.");
    process.exit(1);
}

// Validate everything before touching the network.
const problems = [];
for (const [i, e] of entries.entries()) {
    if (!e.groupSlug) problems.push(`[${i}] missing groupSlug`);
    if (!VALID_KINDS.has(e.kind)) problems.push(`[${i}] invalid kind "${e.kind}"`);
    if (!/^https:\/\//.test(e.imageUrl ?? "")) problems.push(`[${i}] imageUrl must be https`);
    if (!e.title) problems.push(`[${i}] missing title`);
}
const slotSeen = new Set();
for (const e of entries) {
    const slot = `${e.groupSlug}::${e.kind}`;
    if (slotSeen.has(slot)) problems.push(`duplicate slot in manifest: ${slot}`);
    slotSeen.add(slot);
}
if (problems.length) {
    console.error("Manifest problems — nothing pushed:");
    for (const p of problems) console.error("  " + p);
    process.exit(1);
}

const apiBase = `https://${projectId}.api.sanity.io/v2024-01-01`;

async function uploadImageAsset(imageUrl) {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`fetch render failed ${imgRes.status}: ${imageUrl}`);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const upRes = await fetch(`${apiBase}/assets/images/${dataset}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/png" },
        body: buf,
    });
    if (!upRes.ok) throw new Error(`asset upload failed ${upRes.status}: ${await upRes.text()}`);
    const json = await upRes.json();
    return json.document._id;
}

async function mutate(mutations) {
    const res = await fetch(`${apiBase}/data/mutate/${dataset}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ mutations }),
    });
    if (!res.ok) throw new Error(`mutate failed ${res.status}: ${await res.text()}`);
    return res.json();
}

const docId = (e) => `marketingHeroAsset-${e.groupSlug}-${e.kind}`;

console.log(`${apply ? "APPLY" : "DRY RUN"} — ${entries.length} hero asset(s) → ${projectId}/${dataset}`);
let pushed = 0, failed = 0;
for (const e of entries) {
    const id = docId(e);
    if (!apply) {
        console.log(`  would upsert ${id}  <- ${e.imageUrl.slice(-60)}`);
        continue;
    }
    try {
        const assetId = await uploadImageAsset(e.imageUrl);
        await mutate([{
            createOrReplace: {
                _id: id,
                _type: "marketingHeroAsset",
                title: e.title,
                groupSlug: e.groupSlug,
                kind: e.kind,
                image: { _type: "image", asset: { _type: "reference", _ref: assetId } },
                ...(e.generator ? { generator: e.generator } : {}),
                sourceUrl: e.imageUrl,
                ...(e.notes ? { notes: e.notes } : {}),
            },
        }]);
        pushed += 1;
        console.log(`  upserted ${id}`);
    } catch (err) {
        failed += 1;
        console.error(`  FAILED ${id}: ${err.message}`);
    }
}
console.log(apply ? `done: ${pushed} pushed, ${failed} failed` : "dry run complete — rerun with --apply to push");
if (failed > 0) process.exit(1);
