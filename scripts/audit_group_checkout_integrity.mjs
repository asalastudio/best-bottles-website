#!/usr/bin/env node
/**
 * Group-level checkout integrity: joins products → productGroups on the real
 * FK (products.productGroupId) and reports every group whose PDP cannot
 * complete a Shopify checkout.
 *
 * Usage: CONVEX_URL=https://precise-raccoon-123.convex.cloud node scripts/audit_group_checkout_integrity.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");

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

const url = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
const client = new ConvexHttpClient(url);
console.error(`[audit] ${url}`);

const products = [];
let cursor = null;
for (;;) {
  const res = await client.action(api.products.getProductExportPage, { cursor, numItems: 500 });
  products.push(...res.page);
  cursor = res.continueCursor;
  if (res.isDone) break;
}
const groups = await client.query(api.products.getAllCatalogGroups, {});
console.error(`[audit] ${products.length} products / ${groups.length} groups`);

const has = (v) => v !== null && v !== undefined && v !== "";
const num = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;

// products carry _id of their group in productGroupId; groups carry _id
const byGroupId = new Map();
for (const p of products) {
  const gid = p.productGroupId;
  if (!gid) continue;
  if (!byGroupId.has(gid)) byGroupId.set(gid, []);
  byGroupId.get(gid).push(p);
}

const orphanProducts = products.filter((p) => !p.productGroupId);
const rows = groups.map((g) => {
  const skus = byGroupId.get(g._id) ?? [];
  const ready = skus.filter((p) => has(p.shopifyVariantId));
  const priced = skus.filter((p) => num(p.webPrice1pc));
  return {
    slug: g.slug,
    displayName: g.displayName,
    family: g.family,
    declaredVariantCount: g.variantCount,
    actualSkus: skus.length,
    checkoutReadySkus: ready.length,
    pricedSkus: priced.length,
    heroImage: has(g.heroImageUrl),
    priceRangeMin: g.priceRangeMin ?? null,
  };
});

const emptyGroups = rows.filter((r) => r.actualSkus === 0);
const noCheckoutGroups = rows.filter((r) => r.actualSkus > 0 && r.checkoutReadySkus === 0);
const partialCheckout = rows.filter((r) => r.checkoutReadySkus > 0 && r.checkoutReadySkus < r.actualSkus);
const countDrift = rows.filter((r) => r.actualSkus > 0 && r.declaredVariantCount !== r.actualSkus);

const out = {
  deployment: url,
  generatedAt: new Date().toISOString(),
  totals: { products: products.length, groups: groups.length },
  orphanProductsWithNoGroup: orphanProducts.length,
  groupsWithZeroSkus: emptyGroups.length,
  groupsWithSkusButNoCheckout: noCheckoutGroups.length,
  groupsWithPartialCheckout: partialCheckout.length,
  groupsWithVariantCountDrift: countDrift.length,
  detail: { emptyGroups, noCheckoutGroups, partialCheckout, countDrift },
  orphanProductSample: orphanProducts.slice(0, 40).map((p) => ({ graceSku: p.graceSku, family: p.family, itemName: p.itemName })),
};

const dir = resolve(REPO, "data/audits/launch-readiness-2026-07-29");
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, "group-checkout-integrity-prod.json"), JSON.stringify(out, null, 2));

console.log(JSON.stringify({
  ...out.totals,
  orphanProductsWithNoGroup: out.orphanProductsWithNoGroup,
  groupsWithZeroSkus: out.groupsWithZeroSkus,
  groupsWithSkusButNoCheckout: out.groupsWithSkusButNoCheckout,
  groupsWithPartialCheckout: out.groupsWithPartialCheckout,
  groupsWithVariantCountDrift: out.groupsWithVariantCountDrift,
}, null, 2));
console.log("\nEMPTY GROUPS (dead PDPs):");
for (const g of emptyGroups) console.log(`  ${g.slug}  [${g.family}]  declared=${g.declaredVariantCount}`);
console.log("\nGROUPS WITH SKUS BUT NO CHECKOUT:");
for (const g of noCheckoutGroups) console.log(`  ${g.slug}  skus=${g.actualSkus}`);
console.log("\nPARTIAL CHECKOUT GROUPS:");
for (const g of partialCheckout) console.log(`  ${g.slug}  ${g.checkoutReadySkus}/${g.actualSkus} ready`);
