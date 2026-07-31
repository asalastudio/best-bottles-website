#!/usr/bin/env node
/**
 * Economics of the TYPICAL Best Bottles order (100–1,000 units).
 *
 * Answers, from live production data:
 *   1. Which priceTiers breakpoint does a typical order actually land on?
 *   2. What does the PDP show at that quantity vs. what the ladder offers?
 *   3. What does Shopify actually charge (flat 1pc) vs. the tier price?
 *   4. What share of typical orders clear the $99 free-shipping threshold?
 *   5. How does the order compare to case quantity (partial vs full cases)?
 *
 * Read-only.
 *
 * Usage: CONVEX_URL=https://precise-raccoon-123.convex.cloud node scripts/audit_typical_order_economics.mjs
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

const client = new ConvexHttpClient(process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL);

const products = [];
let cursor = null;
for (;;) {
  const res = await client.action(api.products.getProductExportPage, { cursor, numItems: 500 });
  products.push(...res.page);
  cursor = res.continueCursor;
  if (res.isDone) break;
}

const num = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;
const FREE_SHIPPING_THRESHOLD = 99;
const ORDER_SIZES = [100, 250, 500, 1000];

// What the PDP renders today: only webPrice1pc / webPrice10pc / webPrice12pc.
function pdpShownUnitPrice(p, qty) {
  const p1 = p.webPrice1pc;
  if (!num(p1)) return null;
  const p12 = num(p.webPrice12pc) && p.webPrice12pc < p1 ? p.webPrice12pc : null;
  const p10 = num(p.webPrice10pc) && p.webPrice10pc < p1 ? p.webPrice10pc : null;
  if (p12 && qty >= 12) return p12;
  if (p10 && qty >= 10) return p10;
  return p1;
}

// What the real ladder offers at this quantity.
function ladderUnitPrice(p, qty) {
  if (!Array.isArray(p.priceTiers) || p.priceTiers.length === 0) return null;
  const eligible = p.priceTiers.filter((t) => qty >= t.minQty).sort((a, b) => b.minQty - a.minQty)[0];
  return eligible ? eligible.unitPrice : null;
}

function ladderBreakpoint(p, qty) {
  if (!Array.isArray(p.priceTiers)) return null;
  const eligible = p.priceTiers.filter((t) => qty >= t.minQty).sort((a, b) => b.minQty - a.minQty)[0];
  return eligible ? eligible.minQty : null;
}

const priced = products.filter((p) => num(p.webPrice1pc) && Array.isArray(p.priceTiers) && p.priceTiers.length > 0);

const report = { generatedAt: new Date().toISOString(), skusAnalyzed: priced.length, orderSizes: {} };

for (const qty of ORDER_SIZES) {
  const breakpointHist = {};
  let hiddenSavingsTotal = 0;      // ladder vs what PDP shows
  let shopifyOverchargeTotal = 0;  // ladder vs what Shopify charges (flat 1pc)
  let clearsFreeShipping = 0;
  let partialCase = 0;
  let withDeeperTier = 0;
  const examples = [];

  for (const p of priced) {
    const bp = ladderBreakpoint(p, qty);
    if (bp != null) breakpointHist[bp] = (breakpointHist[bp] ?? 0) + 1;

    const ladder = ladderUnitPrice(p, qty);
    const shown = pdpShownUnitPrice(p, qty);
    if (ladder != null && shown != null && ladder < shown) {
      withDeeperTier++;
      hiddenSavingsTotal += (shown - ladder) * qty;
    }
    if (ladder != null) {
      // Shopify charges the flat 1pc price regardless of quantity.
      shopifyOverchargeTotal += (p.webPrice1pc - ladder) * qty;
    }
    if (p.webPrice1pc * qty >= FREE_SHIPPING_THRESHOLD) clearsFreeShipping++;
    if (num(p.caseQuantity) && qty % p.caseQuantity !== 0) partialCase++;

    if (examples.length < 5 && ladder != null && shown != null && ladder < shown) {
      examples.push({
        graceSku: p.graceSku,
        caseQuantity: p.caseQuantity ?? null,
        pdpShows: shown,
        ladderOffers: ladder,
        ladderBreakpoint: bp,
        shopifyCharges: p.webPrice1pc,
        orderTotalAtLadder: +(ladder * qty).toFixed(2),
        orderTotalAtShopify: +(p.webPrice1pc * qty).toFixed(2),
        overchargePerOrder: +((p.webPrice1pc - ladder) * qty).toFixed(2),
      });
    }
  }

  report.orderSizes[qty] = {
    tierBreakpointsHit: Object.fromEntries(
      Object.entries(breakpointHist).sort((a, b) => Number(a[0]) - Number(b[0])),
    ),
    skusWhereLadderBeatsWhatPdpShows: withDeeperTier,
    pctSkusWithHiddenBetterPrice: ((withDeeperTier / priced.length) * 100).toFixed(1) + "%",
    avgHiddenSavingsPerSkuOrder: +(hiddenSavingsTotal / priced.length).toFixed(2),
    avgShopifyOverchargePerSkuOrder: +(shopifyOverchargeTotal / priced.length).toFixed(2),
    pctOrdersClearingFreeShipping: ((clearsFreeShipping / priced.length) * 100).toFixed(1) + "%",
    pctPartialCase: ((partialCase / priced.length) * 100).toFixed(1) + "%",
    examples,
  };
}

const dir = resolve(REPO, "data/audits/launch-readiness-2026-07-29");
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, "typical-order-economics.json"), JSON.stringify(report, null, 2));

console.log(`SKUs analyzed: ${report.skusAnalyzed}\n`);
for (const qty of ORDER_SIZES) {
  const r = report.orderSizes[qty];
  console.log(`── ORDER OF ${qty} UNITS ──`);
  console.log(`   tier breakpoints hit:      ${JSON.stringify(r.tierBreakpointsHit)}`);
  console.log(`   SKUs w/ better hidden price: ${r.skusWhereLadderBeatsWhatPdpShows} (${r.pctSkusWithHiddenBetterPrice})`);
  console.log(`   avg hidden saving/order:   $${r.avgHiddenSavingsPerSkuOrder}`);
  console.log(`   avg Shopify OVERCHARGE:    $${r.avgShopifyOverchargePerSkuOrder}`);
  console.log(`   orders clearing $99 free shipping: ${r.pctOrdersClearingFreeShipping}`);
  console.log(`   partial-case orders:       ${r.pctPartialCase}\n`);
}
console.log("Example at 500 units:");
for (const e of report.orderSizes[500].examples.slice(0, 3)) {
  console.log(`   ${e.graceSku}: PDP shows $${e.pdpShows}/ea, ladder@${e.ladderBreakpoint} offers $${e.ladderOffers}/ea, Shopify charges $${e.shopifyCharges}/ea → overcharge $${e.overchargePerOrder}`);
}
