#!/usr/bin/env node
/**
 * Syncs Shopify sellability into Convex `products.shopifySellable`.
 *
 * WHY: `shopifyVariantId` being present does NOT mean Shopify will sell the
 * item. If the parent product is DRAFT or unpublished, the cart permalink
 * `/cart/<variantId>:<qty>` returns HTTP 410 and the customer lands on a dead
 * checkout. The 2026-07-29 launch audit found 377 such SKUs in production.
 *
 * This script marks those SKUs not-sellable so the storefront routes them to
 * the quote path instead of a broken checkout. It changes NOTHING in Shopify.
 *
 * Dry run (default — writes nothing):
 *   CONVEX_URL=https://precise-raccoon-123.convex.cloud node scripts/sync_shopify_sellability.mjs
 *
 * Apply:
 *   CONVEX_URL=https://precise-raccoon-123.convex.cloud node scripts/sync_shopify_sellability.mjs --apply
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

const APPLY = process.argv.includes("--apply");
const domain = (process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
const shopToken = process.env.SHOPIFY_ADMIN_TOKEN;
const writeToken = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
const convexUrl = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;

if (!domain || !shopToken) { console.error("Missing NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN / SHOPIFY_ADMIN_TOKEN"); process.exit(1); }
if (APPLY && !writeToken) { console.error("Missing BEST_BOTTLES_CONVEX_WRITE_TOKEN — required for --apply"); process.exit(1); }

const client = new ConvexHttpClient(convexUrl);
console.error(`[sync] convex=${convexUrl} shopify=${domain} mode=${APPLY ? "APPLY" : "DRY RUN"}`);

async function gql(query, variables, tries = 3) {
  for (let a = 1; a <= tries; a++) {
    try {
      const res = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": shopToken },
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

// ── Pull products ───────────────────────────────────────────────────────────
const products = [];
let cursor = null;
for (;;) {
  const res = await client.action(api.products.getProductExportPage, { cursor, numItems: 500 });
  products.push(...res.page);
  cursor = res.continueCursor;
  if (res.isDone) break;
}
const withVariant = products.filter((p) => p.shopifyVariantId);
console.error(`[sync] ${products.length} products, ${withVariant.length} carry a Shopify variant id`);

// ── Ask Shopify what is actually sellable ───────────────────────────────────
const toGid = (raw) => (String(raw).startsWith("gid://") ? String(raw) : `gid://shopify/ProductVariant/${raw}`);
const Q = `query($ids:[ID!]!){ nodes(ids:$ids){ ... on ProductVariant {
  id availableForSale product { status publishedAt } } } }`;

const nodeMap = new Map();
const gids = withVariant.map((p) => toGid(p.shopifyVariantId));
for (let i = 0; i < gids.length; i += 50) {
  const data = await gql(Q, { ids: gids.slice(i, i + 50) });
  for (const n of data.nodes) if (n) nodeMap.set(n.id, n);
  process.stderr.write(`\r[sync] shopify ${nodeMap.size}/${gids.length}`);
}
process.stderr.write("\n");

const entries = withVariant.map((p) => {
  const s = nodeMap.get(toGid(p.shopifyVariantId));
  if (!s) return { graceSku: p.graceSku, sellable: false, reason: "VARIANT_MISSING" };
  const problems = [];
  if (s.product?.status !== "ACTIVE") problems.push(`STATUS_${s.product?.status ?? "UNKNOWN"}`);
  if (!s.product?.publishedAt) problems.push("NOT_PUBLISHED");
  if (s.availableForSale === false) problems.push("NOT_AVAILABLE_FOR_SALE");
  return { graceSku: p.graceSku, sellable: problems.length === 0, reason: problems.length ? problems.join("+") : null };
});

const blocked = entries.filter((e) => !e.sellable);
const byReason = {};
for (const e of blocked) byReason[e.reason] = (byReason[e.reason] ?? 0) + 1;

console.log(JSON.stringify({
  mode: APPLY ? "APPLY" : "DRY_RUN",
  totalProducts: products.length,
  withShopifyVariant: withVariant.length,
  sellable: entries.length - blocked.length,
  notSellable: blocked.length,
  byReason,
}, null, 2));

const dir = resolve(REPO, "data/audits/launch-readiness-2026-07-29");
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, `sellability-sync-${APPLY ? "apply" : "dryrun"}.json`), JSON.stringify({ byReason, blocked }, null, 2));

if (!APPLY) {
  console.log("\nDRY RUN — nothing written. Re-run with --apply to patch Convex.");
  process.exit(0);
}

let updated = 0, unchanged = 0;
const notFound = [];
for (let i = 0; i < entries.length; i += 200) {
  const res = await client.mutation(api.products.setShopifySellabilityBatch, {
    writeToken,
    entries: entries.slice(i, i + 200),
  });
  updated += res.updated; unchanged += res.unchanged; notFound.push(...res.notFound);
  process.stderr.write(`\r[sync] patched ${i + Math.min(200, entries.length - i)}/${entries.length}`);
}
process.stderr.write("\n");
console.log(JSON.stringify({ updated, unchanged, notFound: notFound.length }, null, 2));
