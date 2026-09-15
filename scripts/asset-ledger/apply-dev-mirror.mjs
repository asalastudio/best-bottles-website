#!/usr/bin/env node
/**
 * Apply data/asset-ledger/dev-mirror-plan-2026-09-14.json to the DEV deployment.
 * Every write is additive or an evidence-backed field correction taken from the
 * production record; nothing is deleted, no bulk import, no --replace.
 *
 *   node scripts/asset-ledger/apply-dev-mirror.mjs            # dry run
 *   node scripts/asset-ledger/apply-dev-mirror.mjs --apply
 *
 * Internal mutations run through `npx convex run` against CONVEX_DEPLOYMENT
 * (dev). Public mutations use BEST_BOTTLES_CONVEX_WRITE_TOKEN.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";

const apply = process.argv.includes("--apply");
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!/helpful-elephant-638/.test(url ?? "")) throw new Error(`refusing: NEXT_PUBLIC_CONVEX_URL is not the dev deployment (${url})`);
if (!/^dev:/.test(process.env.CONVEX_DEPLOYMENT ?? "")) throw new Error(`refusing: CONVEX_DEPLOYMENT is not a dev deployment (${process.env.CONVEX_DEPLOYMENT})`);
const token = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
if (!token) throw new Error("BEST_BOTTLES_CONVEX_WRITE_TOKEN missing");
const plan = JSON.parse(readFileSync("data/asset-ledger/dev-mirror-plan-2026-09-14.json", "utf8"));
const joins = JSON.parse(readFileSync("data/asset-ledger/exact-component-matches-2026-09-14.json", "utf8"));
const prodDump = JSON.parse(readFileSync("data/asset-ledger/prod-products-dump.json", "utf8"));
const convex = new ConvexHttpClient(url);
const log = [];
const note = (step, detail) => { log.push({ at: new Date().toISOString(), step, detail }); console.log(`${apply ? "APPLY" : "DRY  "} ${step}: ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 300)}`); };
const runInternal = (fn, args) => {
    if (!apply) return { dryRun: true };
    const out = execFileSync("npx", ["convex", "run", fn, JSON.stringify(args)], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    try { return JSON.parse(out.trim().split("\n").pop()); } catch { return { raw: out.trim().slice(-200) }; }
};
const lookup = async (sku) => (await convex.query(api.products.lookupSku, { sku }))?.product ?? null;

// 1. groups
for (const g of plan.groups) {
    const existing = (await convex.query(api.products.getAllCatalogGroups, {})).find((x) => x.slug === g.slug);
    if (existing) { note("group.skip", `${g.slug} already on dev`); continue; }
    note("group.add", runInternal("migrations:addProductGroup", g));
}
// 2. products from twins, then the prod fields the twin copy cannot carry
let created = 0, skipped = 0;
for (const p of plan.products) {
    if (await lookup(p.websiteSku)) { skipped++; continue; }
    const args = { writeToken: token, twinWebsiteSku: p.twinWebsiteSku, websiteSku: p.websiteSku, graceSku: p.graceSku, groupSlug: p.groupSlug,
        color: p.color, capColor: p.capColor, itemName: p.itemName, itemDescription: p.itemDescription, priceTiers: p.priceTiers, source: p.source };
    if (!apply) { note("product.create", `${p.websiteSku} <- twin ${p.twinWebsiteSku} in ${p.groupSlug}`); created++; continue; }
    const r = await convex.mutation(api.products.createProductFromTwin, args);
    note("product.create", `${p.websiteSku}: ${r.detail}`);
    if (!r.created) continue;
    created++;
    const doc = await lookup(p.websiteSku);
    if (!doc) { note("product.postpatch.miss", p.websiteSku); continue; }
    const fields = { ...p.postPatch, shopifySellable: p.shopify.sellable, shopifySellableReason: p.shopify.reason ?? null };
    note("product.postpatch", { sku: p.websiteSku, result: runInternal("migrations:patchProductFields", { patches: [{ id: doc._id, fields }] }) });
}
note("products", { created, skipped });
// 3. Shopify ids from the prod records (the variants already exist in the shared store)
const patches = plan.products.filter((p) => p.shopify.variantId).map((p) => ({ sku: p.websiteSku, shopifyVariantId: p.shopify.variantId, ...(p.shopify.inventoryItemId ? { shopifyInventoryItemId: p.shopify.inventoryItemId } : {}) }));
for (let i = 0; i < patches.length; i += 25) {
    const batch = patches.slice(i, i + 25);
    note("shopify.ids", apply ? await convex.action(api.backfillShopifyIds.applyVariantBatch, { patches: batch, batchIndex: i / 25 }) : `${batch.length} patches (batch ${i / 25})`);
}
// 4. component stock drift (prod is the Shopify-synced truth)
for (const s of plan.stock) {
    const doc = await lookup(s.websiteSku);
    if (!doc || doc.stockStatus !== s.from) { note("stock.skip", `${s.websiteSku} now '${doc?.stockStatus}'`); continue; }
    note("stock", { sku: s.websiteSku, from: s.from, to: s.to, result: runInternal("migrations:patchProductFields", { patches: [{ id: doc._id, fields: { stockStatus: s.to } }] }) });
}
// 5. tassel applicator from the catalogue name
for (const a of plan.applicator) {
    const doc = await lookup(a.websiteSku);
    if (!doc || doc.applicator !== a.from) { note("applicator.skip", `${a.websiteSku} now '${doc?.applicator}'`); continue; }
    note("applicator", { sku: a.websiteSku, to: a.to, result: runInternal("migrations:patchProductFields", { patches: [{ id: doc._id, fields: { applicator: a.to } }] }) });
}
// 6. listing gaps: a component product exists for the closure the bottle names, but the bottle does not list it
const strip = JSON.parse(readFileSync("data/legacy/legacy-catalog.json", "utf8")).rows;
for (const g of joins.listingGaps) {
    const bottle = await lookup(g.sku); const comp = await lookup(g.componentSku);
    if (!bottle || !comp) { note("listing.skip", `${g.sku}: ${!bottle ? "bottle" : "component"} not on dev`); continue; }
    const listed = Array.isArray(bottle.components) ? bottle.components : [];
    if (listed.some((c) => c.grace_sku === comp.graceSku)) { note("listing.skip", `${g.sku} already lists ${g.componentSku}`); continue; }
    const page = strip.find((r) => r.sku === g.sku);
    const image = comp.imageUrl ?? prodDump.find((p) => p.websiteSku === g.componentSku)?.imageUrl
        ?? (page?.images?.caps ?? []).map((u) => `https://www.bestbottles.com/${u.replace(/^\/+/, "")}`).find((u) => u.toLowerCase().includes(g.componentSku.replace(/^CP/i, "").toLowerCase().replace("13-415", "13-415cp")))
        ?? null;
    const entry = { grace_sku: comp.graceSku, image_url: image, item_name: comp.itemName, price_1: comp.webPrice1pc ?? null, price_12: comp.webPrice12pc ?? null };
    note("listing.add", { sku: g.sku, add: g.componentSku, evidence: g.evidence, result: runInternal("migrations:patchProductComponentsBatch", { patches: [{ id: bottle._id, components: [...listed, entry] }] }) });
}
writeFileSync(`data/asset-ledger/dev-mirror-${apply ? "applied" : "dryrun"}-2026-09-14.json`, JSON.stringify({ apply, deployment: url, log }, null, 1) + "\n");
console.log(`\n${apply ? "applied" : "dry run"}: ${log.length} steps logged`);
