#!/usr/bin/env node
/**
 * Full Shopify sellability sweep across EVERY checkout-ready SKU.
 *
 * A SKU is only truly buyable if:
 *   - its Shopify variant exists
 *   - its parent product status is ACTIVE (DRAFT/ARCHIVED can't be bought via
 *     a /cart permalink)
 *   - the product is published to the Online Store sales channel
 *   - it is availableForSale (inventory policy / tracking permitting)
 *
 * Usage: CONVEX_URL=https://precise-raccoon-123.convex.cloud node scripts/audit_shopify_sellability.mjs
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
const ready = products.filter((p) => has(p.shopifyVariantId));
console.error(`[sell] ${ready.length} checkout-ready SKUs to verify against ${domain}`);

const toGid = (raw) => (String(raw).startsWith("gid://") ? String(raw) : `gid://shopify/ProductVariant/${raw}`);
const nodeMap = new Map();
const gids = ready.map((p) => toGid(p.shopifyVariantId));

const Q = `query($ids:[ID!]!){ nodes(ids:$ids){ ... on ProductVariant {
  id sku price availableForSale inventoryQuantity inventoryPolicy
  inventoryItem { tracked }
  product { id title status publishedAt onlineStoreUrl } } } }`;

for (let i = 0; i < gids.length; i += 50) {
  const chunk = gids.slice(i, i + 50);
  const data = await gql(Q, { ids: chunk });
  for (const n of data.nodes) if (n) nodeMap.set(n.id, n);
  process.stderr.write(`\r[sell] ${nodeMap.size}/${gids.length}`);
}
process.stderr.write("\n");

const rows = ready.map((p) => {
  const s = nodeMap.get(toGid(p.shopifyVariantId));
  if (!s) return { graceSku: p.graceSku, family: p.family, problem: "VARIANT_MISSING" };
  const status = s.product?.status ?? null;
  const published = has(s.product?.publishedAt);
  const problems = [];
  if (status !== "ACTIVE") problems.push(`STATUS_${status}`);
  if (!published) problems.push("NOT_PUBLISHED");
  if (s.availableForSale === false) problems.push("NOT_AVAILABLE_FOR_SALE");
  return {
    graceSku: p.graceSku, family: p.family, itemName: p.itemName,
    shopifyProductTitle: s.product?.title ?? null,
    status, publishedAt: s.product?.publishedAt ?? null,
    onlineStoreUrl: s.product?.onlineStoreUrl ?? null,
    availableForSale: s.availableForSale,
    inventoryTracked: s.inventoryItem?.tracked ?? null,
    inventoryQuantity: s.inventoryQuantity, inventoryPolicy: s.inventoryPolicy,
    price: Number(s.price),
    problem: problems.length ? problems.join("+") : null,
  };
});

const blocked = rows.filter((r) => r.problem);
const byProblem = {};
for (const r of blocked) { byProblem[r.problem] = (byProblem[r.problem] ?? 0) + 1; }
const byFamilyBlocked = {};
for (const r of blocked) { const f = r.family ?? "(none)"; byFamilyBlocked[f] = (byFamilyBlocked[f] ?? 0) + 1; }
const trackedCount = rows.filter((r) => r.inventoryTracked === true).length;

const out = {
  generatedAt: new Date().toISOString(),
  deployment: convexUrl, shopifyDomain: domain,
  checkoutReadySkus: ready.length,
  verifiedInShopify: rows.filter((r) => r.problem !== "VARIANT_MISSING").length,
  trulySellable: rows.length - blocked.length,
  blocked: blocked.length,
  byProblem, byFamilyBlocked,
  inventoryTrackedSkus: trackedCount,
  inventoryUntrackedSkus: rows.length - trackedCount,
};

const dir = resolve(REPO, "data/audits/launch-readiness-2026-07-29");
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, "shopify-sellability-prod.json"), JSON.stringify(out, null, 2));
writeFileSync(resolve(dir, "shopify-blocked-skus-prod.json"), JSON.stringify(blocked, null, 2));

console.log(JSON.stringify(out, null, 2));
