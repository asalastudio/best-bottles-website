#!/usr/bin/env node
// Publish only the explicitly approved Boston kit rows. Dry-run is the default.
// Applying requires the exact release instruction:
//   --apply --ship "ship Boston Round kit release 2026-09-12"
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";
import { createBlobStore, verifyPublicUrl } from "./../paperdoll/lib/store-blob.mjs";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const ship = args.includes("--ship") ? args[args.indexOf("--ship") + 1] : "";
const expectedShip = "ship Boston Round kit release 2026-09-12";
const root = resolve(".");
const releaseDir = resolve("dist/paper-doll/boston-kit-release-2026-09-12");
const manifestPath = join(releaseDir, "manifest.json");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const bounds = b => ({ left: b.left, top: b.top, right: b.right, bottom: b.bottom });
const plateHash = plate => (plate?.image ?? "").match(/\/([0-9a-f]{64})\.front-on-/)?.[1] ?? null;
if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
  try { process.loadEnvFile(resolve(".env.local")); } catch { /* explicit error below */ }
}

function fail(message) { console.error(`publish-boston-kit-release: ${message}`); process.exit(1); }

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const approved = manifest.rows.filter(row => row.approval?.status === "approved");
  if (!approved.length) fail("manifest has no approved kit rows");
  if (apply && ship !== expectedShip) fail(`publication requires --ship ${JSON.stringify(expectedShip)}`);
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) fail("NEXT_PUBLIC_CONVEX_URL is not set");
  const writeToken = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
  if (apply && !writeToken) fail("BEST_BOTTLES_CONVEX_WRITE_TOKEN is not set");
  const convex = new ConvexHttpClient(convexUrl);
  console.log(`${apply ? "PUBLISH" : "DRY RUN"} Boston kit release → ${convexUrl}`);
  console.log(`approved rows: ${approved.length}; pending/held rows: ${manifest.rows.length - approved.length}`);

  const skus = approved.flatMap(row => [row.websiteSku, row.graceSku].filter(Boolean));
  const plates = {};
  for (let i = 0; i < skus.length; i += 200) Object.assign(plates, (await convex.query(api.productPlates.forSkus, { skus: skus.slice(i, i + 200) })).plates);
  const indexRows = [];
  const parts = new Map();
  for (const row of approved) {
    const plate = plates[row.websiteSku] ?? plates[row.graceSku];
    if (!plate) fail(`${row.sku}: no published plate`);
    const currentPlateHash = plateHash(plate);
    if (currentPlateHash !== row.plateSha256) fail(`${row.sku}: current plate hash ${currentPlateHash ?? "missing"} does not match release ${row.plateSha256}`);
    if (row.approval.plateSha256 !== row.plateSha256) fail(`${row.sku}: approval is bound to a different plate hash`);
    for (const part of row.parts) {
      const file = join(releaseDir, "parts", part.image.key);
      const bytes = await readFile(file).catch(() => fail(`${row.sku}: missing part ${part.image.key}`));
      const actual = hash(bytes);
      if (actual !== part.image.sha256) fail(`${row.sku}: part hash drift for ${part.image.key}`);
      parts.set(part.image.key, { file, bytes, part });
    }
    indexRows.push({
      sku: row.sku, websiteSku: row.websiteSku, graceSku: row.graceSku, familyId: row.familyId,
      plateSha256: currentPlateHash, canvas: row.canvas, anchors: row.anchors,
      completeness: row.completeness,
      parts: row.parts.map(part => ({ ...part, bounds: bounds(part.bounds) })),
      three: row.three, source: row.source,
      builder: { name: "publish-boston-kit-release.mjs", version: "1.0.0", builtAt: Date.now() },
      storageProvider: "vercel-blob",
    });
  }
  console.log(`current plate hashes verified: ${indexRows.length}`);
  console.log(`distinct part objects: ${parts.size}`);
  if (!apply) {
    console.log("No media uploaded and no Convex rows changed.");
    console.log(`Ready for the exact release instruction: ${expectedShip}`);
    return;
  }
  const store = createBlobStore();
  let uploaded = 0, existed = 0, verified = 0;
  const assets = new Map();
  for (const [key, item] of parts) {
    const put = await store.putObject(`kits/boston-round-2026-09-12/${key}`, item.bytes, "image/webp");
    put.existed ? existed++ : uploaded++;
    const verdict = await verifyPublicUrl(put.url, { expectedBytes: item.bytes.length, expectedContentType: "image/webp" });
    if (!verdict.ok) fail(`${key}: ${verdict.problems.join("; ")}`);
    verified++;
    assets.set(key, { url: put.url, key: `kits/boston-round-2026-09-12/${key}`, sha256: item.part.image.sha256, bytes: item.bytes.length, width: 1000, height: 1100 });
  }
  const rows = indexRows.map(row => ({ ...row, parts: row.parts.map(part => ({ ...part, image: assets.get(part.image.key) })) }));
  const outcomes = [];
  for (let i = 0; i < rows.length; i += 50) outcomes.push(...await convex.mutation(api.productKits.upsertMany, { writeToken, rows: rows.slice(i, i + 50) }));
  const errors = outcomes.filter(x => x.outcome === "error");
  if (errors.length) fail(`Convex kit write errors: ${errors.map(x => `${x.sku}: ${x.error}`).join("; ")}`);
  const record = { release: manifest.id, ship, appliedAt: new Date().toISOString(), rows: rows.map(row => row.sku), uploaded, existed, verified, outcomes };
  await writeFile(join(releaseDir, "publish-record.json"), JSON.stringify(record, null, 2) + "\n");
  console.log(`parts: uploaded ${uploaded}, already present ${existed}, verified ${verified}`);
  console.log(`rows: ${outcomes.filter(x => x.outcome === "inserted").length} inserted, ${outcomes.filter(x => x.outcome === "updated").length} updated, ${outcomes.filter(x => x.outcome === "unchanged").length} unchanged`);
  console.log("OK — run the ledger recount and kit integrity check now.");
}

main().catch(error => { console.error(error); process.exit(1); });
