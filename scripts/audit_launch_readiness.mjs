#!/usr/bin/env node
/**
 * Launch-readiness audit: pulls every product + productGroup from a Convex
 * deployment and reports checkout / price / image coverage.
 *
 * Usage:
 *   node audit_launch_readiness.mjs                 # dev (from .env.local)
 *   CONVEX_URL=https://precise-raccoon-123.convex.cloud node audit_launch_readiness.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { ConvexHttpClient } from "convex/browser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(REPO, ".env.local"), "utf-8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if (v.includes("#")) v = v.slice(0, v.indexOf("#")).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {}
}
loadEnvLocal();

const url = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
if (!url) { console.error("no convex url"); process.exit(1); }
console.error(`[audit] deployment: ${url}`);

const { api } = await import(resolve(REPO, "convex/_generated/api.js"));
const client = new ConvexHttpClient(url);

// ── Pull all products ────────────────────────────────────────────────────────
const products = [];
let cursor = null;
for (;;) {
  const res = await client.action(api.products.getProductExportPage, { cursor, numItems: 500 });
  products.push(...res.page);
  cursor = res.continueCursor;
  process.stderr.write(`\r[audit] products: ${products.length}`);
  if (res.isDone) break;
}
process.stderr.write("\n");

const groups = await client.query(api.products.getAllCatalogGroups, {});
console.error(`[audit] groups: ${groups.length}`);

// ── Metrics ──────────────────────────────────────────────────────────────────
const has = (v) => v !== null && v !== undefined && v !== "";
const num = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;

const checkoutReady = products.filter((p) => has(p.shopifyVariantId));
const noVariant = products.filter((p) => !has(p.shopifyVariantId));
const noPrice = products.filter((p) => !num(p.webPrice1pc));
const priceButNoVariant = products.filter((p) => num(p.webPrice1pc) && !has(p.shopifyVariantId));
const variantButNoPrice = products.filter((p) => has(p.shopifyVariantId) && !num(p.webPrice1pc));
const noImage = products.filter((p) => !has(p.imageUrl) && !has(p.primaryImageUrl));

// per-family breakdown of checkout gap
const byFamily = {};
for (const p of products) {
  const f = p.family || "(none)";
  byFamily[f] ??= { total: 0, ready: 0, priced: 0, imaged: 0 };
  byFamily[f].total++;
  if (has(p.shopifyVariantId)) byFamily[f].ready++;
  if (num(p.webPrice1pc)) byFamily[f].priced++;
  if (has(p.imageUrl) || has(p.primaryImageUrl)) byFamily[f].imaged++;
}

// group-level: does the group have ANY checkout-ready SKU?
const skusByGroupKey = {};
for (const p of products) {
  const key = [p.family, p.capacityMl, p.color].join("|");
  skusByGroupKey[key] ??= [];
  skusByGroupKey[key].push(p);
}
const groupsNoReadySku = [];
for (const g of groups) {
  const key = [g.family, g.capacityMl, g.color].join("|");
  const skus = skusByGroupKey[key] ?? [];
  const ready = skus.filter((p) => has(p.shopifyVariantId));
  if (ready.length === 0) groupsNoReadySku.push({ slug: g.slug, displayName: g.displayName, variantCount: g.variantCount, matchedSkus: skus.length });
}

const groupsNoPriceRange = groups.filter((g) => !num(g.priceRangeMin));
const groupsNoHero = groups.filter((g) => !has(g.heroImageUrl));

const report = {
  deployment: url,
  generatedAt: new Date().toISOString(),
  totals: {
    products: products.length,
    productGroups: groups.length,
  },
  checkout: {
    skusCheckoutReady: checkoutReady.length,
    skusMissingShopifyVariant: noVariant.length,
    pctReady: ((checkoutReady.length / products.length) * 100).toFixed(1) + "%",
    pricedButNotCheckoutable: priceButNoVariant.length,
    checkoutableButUnpriced: variantButNoPrice.length,
  },
  pricing: {
    skusMissingWebPrice1pc: noPrice.length,
    groupsMissingPriceRange: groupsNoPriceRange.length,
  },
  images: {
    skusMissingImage: noImage.length,
    groupsMissingHeroImage: groupsNoHero.length,
  },
  groupsWithZeroCheckoutReadySkus: groupsNoReadySku.length,
  byFamily: Object.fromEntries(
    Object.entries(byFamily)
      .sort((a, b) => (b[1].total - b[1].ready) - (a[1].total - a[1].ready))
      .map(([k, v]) => [k, { ...v, gap: v.total - v.ready }])
  ),
};

const outDir = resolve(REPO, "data/audits/launch-readiness-2026-07-29");
mkdirSync(outDir, { recursive: true });
const tag = url.includes("precise-raccoon") ? "prod" : "dev";
writeFileSync(resolve(outDir, `summary-${tag}.json`), JSON.stringify(report, null, 2));
writeFileSync(resolve(outDir, `groups-no-checkout-sku-${tag}.json`), JSON.stringify(groupsNoReadySku, null, 2));
writeFileSync(resolve(outDir, `skus-missing-variant-${tag}.json`), JSON.stringify(
  noVariant.map((p) => ({ graceSku: p.graceSku, websiteSku: p.websiteSku, family: p.family, itemName: p.itemName, webPrice1pc: p.webPrice1pc ?? null, stockStatus: p.stockStatus ?? null })), null, 2));

console.log(JSON.stringify(report, null, 2));
