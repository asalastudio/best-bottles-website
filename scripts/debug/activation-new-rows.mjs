#!/usr/bin/env node
// Read-only. Rows the products/update webhook INSERTED for Shopify variants the catalogue never listed.
import { readFileSync, writeFileSync } from "fs"; import { resolve, dirname } from "path"; import { fileURLToPath } from "url";
import { ConvexHttpClient } from "convex/browser"; import { api } from "../../convex/_generated/api.js";
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const before = JSON.parse(readFileSync(resolve(REPO, "data/audits/launch-readiness-2026-07-29/shopify-draft-audit-2026-09-20.json"), "utf-8"));
const expectedExtra = [...new Map(before.map(b => [b.shopify.product.id, b.shopify.product.variantsCount.count])).values()].reduce((a, b) => a + b, 0) - before.length;
const client = new ConvexHttpClient("https://precise-raccoon-123.convex.cloud");
const rows = []; let cursor = null;
for (;;) { const r = await client.action(api.products.getProductExportPage, { cursor, numItems: 500 }); rows.push(...r.page); cursor = r.continueCursor; if (r.isDone) break; }
const since = Date.parse("2026-09-20T19:00:00Z");
const fresh = rows.filter(p => (p._creationTime ?? 0) >= since);
console.log(JSON.stringify({ variantsInActivatedProductsNotInCatalogue: expectedExtra, rowsCreatedSinceActivation: fresh.length, fields: Object.keys(rows[0]).slice(0, 40),
  withWebsiteSku: fresh.filter(p => p.websiteSku).length, withFamily: fresh.filter(p => p.family).length, sample: fresh.slice(0, 5).map(p => ({ graceSku: p.graceSku, itemName: p.itemName, family: p.family, websiteSku: p.websiteSku, price: p.webPrice1pc })) }, null, 1));
writeFileSync(resolve(REPO, "data/audits/shopify-activation-2026-09-20/rows-inserted-by-webhook.json"), JSON.stringify(fresh.map(p => ({ _id: p._id, graceSku: p.graceSku, itemName: p.itemName, _creationTime: p._creationTime })), null, 1));
