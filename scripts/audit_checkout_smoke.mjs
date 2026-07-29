#!/usr/bin/env node
/**
 * Live checkout smoke test.
 *
 * Samples real SKUs across every family + every price tier from prod Convex,
 * POSTs them through the app's own /api/shopify/resolve-variants route, and
 * verifies Shopify returns a real checkout URL for each.
 *
 * Nothing is purchased — the test stops at the checkout URL.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 CONVEX_URL=https://precise-raccoon-123.convex.cloud \
 *     node scripts/audit_checkout_smoke.mjs
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

const BASE = process.env.BASE_URL || "http://localhost:3000";
const url = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
const client = new ConvexHttpClient(url);

const products = [];
let cursor = null;
for (;;) {
  const res = await client.action(api.products.getProductExportPage, { cursor, numItems: 500 });
  products.push(...res.page);
  cursor = res.continueCursor;
  if (res.isDone) break;
}
console.error(`[smoke] ${products.length} products from ${url}; app=${BASE}`);

const has = (v) => v !== null && v !== undefined && v !== "";
const num = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;
const ready = products.filter((p) => has(p.shopifyVariantId));

// ── Sample selection ────────────────────────────────────────────────────────
// 1 SKU per family, plus the cheapest / most expensive SKU overall, plus SKUs
// that exercise each distinct price tier (1pc / 10pc / 12pc present).
const samples = new Map();
const add = (p, why) => { if (p && !samples.has(p.graceSku)) samples.set(p.graceSku, { p, why }); };

const families = [...new Set(ready.map((p) => p.family))];
for (const f of families) add(ready.find((p) => p.family === f && num(p.webPrice1pc)), `family:${f}`);

const priced = ready.filter((p) => num(p.webPrice1pc)).sort((a, b) => a.webPrice1pc - b.webPrice1pc);
add(priced[0], "cheapest");
add(priced[priced.length - 1], "most-expensive");
add(priced[Math.floor(priced.length / 2)], "median-price");
add(ready.find((p) => num(p.webPrice10pc)), "has-10pc-tier");
add(ready.find((p) => num(p.webPrice12pc)), "has-12pc-tier");
add(ready.find((p) => num(p.webPrice10pc) && num(p.webPrice12pc)), "has-10pc+12pc-tiers");
add(ready.find((p) => !num(p.webPrice1pc)), "checkoutable-but-unpriced");

const list = [...samples.values()];
console.error(`[smoke] testing ${list.length} sample SKUs`);

// ── Test each individually ──────────────────────────────────────────────────
const results = [];
for (const { p, why } of list) {
  const body = {
    items: [{
      sku: p.graceSku,
      websiteSku: p.websiteSku ?? null,
      shopifyVariantId: p.shopifyVariantId ?? null,
      quantity: 1,
    }],
  };
  let status = 0, json = null, err = null;
  try {
    const res = await fetch(`${BASE}/api/shopify/resolve-variants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    status = res.status;
    json = await res.json();
  } catch (e) { err = String(e); }
  const ok = status === 200 && typeof json?.checkoutUrl === "string" && json.checkoutUrl.startsWith("https://");
  results.push({
    why, graceSku: p.graceSku, family: p.family,
    price1pc: p.webPrice1pc ?? null, price10pc: p.webPrice10pc ?? null, price12pc: p.webPrice12pc ?? null,
    status, ok, checkoutUrl: json?.checkoutUrl ?? null,
    unmatchedSkus: json?.unmatchedSkus ?? null, unavailableSkus: json?.unavailableSkus ?? null,
    error: err ?? json?.error ?? null,
  });
  console.error(`  ${ok ? "PASS" : "FAIL"}  ${p.graceSku.padEnd(26)} ${why}`);
}

// ── Multi-line mixed cart (checkout-ready + quote-only together) ────────────
const quoteOnly = products.find((p) => !has(p.shopifyVariantId));
const mixed = {
  items: [
    { sku: priced[0].graceSku, shopifyVariantId: priced[0].shopifyVariantId, quantity: 2 },
    { sku: priced[10].graceSku, shopifyVariantId: priced[10].shopifyVariantId, quantity: 3 },
    ...(quoteOnly ? [{ sku: quoteOnly.graceSku, shopifyVariantId: null, quantity: 1 }] : []),
  ],
};
const mixedRes = await fetch(`${BASE}/api/shopify/resolve-variants`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(mixed),
});
const mixedJson = await mixedRes.json();
console.error(`\n[smoke] mixed cart status=${mixedRes.status} url=${mixedJson.checkoutUrl ?? "none"}`);

const failed = results.filter((r) => !r.ok);
const out = {
  generatedAt: new Date().toISOString(),
  app: BASE, deployment: url,
  sampled: results.length, passed: results.length - failed.length, failed: failed.length,
  mixedCart: { status: mixedRes.status, checkoutUrl: mixedJson.checkoutUrl ?? null, unmatchedSkus: mixedJson.unmatchedSkus ?? null },
  results,
};
const dir = resolve(REPO, "data/audits/launch-readiness-2026-07-29");
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, "checkout-smoke-prod.json"), JSON.stringify(out, null, 2));

console.log(`\nSampled ${out.sampled} · Passed ${out.passed} · Failed ${out.failed}`);
for (const r of failed) console.log(`  FAIL ${r.graceSku} (${r.why}) status=${r.status} err=${r.error}`);
