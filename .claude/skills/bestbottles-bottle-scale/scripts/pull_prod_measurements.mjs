// Snapshot every product's measurements from PRODUCTION Convex.
//
// Why production: the 2026-09 canonical measurement audit was written straight to prod
// (products.measurementSource = "best-bottles-master-truth@2026-07-12:..."); dev is not the truth.
// Why these queries: the Convex MCP treats prod as read-only for data, so read it the way the site
// does - products:getProductGroupIdList, then products:getVariantsForGroup per group - plus the
// narrow SKU index (products:getAllForPlates) to report rows that belong to no group.
//
// Usage (from the repo root, so `convex` resolves from node_modules):
//   node .claude/skills/bestbottles-bottle-scale/scripts/pull_prod_measurements.mjs docs/reviews/bottle-measurements-YYYY-MM-DD
import { ConvexHttpClient } from "convex/browser";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = process.argv[2];
if (!outDir) {
  console.error("usage: pull_prod_measurements.mjs <snapshot dir>");
  process.exit(1);
}
const PROD = process.env.CONVEX_PROD_URL ?? "https://precise-raccoon-123.convex.cloud";
const client = new ConvexHttpClient(PROD);
const KEEP = ["_id", "websiteSku", "graceSku", "itemName", "category", "family", "shape", "color", "capacity", "capacityMl",
  "capacityOz", "applicator", "capColor", "capStyle", "capHeight", "neckThreadSize", "heightWithCap", "heightWithoutCap",
  "diameter", "depthMm", "widthMm", "measurementSource", "bottleCollection", "assemblyType", "productGroupId", "stockStatus",
  "shopifySellable", "productUrl"];

const ids = await client.query("products:getProductGroupIdList", {});
const rows = new Map();
const queue = [...ids];
let done = 0;
async function worker() {
  while (queue.length) {
    const id = queue.shift();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const docs = await client.query("products:getVariantsForGroup", { groupId: id });
        for (const d of docs) rows.set(d._id, Object.fromEntries(KEEP.map((k) => [k, d[k] ?? null])));
        break;
      } catch (e) {
        if (attempt === 2) console.error("group failed", id, String(e).slice(0, 120));
      }
    }
    if (++done % 50 === 0) console.error(`groups ${done}/${ids.length}`);
  }
}
await Promise.all(Array.from({ length: 8 }, worker));

const index = [];
let cursor = null;
do {
  const r = await client.query("products:getAllForPlates", { limit: 1000, cursor });
  index.push(...r.page);
  cursor = r.isDone ? null : r.continueCursor;
} while (cursor);
const ungrouped = index.filter((p) => !rows.has(p._id));

mkdirSync(outDir, { recursive: true });
const file = join(outDir, "prod-products.json");
writeFileSync(file, JSON.stringify({ pulledAt: new Date().toISOString(), deployment: PROD, groups: ids.length,
  products: [...rows.values()], ungrouped }) + "\n");
console.log(`${file}: groups ${ids.length}, grouped products ${rows.size}, all SKUs ${index.length}, ungrouped ${ungrouped.length}`);
