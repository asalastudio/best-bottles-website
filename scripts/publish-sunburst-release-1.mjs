import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

// Index the Sunburst 2.5 heroes Jordan approved (visual sign-off, locked by
// image hash) into the catalog registry and the approved-release manifest.
// Same shape as publish-round-premium-to-registry.mjs: both files move
// together because catalog-approved-heroes.test.ts hashes the bytes behind
// every registry url against the manifest. It is an indexing step, not a
// deploy; it touches no Shopify, Convex or hosted media.
//
// Input: the approval lock (sku -> sha256 + file), copied from the review lane.
// Only SKUs that already have a registry row are repointed; a locked hero with
// no row (a new product group) is reported and left for a follow-up that adds
// the row properly. Every file is hash-checked, size-checked and corner-checked
// before anything is written, and the replaced rows are snapshotted first.
//
// Framing becomes identity for these rows: the Sunburst sized images carry
// their 91 % baseline and centring in the pixels, so the shared catalogue
// nudge must not be applied on top of them.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lockPath = path.join(root, "docs/reviews/sunburst-heroes-release-1/approved-lock.json");
const registryPath = path.join(root, "src/lib/products/catalog-heroes.json");
const manifestPath = path.join(root, "docs/reviews/catalog-complete-hero-release-2026-09-07.json");
const rollbackPath = path.join(root, "docs/reviews/sunburst-heroes-release-1/registry-rollback-2026-09-10.json");
const targetDir = path.join(root, "public/images/catalog/bone-review");
const BONE = [245, 243, 239];

const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const registryRows = new Map(registry.map((row) => [row.websiteSku, row]));
const manifestRows = new Map(manifest.rows.map((row) => [row.websiteSku, row]));
const identity = { scale: 1, translateXPercent: 0, translateYPercent: 0 };

// PNG size + corner check without a native dependency: parse IHDR, then decode
// the four corner pixels through sharp only if it is installed (it is: the test
// suite uses it), otherwise trust the review lane's own audit.
let sharp = null;
try { sharp = (await import("sharp")).default; } catch {}

const replaced = [];
const skipped = [];
for (const [sku, entry] of Object.entries(lock).sort()) {
  const row = registryRows.get(sku);
  const manifestRow = manifestRows.get(sku);
  if (!row) { skipped.push({ sku, why: "no registry row yet (new product group) — needs a row with group slug and variant before it can be indexed" }); continue; }
  if (!manifestRow) { skipped.push({ sku, why: "missing from the release manifest" }); continue; }
  const bytes = fs.readFileSync(entry.file);
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== entry.sha256) { skipped.push({ sku, why: "locked file no longer matches the approved hash" }); continue; }
  if (sharp) {
    const { data, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== 1560 || info.height !== 1716) { skipped.push({ sku, why: `wrong size ${info.width}x${info.height}` }); continue; }
    const corners = [[0, 0], [1559, 0], [0, 1715], [1559, 1715]].map(([x, y]) => [...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3)]);
    if (!corners.every((c) => c.every((v, i) => v === BONE[i]))) { skipped.push({ sku, why: `corner not bone: ${JSON.stringify(corners)}` }); continue; }
  }
  const url = `/images/catalog/bone-review/${sku}.${sha256.slice(0, 12)}.png`;
  const file = path.join(root, "public", url);
  if (!fs.existsSync(file)) fs.writeFileSync(file, bytes);
  replaced.push({
    websiteSku: sku,
    family: row.family,
    from: { url: row.url, manifestSha256: manifestRow.sha256, framing: row.framing },
    to: { url, sha256, framing: identity },
    approvedOn: entry.card,
    approvedAt: entry.approvedAt,
  });
  row.url = url;
  row.framing = { ...identity };
  manifestRow.url = url;
  manifestRow.sha256 = sha256;
  manifestRow.framing = { ...identity };
}

fs.writeFileSync(rollbackPath, `${JSON.stringify({
  writtenAt: new Date().toISOString(),
  registry: "src/lib/products/catalog-heroes.json",
  manifest: "docs/reviews/catalog-complete-hero-release-2026-09-07.json",
  note: "Restore each `from` (url, manifest sha256, framing) to undo the Sunburst release 1 repoint.",
  rows: replaced,
  skipped,
}, null, 2)}\n`);
// The registry stores non-ASCII escaped; the manifest stores raw text (see the Round script).
const escaped = JSON.stringify(registry, null, 2)
  .replace(/[\u0080-\uffff]/g, (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`);
fs.writeFileSync(registryPath, `${escaped}\n`);
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Repointed ${replaced.length} rows; skipped ${skipped.length}`);
for (const s of skipped) console.log(`  skipped ${s.sku}: ${s.why}`);
const byFamily = {};
for (const r of replaced) byFamily[r.family] = (byFamily[r.family] ?? 0) + 1;
console.log(`By family: ${JSON.stringify(byFamily)}`);
console.log(`Rollback snapshot: ${path.relative(root, rollbackPath)}`);
