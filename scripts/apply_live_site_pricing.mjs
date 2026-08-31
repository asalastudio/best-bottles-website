#!/usr/bin/env node
/**
 * Push live bestbottles.com pricing truth into Convex.
 *
 * Source: docs/reviews/audit-2026-08-06/live-site-full-scrape.json
 * (scripts/scrape_live_tier_pricing.mjs). The SITE is the source of truth —
 * webPrice1pc / webPrice10pc / webPrice12pc / priceTiers are overwritten to
 * mirror the page exactly. Rows excluded here stay on the Abbas/Magni
 * reconciliation sheet instead of being written:
 *   - pages that scraped with no purchase ladder (enquire-only)
 *   - pages the site prices at $0 (tier-1 unit price 0)
 *   - Convex SKUs with no matching page (mutation reports them as `missing`)
 *
 * Usage:
 *   node scripts/apply_live_site_pricing.mjs             # dry-run vs dev
 *   node scripts/apply_live_site_pricing.mjs --prod      # dry-run vs prod
 *   node scripts/apply_live_site_pricing.mjs --apply         # write dev
 *   node scripts/apply_live_site_pricing.mjs --apply --prod  # write prod
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const SRC = path.join(REPO, "docs/reviews/audit-2026-08-06/live-site-full-scrape.json");

const APPLY = process.argv.includes("--apply");
const PROD = process.argv.includes("--prod");
const BATCH = 100;

function convexRun(fn, args) {
    const argv = ["convex", "run", fn, JSON.stringify(args)];
    if (PROD) argv.push("--prod");
    const out = execFileSync("npx", argv, {
        cwd: REPO,
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
    });
    return JSON.parse(out);
}

const rows = JSON.parse(readFileSync(SRC, "utf8"));
const skipped = { notOk: [], zeroPrice: [], duplicate: [] };
const seen = new Set();
const items = [];

for (const r of rows) {
    if (r.status !== "ok") {
        skipped.notOk.push(r.url);
        continue;
    }
    if (seen.has(r.siteSku)) {
        skipped.duplicate.push(r.siteSku);
        continue;
    }
    seen.add(r.siteSku);
    const tiers = [...r.tiers].sort((a, b) => a.qty - b.qty);
    const t1 = tiers.find((t) => t.qty === 1);
    if (!t1 || t1.unitPrice === 0) {
        skipped.zeroPrice.push(r.siteSku);
        continue;
    }
    items.push({
        websiteSku: r.siteSku,
        webPrice1pc: t1.unitPrice,
        webPrice10pc: tiers.find((t) => t.qty === 10)?.unitPrice ?? null,
        webPrice12pc: tiers.find((t) => t.qty === 12)?.unitPrice ?? null,
        tiers: tiers.map((t) => ({ minQty: t.qty, totalPrice: t.lineTotal, unitPrice: t.unitPrice })),
    });
}

console.log(`Target: ${PROD ? "PROD" : "dev"} | mode: ${APPLY ? "APPLY" : "dry-run"}`);
console.log(`Site rows: ${rows.length} | loadable: ${items.length}`);
console.log(`Skipped — no ladder/error: ${skipped.notOk.length}, $0-priced: ${skipped.zeroPrice.length}, dup URLs: ${skipped.duplicate.length}`);

const syncedAt = Date.now();
const totals = { patched: 0, unchanged: 0, missing: [], changes: { p1: 0, p10: 0, p12: 0, tiers: 0 }, samples: [] };

for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    const r = convexRun("pricing:applySitePricingBatch", {
        items: batch,
        syncedAt,
        dryRun: !APPLY,
    });
    totals.patched += r.patched;
    totals.unchanged += r.unchanged;
    totals.missing.push(...r.missing);
    for (const k of Object.keys(totals.changes)) totals.changes[k] += r.changes[k];
    for (const s of r.samples) if (totals.samples.length < 12) totals.samples.push(s);
    process.stdout.write(`  batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(items.length / BATCH)} patched=${r.patched} unchanged=${r.unchanged} missing=${r.missing.length}\n`);
}

console.log(`\n─── ${APPLY ? "Applied" : "Would apply"} ───`);
console.log(`Products ${APPLY ? "patched" : "needing patch"}: ${totals.patched} | already exact: ${totals.unchanged}`);
console.log(`Field changes — webPrice1pc: ${totals.changes.p1}, webPrice10pc: ${totals.changes.p10}, webPrice12pc: ${totals.changes.p12}, priceTiers: ${totals.changes.tiers}`);
console.log(`Site SKUs with no Convex product: ${totals.missing.length}`);
if (totals.missing.length) console.log(`  ${totals.missing.slice(0, 20).join(", ")}${totals.missing.length > 20 ? " …" : ""}`);
if (totals.samples.length) {
    console.log(`\nSample price corrections [convex → site]:`);
    for (const s of totals.samples) {
        console.log(`  ${s.websiteSku}: 1pc ${s.webPrice1pc[0]} → ${s.webPrice1pc[1]}, 10pc ${s.webPrice10pc[0]} → ${s.webPrice10pc[1]}, 12pc ${s.webPrice12pc[0]} → ${s.webPrice12pc[1]}`);
    }
}

if (APPLY) {
    console.log(`\nRefreshing productGroups price ranges…`);
    let skip = 0;
    let patchedGroups = 0;
    for (;;) {
        const r = convexRun("pricing:refreshGroupPriceRanges", { dryRun: false, skip, take: 50 });
        patchedGroups += r.patchedCount;
        if (r.groupsScanned < 50) break;
        skip += 50;
    }
    console.log(`Group price ranges updated: ${patchedGroups}`);
    console.log(`priceTiersSyncedAt stamp: ${syncedAt}`);
}
