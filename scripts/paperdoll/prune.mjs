#!/usr/bin/env node
// Remove index rows — the one place a plate row is ever deleted. Dry run by
// default; nothing in the object store is touched (keys are content-addressed
// and a later publish reuses them).
//
//   node scripts/paperdoll/prune.mjs --orphans            # rows whose SKU no product carries (from the integrity sweep)
//   node scripts/paperdoll/prune.mjs --sku A,B,C          # named rows
//   add --apply to delete
//   env: NEXT_PUBLIC_CONVEX_URL, BEST_BOTTLES_CONVEX_WRITE_TOKEN (apply only)
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const orphans = argv.includes("--orphans");
const skuArg = argv[argv.indexOf("--sku") + 1];
const named = argv.includes("--sku") && skuArg ? skuArg.split(",").map((s) => s.trim()).filter(Boolean) : [];

async function main() {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    const writeToken = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
    if (!url) { console.error("NEXT_PUBLIC_CONVEX_URL is not set"); process.exit(1); }
    if (apply && !writeToken) { console.error("BEST_BOTTLES_CONVEX_WRITE_TOKEN is not set"); process.exit(1); }
    if (!orphans && named.length === 0) { console.error("pass --orphans or --sku A,B"); process.exit(1); }
    const convex = new ConvexHttpClient(url);
    console.log(`${apply ? "PRUNE" : "DRY RUN"} → ${url}`);

    const targets = new Set(named);
    if (orphans) {
        let cursor = null;
        for (let page = 0; page < 200; page++) {
            const result = await convex.query(api.productPlates.integrity, { cursor, pageSize: 200 });
            for (const issue of result.issues) if (issue.issue === "orphan_plate") targets.add(issue.sku);
            if (result.isDone) break;
            cursor = result.continueCursor;
        }
    }
    const list = [...targets].sort();
    console.log(`${list.length} row(s) to remove:`);
    for (const sku of list) console.log(`   - ${sku}`);
    if (!apply) { console.log("re-run with --apply to delete these index rows (objects stay)."); return; }

    let removed = 0;
    const missing = [];
    for (let i = 0; i < list.length; i += 50) {
        const result = await convex.mutation(api.productPlates.removeRows, { writeToken, skus: list.slice(i, i + 50) });
        removed += result.removed;
        missing.push(...result.missing);
    }
    console.log(`removed ${removed} row(s)${missing.length ? `, ${missing.length} not found: ${missing.join(", ")}` : ""}`);
}

main().catch((error) => { console.error(error); process.exit(1); });
