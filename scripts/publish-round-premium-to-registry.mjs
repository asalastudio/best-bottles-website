import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

// Repoint the 21 Round premium heroes in the catalog registry at the approved
// aligned-v4 renders. This is an indexing step: it changes what the storefront
// would render on its next build. It is not a deploy, and it does not touch
// Shopify, Convex or any hosted media.
//
// Every row is verified against the file on disk before anything is written,
// and the rows being replaced are snapshotted first so the change can be undone
// with one command.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = path.join(root, "src/lib/products/catalog-heroes.json");
const reportPath = path.join(root, "docs/reviews/round-enhancement/aligned-v4-report.json");
const publicRoot = path.join(root, "public");
const rollbackPath = path.join(root, "docs/reviews/round-enhancement/registry-rollback-round-premium.json");

const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
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

  replaced.push({
    websiteSku: row.websiteSku,
    from: { url: row.url },
    to: { url, sha256 },
    shoulderPercent: stats.measuredShoulderPercent,
    targetShoulderPercent: stats.targetShoulderPercent,
  });
  // Only the url moves. The registry carries no hash field, and adding one to
  // 21 of 391 rows would drift the shape the CatalogHero type is inferred from;
  // the hash lives in the rollback snapshot and the render report instead.
  row.url = url;
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

console.log(`Repointed ${replaced.length} Round rows to ${report.outputVersion}`);
for (const row of replaced) {
  console.log(`  ${row.websiteSku.padEnd(26)} ${row.shoulderPercent}% (target ${row.targetShoulderPercent})`);
}
console.log(`Rollback snapshot: ${path.relative(root, rollbackPath)}`);
