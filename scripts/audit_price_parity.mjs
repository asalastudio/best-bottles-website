#!/usr/bin/env node
/**
 * Price parity audit: Convex (what the site DISPLAYS) vs Shopify (what the
 * customer is actually CHARGED).
 *
 * Also reports how many SKUs advertise a volume-discount ladder (10pc / 12pc)
 * on the PDP, since Shopify's cart-permalink checkout charges the flat variant
 * price — any advertised tier that Shopify cannot honor is a mispricing risk.
 *
 * Usage: CONVEX_URL=https://precise-raccoon-123.convex.cloud node scripts/audit_price_parity.mjs
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

async function gql(query, variables) {
  const res = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const j = await res.json();
  if (j.errors?.length) throw new Error(JSON.stringify(j.errors));
  return j.data;
}

const products = [];
let cursor = null;
for (;;) {
  const res = await client.action(api.products.getProductExportPage, { cursor, numItems: 500 });
  products.push(...res.page);
  cursor = res.continueCursor;
  if (res.isDone) break;
}
const num = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;
const has = (v) => v !== null && v !== undefined && v !== "";

// ── Tier advertising footprint ──────────────────────────────────────────────
const withTiers = products.filter((p) => {
  const p1 = p.webPrice1pc;
  if (!num(p1)) return false;
  return (num(p.webPrice10pc) && p.webPrice10pc < p1) || (num(p.webPrice12pc) && p.webPrice12pc < p1);
});

// ── Sample price parity vs Shopify ──────────────────────────────────────────
const ready = products.filter((p) => has(p.shopifyVariantId) && num(p.webPrice1pc));
const step = Math.max(1, Math.floor(ready.length / 150));
const sample = ready.filter((_, i) => i % step === 0).slice(0, 150);

const gids = sample.map((p) => {
  const raw = String(p.shopifyVariantId);
  return raw.startsWith("gid://") ? raw : `gid://shopify/ProductVariant/${raw}`;
});

const shopByGid = new Map();
for (let i = 0; i < gids.length; i += 50) {
  const chunk = gids.slice(i, i + 50);
  const data = await gql(
    `query($ids:[ID!]!){ nodes(ids:$ids){ ... on ProductVariant { id sku price compareAtPrice availableForSale inventoryQuantity inventoryPolicy product { id title status } } } }`,
    { ids: chunk },
  );
  for (const n of data.nodes) if (n) shopByGid.set(n.id, n);
  process.stderr.write(`\r[parity] shopify ${shopByGid.size}/${gids.length}`);
}
process.stderr.write("\n");

const rows = [];
for (const p of sample) {
  const raw = String(p.shopifyVariantId);
  const gid = raw.startsWith("gid://") ? raw : `gid://shopify/ProductVariant/${raw}`;
  const s = shopByGid.get(gid);
  if (!s) { rows.push({ graceSku: p.graceSku, issue: "variant-not-found-in-shopify", convexPrice: p.webPrice1pc }); continue; }
  const shopPrice = Number(s.price);
  const delta = Number((shopPrice - p.webPrice1pc).toFixed(4));
  rows.push({
    graceSku: p.graceSku,
    convexSku: p.websiteSku ?? null,
    shopifySku: s.sku ?? null,
    convexPrice: p.webPrice1pc,
    shopifyPrice: shopPrice,
    delta,
    mismatch: Math.abs(delta) > 0.005,
    skuMismatch: has(s.sku) && has(p.websiteSku) && s.sku !== p.websiteSku && s.sku !== p.graceSku,
    availableForSale: s.availableForSale,
    inventoryQuantity: s.inventoryQuantity,
    inventoryPolicy: s.inventoryPolicy,
    productStatus: s.product?.status ?? null,
  });
}

const mismatches = rows.filter((r) => r.mismatch);
const notFound = rows.filter((r) => r.issue);
const unavailable = rows.filter((r) => r.availableForSale === false);
const draft = rows.filter((r) => r.productStatus && r.productStatus !== "ACTIVE");
const skuMismatch = rows.filter((r) => r.skuMismatch);
const zeroStockDeny = rows.filter((r) => r.inventoryPolicy === "DENY" && (r.inventoryQuantity ?? 0) <= 0);

const out = {
  generatedAt: new Date().toISOString(),
  deployment: convexUrl, shopifyDomain: domain,
  totals: { products: products.length, checkoutReady: ready.length },
  volumeTierAdvertising: {
    skusAdvertisingDiscountLadder: withTiers.length,
    note: "PDP renders a 10pc/12pc 'save X%' ladder for these. Shopify cart-permalink checkout charges the flat variant price unless a Shopify volume/quantity rule exists.",
  },
  parity: {
    sampled: rows.length,
    priceMismatches: mismatches.length,
    variantsNotFoundInShopify: notFound.length,
    shopifySkuFieldMismatch: skuMismatch.length,
    unavailableForSale: unavailable.length,
    nonActiveProducts: draft.length,
    zeroStockWithDenyPolicy: zeroStockDeny.length,
  },
  detail: { mismatches, notFound, unavailable, draft, skuMismatch, zeroStockDeny },
};

const dir = resolve(REPO, "data/audits/launch-readiness-2026-07-29");
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, "price-parity-prod.json"), JSON.stringify(out, null, 2));
writeFileSync(resolve(dir, "price-parity-rows-prod.json"), JSON.stringify(rows, null, 2));

console.log(JSON.stringify({ ...out.totals, ...out.volumeTierAdvertising, ...out.parity }, null, 2));
if (mismatches.length) {
  console.log("\nPRICE MISMATCHES (site shows vs Shopify charges):");
  for (const m of mismatches.slice(0, 25)) console.log(`  ${m.graceSku.padEnd(28)} site=$${m.convexPrice}  shopify=$${m.shopifyPrice}  delta=${m.delta > 0 ? "+" : ""}${m.delta}`);
}
if (unavailable.length) {
  console.log("\nUNAVAILABLE FOR SALE IN SHOPIFY (add-to-cart will fail at checkout):");
  for (const m of unavailable.slice(0, 25)) console.log(`  ${m.graceSku.padEnd(28)} qty=${m.inventoryQuantity} policy=${m.inventoryPolicy} status=${m.productStatus}`);
}
