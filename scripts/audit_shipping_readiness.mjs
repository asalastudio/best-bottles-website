#!/usr/bin/env node
/**
 * Shipping readiness audit.
 *
 * Checks the two things that decide whether a customer can be quoted a real
 * shipping rate at checkout:
 *   1. Do Shopify variants carry a weight? (0 lb + requiresShipping breaks
 *      carrier-calculated rates like FedEx/UPS.)
 *   2. Does Convex hold the weight data that Shopify is missing?
 *
 * Read-only.
 *
 * Usage: CONVEX_URL=https://precise-raccoon-123.convex.cloud node scripts/audit_shipping_readiness.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
try {
  for (const line of readFileSync(resolve(REPO, ".env.local"), "utf-8").split("\n")) {
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

const domain = (process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
const token = process.env.SHOPIFY_ADMIN_TOKEN;
const convexUrl = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
const client = new ConvexHttpClient(convexUrl);

async function gql(query, variables, tries = 3) {
  for (let a = 1; a <= tries; a++) {
    try {
      const res = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
        body: JSON.stringify({ query, variables }),
      });
      if (res.status === 429) { await new Promise((r) => setTimeout(r, 2000 * a)); continue; }
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      const j = await res.json();
      if (j.errors?.length) throw new Error(JSON.stringify(j.errors));
      return j.data;
    } catch (e) {
      if (a === tries) throw e;
      await new Promise((r) => setTimeout(r, 1500 * a));
    }
  }
}

const products = [];
let cursor = null;
for (;;) {
  const res = await client.action(api.products.getProductExportPage, { cursor, numItems: 500 });
  products.push(...res.page);
  cursor = res.continueCursor;
  if (res.isDone) break;
}
const has = (v) => v !== null && v !== undefined && v !== "";
const num = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;
const withVariant = products.filter((p) => has(p.shopifyVariantId));

const toGid = (raw) => (String(raw).startsWith("gid://") ? String(raw) : `gid://shopify/ProductVariant/${raw}`);
const Q = `query($ids:[ID!]!){ nodes(ids:$ids){ ... on ProductVariant {
  id sku inventoryItem { requiresShipping measurement { weight { value unit } } } } } }`;

const nodeMap = new Map();
const gids = withVariant.map((p) => toGid(p.shopifyVariantId));
for (let i = 0; i < gids.length; i += 50) {
  const data = await gql(Q, { ids: gids.slice(i, i + 50) });
  for (const n of data.nodes) if (n) nodeMap.set(n.id, n);
  process.stderr.write(`\r[ship] shopify ${nodeMap.size}/${gids.length}`);
}
process.stderr.write("\n");

let zeroWeightRequiresShipping = 0;
let zeroWeightNoShipping = 0;
let hasWeight = 0;
let notFound = 0;
const units = {};
const fixable = [];

for (const p of withVariant) {
  const s = nodeMap.get(toGid(p.shopifyVariantId));
  if (!s) { notFound++; continue; }
  const w = s.inventoryItem?.measurement?.weight;
  const req = s.inventoryItem?.requiresShipping;
  if (w?.unit) units[w.unit] = (units[w.unit] ?? 0) + 1;
  if (num(w?.value)) { hasWeight++; continue; }
  if (req) zeroWeightRequiresShipping++; else zeroWeightNoShipping++;
  fixable.push({
    graceSku: p.graceSku,
    family: p.family,
    convexBottleWeightG: p.bottleWeightG ?? null,
    convexCaseWeightG: p.caseWeightG ?? null,
    convexCaseQuantity: p.caseQuantity ?? null,
    canDeriveFromConvex: num(p.bottleWeightG),
  });
}

const convexHasBottleWeight = products.filter((p) => num(p.bottleWeightG)).length;
const convexHasCaseWeight = products.filter((p) => num(p.caseWeightG)).length;
const blockedButFixable = fixable.filter((f) => f.canDeriveFromConvex).length;

const out = {
  generatedAt: new Date().toISOString(),
  shopifyDomain: domain,
  deployment: convexUrl,
  totals: { products: products.length, withShopifyVariant: withVariant.length, verifiedInShopify: nodeMap.size },
  shopifyWeights: {
    variantsWithRealWeight: hasWeight,
    zeroWeightButRequiresShipping: zeroWeightRequiresShipping,
    zeroWeightNotShippable: zeroWeightNoShipping,
    variantsNotFound: notFound,
    unitsSeen: units,
  },
  convexWeightData: {
    productsWithBottleWeightG: convexHasBottleWeight,
    productsWithCaseWeightG: convexHasCaseWeight,
    zeroWeightVariantsFixableFromConvex: blockedButFixable,
  },
  note:
    "Shopify weight 0 + requiresShipping=true means carrier-calculated rates (FedEx/UPS live rates) " +
    "cannot price the parcel. Flat-rate shipping is unaffected. Convex already holds bottleWeightG for " +
    "most SKUs, so the fix is a push, not a data-collection exercise.",
};

const dir = resolve(REPO, "data/audits/launch-readiness-2026-07-29");
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, "shipping-readiness-prod.json"), JSON.stringify(out, null, 2));
writeFileSync(resolve(dir, "shopify-zero-weight-skus.json"), JSON.stringify(fixable, null, 2));

console.log(JSON.stringify(out, null, 2));
