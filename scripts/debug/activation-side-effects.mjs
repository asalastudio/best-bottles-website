#!/usr/bin/env node
// Read-only. Compare today's catalogue rows with the snapshot taken BEFORE the Shopify activation,
// for the SKUs in the activated products: what did the products/update webhook overwrite?
import { readFileSync, writeFileSync } from "fs"; import { resolve, dirname } from "path"; import { fileURLToPath } from "url";
import { ConvexHttpClient } from "convex/browser"; import { api } from "../../convex/_generated/api.js";
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const before = JSON.parse(readFileSync(resolve(REPO, "data/audits/launch-readiness-2026-07-29/shopify-draft-audit-2026-09-20.json"), "utf-8"));
const client = new ConvexHttpClient("https://precise-raccoon-123.convex.cloud");
const now = new Map(); let cursor = null;
for (;;) { const r = await client.action(api.products.getProductExportPage, { cursor, numItems: 500 }); for (const p of r.page) now.set(p.graceSku, p); cursor = r.continueCursor; if (r.isDone) break; }
let stock = 0, price = 0, gone = 0; const stockFlips = {}, priceChanges = [], restore = [];
for (const b of before) {
  const n = now.get(b.graceSku); if (!n) { gone++; continue; }
  if (n.stockStatus !== b.stockStatus) { stock++; const k = `${b.stockStatus} -> ${n.stockStatus}`; stockFlips[k] = (stockFlips[k] ?? 0) + 1; restore.push({ graceSku: b.graceSku, stockStatus: b.stockStatus }); }
  if (n.webPrice1pc !== b.webPrice1pc) { price++; priceChanges.push(`${b.graceSku}: ${b.webPrice1pc} -> ${n.webPrice1pc}`); }
}
const all = [...now.values()]; const tally = {}; for (const p of all) tally[p.stockStatus ?? "null"] = (tally[p.stockStatus ?? "null"] ?? 0) + 1;
console.log(JSON.stringify({ skusInActivatedProducts: before.length, missingNow: gone, stockStatusChanged: stock, stockFlips, priceChanged: price, priceSamples: priceChanges.slice(0, 6), catalogueStockTally: tally }, null, 1));
writeFileSync(resolve(REPO, "data/audits/shopify-activation-2026-09-20/stock-status-before.json"), JSON.stringify(restore, null, 1));
