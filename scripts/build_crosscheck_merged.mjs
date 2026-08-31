#!/usr/bin/env node
/**
 * Rebuild docs/reviews/audit-2026-08-06/crosscheck-merged.json — one row per
 * PROD Convex product, joined to the live-site scrape. Run after any Convex
 * pricing sync so the reconciliation workbook reflects the current state.
 *
 * Join: product URL (case-insensitive), falling back to websiteSku == siteSku.
 * Site rows with no Convex product are appended with siteStatus
 * "no_convex_row" so the workbook can surface them for Abbas.
 *
 * Usage: node scripts/build_crosscheck_merged.mjs   (always reads PROD)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const DIR = path.join(REPO, "docs/reviews/audit-2026-08-06");
const SCRAPE = path.join(DIR, "live-site-full-scrape.json");
const OUT = path.join(DIR, "crosscheck-merged.json");
const CONVEX_OUT = path.join(DIR, "convex-products-for-crosscheck.json");

function fetchPage(cursor) {
    const out = execFileSync("npx", ["convex", "run", "products:getAllForAudit", JSON.stringify({ limit: 500, cursor }), "--prod"], {
        cwd: REPO, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
    });
    return JSON.parse(out);
}

const products = [];
let cursor = null;
for (;;) {
    const { page, isDone, continueCursor } = fetchPage(cursor);
    products.push(...page);
    process.stderr.write(`  ${products.length}\n`);
    if (isDone) break;
    cursor = continueCursor;
}
writeFileSync(CONVEX_OUT, JSON.stringify(products, null, 1));

const scrape = JSON.parse(readFileSync(SCRAPE, "utf8"));
const byUrl = new Map();
const bySku = new Map();
for (const r of scrape) {
    if (r.url && !byUrl.has(r.url.toLowerCase())) byUrl.set(r.url.toLowerCase(), r);
    if (r.siteSku && !bySku.has(r.siteSku)) bySku.set(r.siteSku, r);
}

const matchedSiteSkus = new Set();
const merged = products.map((p) => {
    const site = (p.productUrl && byUrl.get(p.productUrl.toLowerCase())) || bySku.get(p.websiteSku) || null;
    if (site?.siteSku) matchedSiteSkus.add(site.siteSku);
    const t = (q) => site?.tiers?.find((x) => x.qty === q);
    return {
        graceSku: p.graceSku,
        websiteSku: p.websiteSku,
        productUrl: p.productUrl,
        itemName: p.itemName,
        family: p.family,
        capacity: p.capacity,
        color: p.color,
        capColor: p.capColor,
        caseQuantity: p.caseQuantity,
        neckThreadSize: p.neckThreadSize,
        convex1pc: p.webPrice1pc,
        convex10pc: p.webPrice10pc,
        convex12pc: p.webPrice12pc,
        convexTierCount: (p.priceTiers ?? []).length,
        priceTiersSyncedAt: p.priceTiersSyncedAt,
        siteStatus: site ? site.status : null,
        siteSku: site?.siteSku ?? null,
        itemType: site?.itemType ?? null,
        site1pc: t(1)?.unitPrice ?? null,
        site12Unit: t(12)?.unitPrice ?? null,
        site12Total: t(12)?.lineTotal ?? null,
        siteCapacity: site?.capacity ?? null,
        siteHeightWithCap: site?.heightWithCap ?? null,
        siteHeightWithoutCap: site?.heightWithoutCap ?? null,
        siteDiameter: site?.diameter ?? null,
        siteNeckThread: site?.neckThreadSize ?? null,
        siteItemDescription: site?.itemDescription ?? null,
        tiers: site?.tiers ?? [],
    };
});

// Site pages that matched no Convex product — surface for Abbas. Case-variant
// duplicate URLs share a siteSku, so dedupe on siteSku, not row identity.
const listed = new Set();
for (const r of scrape) {
    if (r.status !== "ok" || matchedSiteSkus.has(r.siteSku) || listed.has(r.siteSku)) continue;
    listed.add(r.siteSku);
    merged.push({
        graceSku: "",
        websiteSku: r.siteSku,
        productUrl: r.url,
        itemName: r.itemDescription ?? "",
        family: "",
        capacity: r.capacity ?? "",
        color: null, capColor: null, caseQuantity: null, neckThreadSize: null,
        convex1pc: null, convex10pc: null, convex12pc: null,
        convexTierCount: 0, priceTiersSyncedAt: null,
        siteStatus: "no_convex_row",
        siteSku: r.siteSku,
        itemType: r.itemType ?? null,
        site1pc: r.tiers.find((t) => t.qty === 1)?.unitPrice ?? null,
        site12Unit: r.tiers.find((t) => t.qty === 12)?.unitPrice ?? null,
        site12Total: r.tiers.find((t) => t.qty === 12)?.lineTotal ?? null,
        siteCapacity: r.capacity ?? null,
        siteHeightWithCap: r.heightWithCap ?? null,
        siteHeightWithoutCap: r.heightWithoutCap ?? null,
        siteDiameter: r.diameter ?? null,
        siteNeckThread: r.neckThreadSize ?? null,
        siteItemDescription: r.itemDescription ?? null,
        tiers: r.tiers,
    });
}

writeFileSync(OUT, JSON.stringify(merged, null, 1));
const okRows = merged.filter((r) => r.siteStatus === "ok");
console.log(`convex products: ${products.length} | merged rows: ${merged.length}`);
console.log(`site-matched ok: ${okRows.length} | no site page: ${merged.filter((r) => r.siteStatus === null).length} | site missing from convex: ${merged.filter((r) => r.siteStatus === "no_convex_row").length} | site no-ladder: ${merged.filter((r) => r.siteStatus === "no_tiers" || r.siteStatus === "error").length}`);
