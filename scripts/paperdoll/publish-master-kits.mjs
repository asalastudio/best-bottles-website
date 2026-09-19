#!/usr/bin/env node
// Publish master-PSD kits extracted by build_master_kits.py for one batch.
// Dry run by default. Applying needs the batch's approval file and the exact
// release phrase Jordan gives for it:
//
//   node scripts/paperdoll/publish-master-kits.mjs --batch dist/paper-doll/boston-master
//   node scripts/paperdoll/publish-master-kits.mjs --batch dist/paper-doll/boston-master --apply --ship "<phrase>"
//
// <batch>/kits/approval.json: { release, ship, approvedBy, approvedAt, skus: { <sku>: <plateSha256> } }
// A row is published only when it is a candidate in the kit manifest, its plate
// hash is the one currently indexed, and the approval names that same hash.
// env: NEXT_PUBLIC_CONVEX_URL, BLOB_READ_WRITE_TOKEN, BEST_BOTTLES_CONVEX_WRITE_TOKEN
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";
import { createBlobStore, verifyPublicUrl } from "./lib/store-blob.mjs";

const args = process.argv.slice(2);
const value = k => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const apply = args.includes("--apply");
const ship = value("--ship") ?? "";
const batch = resolve(value("--batch") ?? "");
if (!value("--batch")) fail("--batch <dir> is required");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const bounds = b => ({ left: b.left, top: b.top, right: b.right, bottom: b.bottom });
const plateHash = plate => (plate?.image ?? "").match(/\/([0-9a-f]{64})\.front-on-/)?.[1] ?? null;
if (!process.env.NEXT_PUBLIC_CONVEX_URL) { try { process.loadEnvFile(resolve(".env.local")); } catch { /* reported below */ } }
function fail(message) { console.error(`publish-master-kits: ${message}`); process.exit(1); }

async function main() {
  const manifest = JSON.parse(await readFile(join(batch, "kits/manifest.json"), "utf8"));
  if (manifest.partial) fail("kits/manifest.json is a partial (sample) run; rebuild the whole batch");
  const approval = JSON.parse(await readFile(join(batch, "kits/approval.json"), "utf8").catch(() => "null"));
  if (!approval?.skus || !approval.ship) fail("kits/approval.json with a ship phrase and approved SKUs is required");
  if (apply && ship !== approval.ship) fail(`publication requires --ship ${JSON.stringify(approval.ship)}`);
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) fail("NEXT_PUBLIC_CONVEX_URL is not set");
  const writeToken = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
  if (apply && !writeToken) fail("BEST_BOTTLES_CONVEX_WRITE_TOKEN is not set");
  const convex = new ConvexHttpClient(convexUrl);
  console.log(`${apply ? "PUBLISH" : "DRY RUN"} ${approval.release} → ${convexUrl}`);

  const candidates = manifest.rows.filter(row => row.status === "candidate" && row.parts?.length);
  const approved = candidates.filter(row => approval.skus[row.sku]);
  const held = candidates.filter(row => !approval.skus[row.sku]);
  console.log(`candidates ${candidates.length}, approved ${approved.length}, held ${held.length}, not extracted ${manifest.rows.length - candidates.length}`);
  if (!approved.length) fail("no approved kit rows");

  const skus = approved.flatMap(row => [row.websiteSku, row.graceSku].filter(Boolean));
  const plates = {};
  for (let i = 0; i < skus.length; i += 200) Object.assign(plates, (await convex.query(api.productPlates.forSkus, { skus: skus.slice(i, i + 200) })).plates);
  const parts = new Map(); const indexRows = [];
  for (const row of approved) {
    const plate = plates[row.websiteSku] ?? plates[row.graceSku];
    if (!plate) fail(`${row.sku}: no published plate`);
    const current = plateHash(plate);
    if (current !== row.plateSha256) fail(`${row.sku}: current plate hash ${current ?? "missing"} differs from the kit's ${row.plateSha256}`);
    if (approval.skus[row.sku] !== row.plateSha256) fail(`${row.sku}: approval is bound to a different plate hash`);
    if (!row.gates?.parity?.ok || row.gates.alpha.some(g => !g.ok)) fail(`${row.sku}: a gate did not pass`);
    for (const part of row.parts) {
      const bytes = await readFile(join(batch, "kits", part.image)).catch(() => fail(`${row.sku}: missing part ${part.image}`));
      if (hash(bytes) !== part.sha256) fail(`${row.sku}: part hash drift for ${part.image}`);
      parts.set(part.storeKey, { bytes, part });
    }
    indexRows.push({
      sku: row.sku, websiteSku: row.websiteSku, graceSku: row.graceSku, familyId: row.familyId,
      plateSha256: current, canvas: row.canvas, anchors: row.anchors, completeness: row.completeness,
      parts: row.parts.map(part => ({ slot: part.slot, variantKey: part.variantKey, zOrder: part.zOrder, explodeIndex: part.explodeIndex,
        bounds: bounds(part.bounds), assembled: part.assembled, exploded: part.exploded, image: part.storeKey, image2x: null, mask: null, derivation: part.derivation })),
      three: row.three, source: row.source,
      builder: { name: "publish-master-kits.mjs", version: "1.0.0", builtAt: Date.now() },
      storageProvider: "vercel-blob",
    });
  }
  console.log(`current plate hashes verified: ${indexRows.length}; distinct part objects: ${parts.size}`);
  if (!apply) { console.log("No media uploaded and no Convex rows changed."); console.log(`Ready for: --apply --ship ${JSON.stringify(approval.ship)}`); return; }

  const store = createBlobStore();
  let uploaded = 0, existed = 0; const assets = new Map();
  for (const [key, item] of parts) {
    const put = await store.putObject(key, item.bytes, "image/webp");
    put.existed ? existed++ : uploaded++;
    const verdict = await verifyPublicUrl(put.url, { expectedBytes: item.bytes.length, expectedContentType: "image/webp" });
    if (!verdict.ok) fail(`${key}: ${verdict.problems.join("; ")}`);
    assets.set(key, { url: put.url, key, sha256: item.part.sha256, bytes: item.bytes.length, width: item.part.width, height: item.part.height });
  }
  const rows = indexRows.map(row => ({ ...row, parts: row.parts.map(part => ({ ...part, image: assets.get(part.image) })) }));
  const outcomes = [];
  for (let i = 0; i < rows.length; i += 50) outcomes.push(...await convex.mutation(api.productKits.upsertMany, { writeToken, rows: rows.slice(i, i + 50) }));
  const errors = outcomes.filter(x => x.outcome === "error");
  if (errors.length) fail(`Convex kit write errors: ${errors.map(x => `${x.sku}: ${x.error}`).join("; ")}`);
  const record = { release: approval.release, ship, target: convexUrl, appliedAt: new Date().toISOString(), rows: rows.map(row => row.sku), uploaded, existed, outcomes };
  await writeFile(join(batch, "kits/publish-record.json"), JSON.stringify(record, null, 2) + "\n");
  console.log(`parts: uploaded ${uploaded}, already present ${existed}`);
  console.log(`rows: ${outcomes.filter(x => x.outcome === "inserted").length} inserted, ${outcomes.filter(x => x.outcome === "updated").length} updated, ${outcomes.filter(x => x.outcome === "unchanged").length} unchanged`);
}
main().catch(error => { console.error(error); process.exit(1); });
