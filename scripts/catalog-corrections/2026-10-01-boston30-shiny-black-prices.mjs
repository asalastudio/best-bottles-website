#!/usr/bin/env node
/**
 * 2026-10-01 — price ladders for three Boston Round 30 ml shiny black roll-ons, approved by Jordan (checklist 8a).
 *
 * The catalogue rows carry no price at all, so the product pages and Build Your Bottle leave them out. Shopify
 * already charges each one the 1-piece price of its shiny gold twin ($1.07 metal roller, $0.92 plastic roller);
 * these are the twins' full ladders. Written through the Team Hub product editor's own mutation (same validation,
 * same change log, same group price-range refresh), and only while the row still has no price.
 *
 *   node scripts/catalog-corrections/2026-10-01-boston30-shiny-black-prices.mjs            # dry run, dev
 *   node scripts/catalog-corrections/2026-10-01-boston30-shiny-black-prices.mjs --apply    # write, dev
 *   node scripts/catalog-corrections/2026-10-01-boston30-shiny-black-prices.mjs --prod [--apply]
 * Revert from the Team Hub history (each ladder is one logged change).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, "");
}
const PROD_URL = "https://precise-raccoon-123.convex.cloud";
const prod = process.argv.includes("--prod");
const apply = process.argv.includes("--apply");
const url = prod ? PROD_URL : process.env.NEXT_PUBLIC_CONVEX_URL;
const writeToken = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
if (!url || !writeToken) { console.error("NEXT_PUBLIC_CONVEX_URL and BEST_BOTTLES_CONVEX_WRITE_TOKEN must be set in .env.local"); process.exit(1); }
if (!prod && url === PROD_URL) { console.error(".env.local points at prod; pass --prod explicitly"); process.exit(1); }

const METAL = [[1, 1.07], [12, 1.02], [144, 0.96], [360, 0.91], [1800, 0.83]];
const PLASTIC = [[1, 0.92], [12, 0.87], [144, 0.83], [360, 0.78], [1800, 0.72]];
/** [website SKU, its shiny gold twin, ladder] */
const LADDERS = [
    ["GBBstnAmb1ozMtlRollonShnBlk", "GBBstnAmb1ozMtlRollonGl", METAL],
    ["GBBstnAmb1ozRollonShnBlk", "GBBstnAmb1ozRollonGl", PLASTIC],
    ["GBBstnBlu1ozRollonShnBlk", "GBBstnBlu1ozRollonGl", PLASTIC],
];
const actor = { id: "catalog-correction (Build Your Bottle checklist 8a, approved by Jordan)", email: null };

const client = new ConvexHttpClient(url);
console.log(`${prod ? "PROD" : "dev"} ${apply ? "APPLY" : "dry run"}`);
let problems = 0;
for (const [sku, twinSku, ladder] of LADDERS) {
    const [row, twin] = await Promise.all([sku, twinSku].map(async s => (await client.query("products:lookupSku", { sku: s }))?.product ?? null));
    if (!row || row.websiteSku !== sku) { console.log(`  ${sku}: not found`); problems++; continue; }
    const rungs = ladder.map(([minQty, unitPrice]) => ({ minQty, unitPrice }));
    const twinRungs = (twin?.priceTiers ?? []).map(t => ({ minQty: t.minQty, unitPrice: t.unitPrice }));
    if (JSON.stringify(twinRungs) !== JSON.stringify(rungs)) console.log(`  note: ${twinSku}'s ladder is now ${JSON.stringify(twinRungs)}`);
    const has = (row.priceTiers ?? []).length > 0 || typeof row.webPrice1pc === "number";
    if (has) { console.log(`  ${sku}: already priced (${row.webPrice1pc}); left alone`); continue; }
    if (!apply) { console.log(`  would set ${sku}: ${rungs.map(r => `${r.minQty} @ $${r.unitPrice.toFixed(2)}`).join(" · ")}`); continue; }
    const result = await client.mutation("staffProductEdits:updateProduct", { writeToken, productId: row._id, expect: { priceTiers: [] }, patch: { priceTiers: rungs }, actor });
    if (!result.ok) { console.log(`  ${sku}: refused: ${result.error}`); problems++; continue; }
    console.log(`  set ${sku}: ${rungs.map(r => `${r.minQty} @ $${r.unitPrice.toFixed(2)}`).join(" · ")} (log ${result.priceLogId})`);
}
if (problems) process.exitCode = 1;
