#!/usr/bin/env node
/**
 * Grace full-catalog coverage audit.
 *
 * Answers: "is Grace pulling the correct FULL catalog from Convex for every
 * single product?" in three deterministic layers (no LLM calls):
 *
 *   1. INTEGRITY  — every product ↔ group link is sound; variantCount and
 *                   priceRange denormalizations match actual membership.
 *   2. REACHABILITY — every product group is findable through Grace's own
 *                   searchCatalog tool (family+capacity+color probe) AND its
 *                   PDP slug resolves via getProductGroup.
 *   3. DEV↔PROD DRIFT — SKU-level diff between the two deployments.
 *
 * Usage:
 *   node scripts/grace_catalog_coverage_audit.mjs <export-dir> [--skip-drift]
 * where <export-dir> contains products/documents.jsonl + productGroups/documents.jsonl
 * from `npx convex export` of the DEV deployment.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";

const DEV_URL = "https://helpful-elephant-638.convex.cloud";
const PROD_URL = "https://precise-raccoon-123.convex.cloud";

const exportDir = process.argv[2];
if (!exportDir) { console.error("usage: node grace_catalog_coverage_audit.mjs <export-dir>"); process.exit(1); }
const skipDrift = process.argv.includes("--skip-drift");

const readJsonl = (p) => readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const products = readJsonl(`${exportDir}/products/documents.jsonl`);
const groups = readJsonl(`${exportDir}/productGroups/documents.jsonl`);
const groupById = new Map(groups.map((g) => [g._id, g]));

// ── Layer 1: integrity ───────────────────────────────────────────────────────
console.log(`\n=== LAYER 1: INTEGRITY (${products.length} products, ${groups.length} groups) ===`);
const issues = [];
const membersByGroup = new Map();
for (const p of products) {
    if (!p.productGroupId) { issues.push({ type: "product_no_group", sku: p.graceSku }); continue; }
    if (!groupById.has(p.productGroupId)) { issues.push({ type: "dangling_group_ref", sku: p.graceSku }); continue; }
    membersByGroup.set(p.productGroupId, (membersByGroup.get(p.productGroupId) ?? []).concat([p]));
    if (typeof p.webPrice1pc !== "number" || p.webPrice1pc <= 0) issues.push({ type: "missing_price", sku: p.graceSku });
    if (!p.itemName?.trim()) issues.push({ type: "missing_itemName", sku: p.graceSku });
}
for (const g of groups) {
    const members = membersByGroup.get(g._id) ?? [];
    if (members.length === 0) issues.push({ type: "empty_group", slug: g.slug });
    if ((g.variantCount ?? 0) !== members.length) issues.push({ type: "variantCount_drift", slug: g.slug, stored: g.variantCount, actual: members.length });
    const prices = members.map((m) => m.webPrice1pc).filter((v) => typeof v === "number" && v > 0);
    if (prices.length) {
        const min = Math.min(...prices), max = Math.max(...prices);
        if (g.priceRangeMin != null && Math.abs(g.priceRangeMin - min) > 0.005) issues.push({ type: "priceRangeMin_drift", slug: g.slug, stored: g.priceRangeMin, actual: min });
        if (g.priceRangeMax != null && Math.abs(g.priceRangeMax - max) > 0.005) issues.push({ type: "priceRangeMax_drift", slug: g.slug, stored: g.priceRangeMax, actual: max });
    }
    if (!g.slug?.trim()) issues.push({ type: "missing_slug", slug: g.displayName });
}
const byType = {};
for (const i of issues) byType[i.type] = (byType[i.type] ?? 0) + 1;
console.log(issues.length === 0 ? "CLEAN — zero integrity issues." : `ISSUES: ${JSON.stringify(byType)}`);
for (const i of issues.slice(0, 15)) console.log("  ", JSON.stringify(i));

// ── Layer 2: reachability through Grace's searchCatalog ─────────────────────
console.log(`\n=== LAYER 2: SEARCH REACHABILITY (${groups.length} groups via grace:searchCatalog on dev) ===`);
const dev = new ConvexHttpClient(DEV_URL);
const unreachable = [];
const slugBroken = [];
let probed = 0;
for (const g of groups) {
    const terms = [g.capacity, g.color, g.family].filter(Boolean).join(" ").replace(/\s+/g, " ").trim() || g.displayName;
    try {
        const results = await dev.query("grace:searchCatalog", { searchTerm: terms, familyLimit: g.family ?? undefined });
        const hit = Array.isArray(results) && results.some((r) => r.slug === g.slug);
        if (!hit) unreachable.push({ slug: g.slug, probe: terms, got: Array.isArray(results) ? results.length : 0 });
    } catch (e) {
        unreachable.push({ slug: g.slug, probe: terms, error: String(e).slice(0, 120) });
    }
    try {
        const pg = await dev.query("products:getProductGroup", { slug: g.slug });
        if (!pg) slugBroken.push(g.slug);
    } catch { slugBroken.push(g.slug); }
    probed++;
    if (probed % 60 === 0) console.log(`  ...${probed}/${groups.length} probed (${unreachable.length} unreachable so far)`);
}
console.log(`Search-reachable: ${groups.length - unreachable.length}/${groups.length} groups (${(100 * (groups.length - unreachable.length) / groups.length).toFixed(1)}%)`);
console.log(`PDP slug resolves: ${groups.length - slugBroken.length}/${groups.length}`);
if (unreachable.length) {
    console.log("Unreachable groups (probe term used):");
    for (const u of unreachable.slice(0, 25)) console.log("  ", u.slug, "←", JSON.stringify(u.probe), u.error ?? `(${u.got} results, none from this group)`);
}
if (slugBroken.length) console.log("Broken slugs:", slugBroken.slice(0, 10));

// ── Layer 3: dev ↔ prod drift ────────────────────────────────────────────────
if (!skipDrift) {
    console.log("\n=== LAYER 3: DEV ↔ PROD SKU DRIFT ===");
    const prod = new ConvexHttpClient(PROD_URL);
    const prodSkus = new Set();
    let cursor = null;
    for (;;) {
        const page = await prod.query("products:getAllForAudit", { limit: 500, cursor });
        for (const p of page.page) prodSkus.add(p.graceSku);
        if (page.isDone) break;
        cursor = page.continueCursor;
    }
    const devSkus = new Set(products.map((p) => p.graceSku));
    const onlyDev = [...devSkus].filter((s) => !prodSkus.has(s));
    const onlyProd = [...prodSkus].filter((s) => !devSkus.has(s));
    console.log(`dev: ${devSkus.size} SKUs | prod: ${prodSkus.size} SKUs`);
    console.log(`In dev but NOT prod: ${onlyDev.length}`);
    console.log(`In prod but NOT dev: ${onlyProd.length}`);
    const famOf = (sku) => products.find((p) => p.graceSku === sku)?.family ?? "?";
    const famCounts = {};
    for (const s of onlyDev) famCounts[famOf(s)] = (famCounts[famOf(s)] ?? 0) + 1;
    console.log("dev-only by family:", JSON.stringify(famCounts));
    if (onlyProd.length) console.log("prod-only sample:", onlyProd.slice(0, 10));
    writeFileSync(new URL("../docs/reviews/dev-prod-sku-drift.json", import.meta.url),
        JSON.stringify({ generatedAt: null, devCount: devSkus.size, prodCount: prodSkus.size, onlyDev, onlyProd }, null, 2));
    console.log("Full drift list → docs/reviews/dev-prod-sku-drift.json");
}
console.log("\nDone.");
