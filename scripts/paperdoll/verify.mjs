#!/usr/bin/env node
// Verify the plate index: integrity sweeps over productPlates and productKits,
// plus a network sample of the URLs the page will actually use. Exits
// non-zero on ANY issue, so a dirty index cannot be left behind quietly.
//
//   node scripts/paperdoll/verify.mjs [--sample 40] [--all-urls] [--strict]
//   env: NEXT_PUBLIC_CONVEX_URL
//
// Two kinds of issue: INDEX issues (duplicate rows, orphan plates, bad hosts,
// missing fronts, stale kits) always fail. CATALOGUE issues (a website SKU that
// appears on more than one product document) are the catalogue's defect, not
// the index's: they are listed and counted, and fail only under --strict.
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";
import { verifyPublicUrl } from "./lib/store-blob.mjs";

const argv = process.argv.slice(2);
const sampleSize = Number(argv[argv.indexOf("--sample") + 1] || 40);
const allUrls = argv.includes("--all-urls");
const strict = argv.includes("--strict");
const CATALOGUE_ISSUES = new Set(["products_duplicate_websiteSku"]);

async function sweep(convex, fn, label) {
    let cursor = null;
    let checked = 0;
    const issues = [];
    for (let page = 0; page < 200; page++) {
        const result = await convex.query(fn, { cursor, pageSize: 200 });
        checked += result.checked;
        issues.push(...result.issues);
        if (result.isDone) break;
        cursor = result.continueCursor;
    }
    const indexIssues = issues.filter((issue) => !CATALOGUE_ISSUES.has(issue.issue));
    const catalogueIssues = issues.filter((issue) => CATALOGUE_ISSUES.has(issue.issue));
    console.log(`${label}: ${checked} rows, ${indexIssues.length} index issues, ${catalogueIssues.length} catalogue issues`);
    for (const issue of indexIssues.slice(0, 25)) console.log(`   !! ${issue.sku}: ${issue.issue} ${issue.detail}`);
    for (const issue of catalogueIssues.slice(0, 60)) console.log(`   ~~ ${issue.sku}: ${issue.issue} ${issue.detail}`);
    return { checked, issues: strict ? issues : indexIssues, catalogueIssues };
}

async function main() {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) { console.error("NEXT_PUBLIC_CONVEX_URL is not set"); process.exit(1); }
    const convex = new ConvexHttpClient(url);
    console.log(`verify → ${url}`);

    const plates = await sweep(convex, api.productPlates.integrity, "productPlates");
    const kits = await sweep(convex, api.productKits.integrity, "productKits");

    // the network sample: what a browser will get
    const urls = [];
    for (const family of await convex.query(api.productPlates.families, {})) {
        let cursor = null;
        for (let page = 0; page < 50; page++) {
            const result = await convex.query(api.productPlates.byFamily, { familyId: family.familyId, cursor, limit: 500 });
            for (const row of result.page) {
                urls.push(row.image, row.thumb);
                if (row.imageCapOff) urls.push(row.imageCapOff);
            }
            if (result.isDone) break;
            cursor = result.continueCursor;
        }
    }
    const picked = allUrls ? urls : shuffle(urls).slice(0, sampleSize);
    let urlFailures = 0;
    for (const target of picked) {
        const verdict = await verifyPublicUrl(target, { expectedContentType: "image/webp" });
        if (!verdict.ok) { urlFailures++; console.log(`   !! ${target}: ${verdict.problems.join("; ")}`); }
    }
    console.log(`urls: ${picked.length} checked of ${urls.length}, ${urlFailures} failing`);

    const failed = plates.issues.length + kits.issues.length + urlFailures;
    const warned = plates.catalogueIssues.length + kits.catalogueIssues.length;
    console.log(failed ? `\nFAILED: ${failed} issue(s)` : warned ? `\nOK (index clean; ${warned} catalogue issue(s) listed above — the products table, not the plates)` : "\nOK");
    process.exit(failed ? 1 : 0);
}

function shuffle(list) {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

main().catch((error) => { console.error(error); process.exit(1); });
