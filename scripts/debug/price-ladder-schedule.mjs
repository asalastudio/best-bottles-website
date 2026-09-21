#!/usr/bin/env node
// Read-only. What discount schedule do the live price ladders follow? For every SKU with a ladder,
// the ratio of each rung's price-each to the 1-piece price, grouped by the ladder's quantity breaks.
import { ConvexHttpClient } from "convex/browser"; import { anyApi } from "convex/server";
const c = new ConvexHttpClient("https://precise-raccoon-123.convex.cloud"); const rows = []; let cursor = null;
for (;;) { const r = await c.action(anyApi.products.getProductExportPage, { cursor, numItems: 500 }); rows.push(...r.page); cursor = r.continueCursor; if (r.isDone) break; }
const withLadder = rows.filter(p => Array.isArray(p.priceTiers) && p.priceTiers.length > 1 && p.priceTiers[0].minQty === 1 && p.priceTiers[0].unitPrice > 0);
const byBreaks = new Map();
for (const p of withLadder) { const key = p.priceTiers.map(t => t.minQty).join("/"); (byBreaks.get(key) ?? byBreaks.set(key, []).get(key)).push(p); }
const pct = x => (100 * (1 - x)).toFixed(1);
const quant = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(q * (s.length - 1))]; };
console.log(`${rows.length} products, ${withLadder.length} with a multi-rung ladder starting at 1\n`);
for (const [key, list] of [...byBreaks].sort((a, b) => b[1].length - a[1].length).slice(0, 6)) {
  console.log(`breaks ${key}  —  ${list.length} SKUs`);
  const n = key.split("/").length;
  for (let i = 1; i < n; i++) {
    // two candidate definitions: discount on the PRICE EACH, and on the PACK TOTAL (totalPrice vs qty x 1-piece)
    const each = list.map(p => p.priceTiers[i].unitPrice / p.priceTiers[0].unitPrice);
    const pack = list.map(p => p.priceTiers[i].totalPrice / (p.priceTiers[i].minQty * p.priceTiers[0].unitPrice));
    const round = x => Math.round(100 * (1 - x)); const tally = {}; for (const x of pack) tally[round(x)] = (tally[round(x)] ?? 0) + 1;
    const top = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k}%×${v}`).join("  ");
    console.log(`   ${String(key.split("/")[i]).padStart(5)}+   each: median -${pct(quant(each, .5))}% (p10 -${pct(quant(each, .9))}%, p90 -${pct(quant(each, .1))}%)   pack-total discount, rounded: ${top}`);
  }
}
