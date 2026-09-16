#!/usr/bin/env node
// Replace one published kit part (by its sha256) with a cleaned file in every
// kit row that references it. Dry run by default; --apply uploads the new
// content-addressed object and rewrites the rows. Never overwrites the old object.
//
//   node scripts/paperdoll/replace-kit-part.mjs --old <sha256> --file cleaned.webp --skus data/asset-ledger/builder-funnel.json --family Cylinder [--apply --why "…"]
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, basename } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";
import { createBlobStore, verifyPublicUrl } from "./lib/store-blob.mjs";
const args = process.argv.slice(2); const value = k => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const apply = args.includes("--apply"); const oldSha = value("--old"); const file = value("--file"); const family = value("--family"); const why = value("--why") ?? "";
// forSku returns a trimmed view; the row identity (websiteSku, graceSku, source) comes from --identity <json: {sku: {...}}>, read from the deployment first
const identity = value("--identity") ? JSON.parse(await readFile(value("--identity"), "utf8")) : {};
if (!oldSha || !file || !family) { console.error("--old, --file and --family are required"); process.exit(1); }
if (!process.env.NEXT_PUBLIC_CONVEX_URL) { try { process.loadEnvFile(resolve(".env.local")); } catch {} }
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
const bytes = await readFile(file); const newSha = createHash("sha256").update(bytes).digest("hex");
const funnel = JSON.parse(await readFile(resolve("data/asset-ledger/builder-funnel.json"), "utf8"));
const skus = funnel.report.find(r => r.family === family)?.configurationSkus ?? [];
const affected = [];
for (const sku of skus) { const kit = await convex.query(api.productKits.forSku, { websiteSku: sku, graceSku: sku }); if (kit?.parts.some(p => p.image.sha256 === oldSha)) affected.push(kit); }
console.log(`${apply ? "APPLY" : "DRY RUN"} → ${process.env.NEXT_PUBLIC_CONVEX_URL}: part ${oldSha.slice(0, 12)} → ${newSha.slice(0, 12)} (${bytes.length} bytes) in ${affected.length} kit rows: ${affected.map(k => k.sku).join(", ")}`);
if (!affected.length || !apply) process.exit(0);
const slot = affected[0].parts.find(p => p.image.sha256 === oldSha).slot;
const key = `kits/cylinder-master/${newSha}.${slot}.webp`;
const store = createBlobStore(); const put = await store.putObject(key, bytes, "image/webp");
const verdict = await verifyPublicUrl(put.url, { expectedBytes: bytes.length, expectedContentType: "image/webp" }); if (!verdict.ok) { console.error(verdict.problems); process.exit(1); }
for (const k of affected) if (!identity[k.sku]) { console.error(`${k.sku}: identity (websiteSku, graceSku, source) not provided; pass --identity`); process.exit(1); }
const rows = affected.map(k => { const { _id, _creationTime, importedAt, revision, updatedAt, conflicts, ...rest } = k; return { ...rest, ...identity[k.sku], parts: k.parts.map(p => p.image.sha256 === oldSha ? { ...p, image: { url: put.url, key, sha256: newSha, bytes: bytes.length, width: p.image.width, height: p.image.height } } : p), builder: { name: "replace-kit-part.mjs", version: "1.0.0", builtAt: Date.now() }, storageProvider: "vercel-blob" }; });
const outcomes = await convex.mutation(api.productKits.upsertMany, { writeToken: process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN, rows });
await writeFile(resolve(`data/asset-ledger/kit-part-replacements.json`), JSON.stringify({ appliedAt: new Date().toISOString(), oldSha, newSha, key, why, skus: affected.map(k => k.sku), outcomes }, null, 1) + "\n", { flag: "a" });
console.log(outcomes.map(o => `${o.sku}: ${o.outcome}`).join(", "));
