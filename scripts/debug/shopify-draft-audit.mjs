#!/usr/bin/env node
// Read-only. For every SKU the sellability dry run reports as blocked, ask Shopify what the parent
// product is and what it would need before it could be sold. Writes nothing to Shopify or Convex.
//   node scripts/debug/shopify-draft-audit.mjs
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
for (const line of readFileSync(resolve(REPO, ".env.local"), "utf-8").split("\n")) {
  const t = line.trim(); if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = t.indexOf("="); const k = t.slice(0, i).trim(); let v = t.slice(i + 1).trim(); if (v.includes("#")) v = v.slice(0, v.indexOf("#")).trim();
  if (!process.env[k]) process.env[k] = v;
}
const domain = (process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
const token = process.env.SHOPIFY_ADMIN_TOKEN;
const blocked = JSON.parse(readFileSync(resolve(REPO, "data/audits/launch-readiness-2026-07-29/sellability-sync-dryrun.json"), "utf-8")).blocked;
const client = new ConvexHttpClient("https://precise-raccoon-123.convex.cloud");
const products = []; let cursor = null;
for (;;) { const r = await client.action(api.products.getProductExportPage, { cursor, numItems: 500 }); products.push(...r.page); cursor = r.continueCursor; if (r.isDone) break; }
const byGrace = new Map(products.map(p => [p.graceSku, p]));
const gid = raw => String(raw).startsWith("gid://") ? String(raw) : `gid://shopify/ProductVariant/${raw}`;
const Q = `query($ids:[ID!]!){ nodes(ids:$ids){ ... on ProductVariant { id sku price inventoryQuantity inventoryPolicy
  inventoryItem { tracked } product { id title status publishedAt createdAt totalInventory featuredImage { url } variantsCount { count } } } } }`;
const rows = blocked.filter(b => b.reason !== "VARIANT_MISSING").map(b => byGrace.get(b.graceSku)).filter(Boolean);
const out = [];
for (let i = 0; i < rows.length; i += 50) {
  const slice = rows.slice(i, i + 50);
  const res = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, { method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token }, body: JSON.stringify({ query: Q, variables: { ids: slice.map(p => gid(p.shopifyVariantId)) } }) });
  const j = await res.json(); if (j.errors) throw new Error(JSON.stringify(j.errors));
  j.data.nodes.forEach((n, k) => out.push({ convex: slice[k], shopify: n }));
}
const fam = {}, prodIds = new Set(); let noPrice = 0, noImage = 0, zeroStockDeny = 0, skuMismatch = 0, convexNoPrice = 0;
for (const { convex: c, shopify: s } of out) {
  const key = `${c.family ?? "?"} · ${c.applicator ?? c.category ?? "?"}`; fam[key] = (fam[key] ?? 0) + 1; prodIds.add(s.product.id);
  if (!(Number(s.price) > 0)) noPrice++;
  if (!s.product.featuredImage) noImage++;
  if (s.inventoryItem?.tracked && s.inventoryQuantity <= 0 && s.inventoryPolicy === "DENY") zeroStockDeny++;
  if (s.sku !== c.websiteSku && s.sku !== c.graceSku) skuMismatch++;
  if (!(c.webPrice1pc > 0)) convexNoPrice++;
}
console.log(JSON.stringify({ blockedSkus: out.length, distinctShopifyProducts: prodIds.size, missingShopifyPrice: noPrice, noFeaturedImage: noImage,
  trackedZeroStockAndDenyOversell: zeroStockDeny, shopifySkuDiffersFromCatalogue: skuMismatch, convexHasNoPrice: convexNoPrice,
  created: [...new Set(out.map(o => o.shopify.product.createdAt.slice(0, 10)))].sort() }, null, 1));
console.log(Object.entries(fam).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${String(v).padStart(4)}  ${k}`).join("\n"));
writeFileSync(resolve(REPO, "data/audits/launch-readiness-2026-07-29/shopify-draft-audit-2026-09-20.json"), JSON.stringify(out.map(o => ({ graceSku: o.convex.graceSku, websiteSku: o.convex.websiteSku, family: o.convex.family, applicator: o.convex.applicator, stockStatus: o.convex.stockStatus, webPrice1pc: o.convex.webPrice1pc, shopify: o.shopify })), null, 1));
