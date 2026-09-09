import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

// Repoint the 21 Round premium heroes at the approved aligned-v4 renders, in
// both the catalog registry and the approved-release manifest. This is an
// indexing step: it changes what the storefront would render on its next build.
// It is not a deploy, and it does not touch Shopify, Convex or any hosted media.
//
// Both files move together on purpose. `catalog-approved-heroes.test.ts` hashes
// the bytes behind every registry url and asserts they match the manifest, so a
// registry repoint on its own fails the guard. Folding a family revision into
// the manifest is the established practice: all 27 rows of the Circle recovery
// are already reflected there.
//
// Every row is verified against the file on disk before anything is written,
// and the rows being replaced are snapshotted first so the change can be undone
// with one command.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = path.join(root, "src/lib/products/catalog-heroes.json");
const manifestPath = path.join(root, "docs/reviews/catalog-complete-hero-release-2026-09-07.json");
const reportPath = path.join(root, "docs/reviews/round-enhancement/aligned-v4-report.json");
const publicRoot = path.join(root, "public");
const rollbackPath = path.join(root, "docs/reviews/round-enhancement/registry-rollback-round-premium.json");

const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const manifestRows = new Map(manifest.rows.map((row) => [row.websiteSku, row]));
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const measured = new Map(report.rows.map((row) => [row.sku, row]));
const isRound = (row) => row.family === "Round" && /^(GB|LB)Rnd/.test(row.websiteSku ?? "");

const targets = registry.filter(isRound);
if (targets.length !== 21) throw new Error(`Expected 21 Round rows, found ${targets.length}`);

const replaced = [];
for (const row of targets) {
  const stats = measured.get(row.websiteSku);
  if (!stats) throw new Error(`No approved render for ${row.websiteSku}`);
  if (!stats.shoulderSolved) throw new Error(`${row.websiteSku} never reached its shoulder target`);
  if (stats.clippedAtCanvasEdge) throw new Error(`${row.websiteSku} is clipped at the canvas edge`);

  const url = `/images/catalog/round-enhancement/aligned-v4/${row.websiteSku}.${report.outputVersion}.png`;
  const file = path.join(publicRoot, url);
  if (!fs.existsSync(file)) throw new Error(`Missing render for ${row.websiteSku}: ${url}`);
  const sha256 = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

  const manifestRow = manifestRows.get(row.websiteSku);
  if (!manifestRow) throw new Error(`${row.websiteSku} is missing from the release manifest`);

  replaced.push({
    websiteSku: row.websiteSku,
    from: { url: row.url, manifestSha256: manifestRow.sha256 },
    to: { url, sha256 },
    shoulderPercent: stats.measuredShoulderPercent,
    targetShoulderPercent: stats.targetShoulderPercent,
  });
  // Only the url moves. The registry carries no hash field, and adding one to
  // 21 of 391 rows would drift the shape the CatalogHero type is inferred from;
  // the hash lives in the rollback snapshot and the render report instead.
  row.url = url;
  manifestRow.url = url;
  manifestRow.sha256 = sha256;
  // framing is a shared catalogue nudge carried by 250 of the 391 rows, not a
  // per-image correction, so it is left exactly as it was.
}

fs.writeFileSync(rollbackPath, `${JSON.stringify({
  writtenAt: new Date().toISOString(),
  registry: "src/lib/products/catalog-heroes.json",
  note: "Restore each `from` to undo the Round premium repoint.",
  rows: replaced,
}, null, 2)}\n`);
// The registry stores non-ASCII escaped, so em dashes and middle dots in `alt`
// and `presentation` stay as \uXXXX. Writing raw UTF-8 instead would leave a
// diff across hundreds of rows nobody touched.
const escaped = JSON.stringify(registry, null, 2)
  .replace(/[\u0080-\uffff]/g, (character) =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`);
fs.writeFileSync(registryPath, `${escaped}\n`);
// The manifest stores its text raw, so it is written back the same way.
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Repointed ${replaced.length} Round rows to ${report.outputVersion}`);
for (const row of replaced) {
  console.log(`  ${row.websiteSku.padEnd(26)} ${row.shoulderPercent}% (target ${row.targetShoulderPercent})`);
}
console.log(`Registry and release manifest both updated.`);
console.log(`Rollback snapshot: ${path.relative(root, rollbackPath)}`);
