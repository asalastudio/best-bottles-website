/**
 * Local runner for the Convex productGroups rebuild.
 *
 * Convex actions cannot read the repo filesystem, so this script reads the
 * canonical CSV locally and passes its content to
 * productGroupsRebuild:rebuildFromCsv.
 *
 * Usage:
 *   node scripts/rebuild_product_groups.mjs                 # dry-run (default)
 *   node scripts/rebuild_product_groups.mjs --apply         # write changes
 *   node scripts/rebuild_product_groups.mjs --csv path.csv  # non-default CSV
 *   CONVEX_URL=https://... node scripts/rebuild_product_groups.mjs
 *
 * Targets the deployment in NEXT_PUBLIC_CONVEX_URL (.env.local) unless
 * CONVEX_URL is set explicitly. See memory/project_convex_deployments.md
 * for dev vs prod deployment URLs.
 */

import { readFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";

function readEnvLocal(key) {
  try {
    const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    const line = env.split("\n").find((l) => l.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).trim() : undefined;
  } catch {
    return undefined;
  }
}

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const csvFlagIdx = argv.indexOf("--csv");
const csvPath = csvFlagIdx !== -1 ? argv[csvFlagIdx + 1] : "data/grace_products_final.v2.csv";

const convexUrl = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL || readEnvLocal("NEXT_PUBLIC_CONVEX_URL");
if (!convexUrl) {
  console.error("No Convex URL found. Set CONVEX_URL or NEXT_PUBLIC_CONVEX_URL (or add it to .env.local).");
  process.exit(1);
}

const csvContent = readFileSync(csvPath, "utf8");
console.log(`Rebuilding productGroups from ${csvPath} (${(csvContent.length / 1024).toFixed(0)} KB)`);
console.log(`Deployment: ${convexUrl}`);
console.log(`Mode: ${apply ? "APPLY (writing changes)" : "dry-run (pass --apply to write)"}`);

const client = new ConvexHttpClient(convexUrl);
const report = await client.action("productGroupsRebuild:rebuildFromCsv", {
  csvContent,
  csvLabel: csvPath,
  dryRun: !apply,
});

console.log(JSON.stringify(report, null, 2));
if (report.orphansInConvex?.length) {
  console.log(`\n⚠ ${report.orphansInConvex.length} orphan group(s) exist in Convex but not the CSV.`);
  console.log("Review them, then delete explicitly via productGroupsRebuild:deleteOrphanedGroups.");
}
