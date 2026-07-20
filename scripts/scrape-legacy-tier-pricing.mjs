/**
 * Scrape tiered pricing from legacy bestbottles.com product pages.
 *
 * The legacy PDP encodes the full quantity ladder in its Purchase dropdown:
 *   <option value="12|1044">12&nbsp;pcs&nbsp;-&nbsp$10.26($0.86/pc)</option>
 * Tiers vary per product (1..5 rows). This walks every SKU in the master-truth
 * CSV that has a legacy productUrl, parses the ladder, and writes JSONL —
 * resumable (skips SKUs already in the output file).
 *
 * Read-only against the legacy site; polite pacing. No Convex writes here —
 * loading is a separate reviewed step (cross-reference gate first).
 *
 * Usage:
 *   node scripts/scrape-legacy-tier-pricing.mjs            # full run
 *   node scripts/scrape-legacy-tier-pricing.mjs --limit 20 # smoke
 */
import { createReadStream, existsSync, mkdirSync, readFileSync, appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CSV = "/Users/jordanrichter/Projects/Madison Studio/madison-app/docs/best-bottles-canonical-truth/best-bottles-master-truth.csv";
const OUT_DIR = path.resolve(ROOT, "data/audits/legacy-tier-pricing-2026-07-20");
const OUT = path.join(OUT_DIR, "tiers.jsonl");
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  return i >= 0 ? Number(process.argv[i + 1]) : Infinity;
})();

function parseCsv(text) {
  // Minimal CSV parser handling quoted fields with commas.
  const rows = [];
  let field = "", row = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); field = ""; row = []; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const header = rows[0];
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

function parseTiers(html) {
  const tiers = [];
  const re = /<option[^>]*value="(\d+)\|\d+"[^>]*>([^<]*)<\/option>/g;
  let m;
  while ((m = re.exec(html))) {
    const qty = Number(m[1]);
    const label = m[2].replace(/&nbsp;?/g, " ").replace(/&amp;/g, "&");
    // "12 pcs - $10.26($0.86/pc)"  or  "1 pcs - $0.90/pc"
    const totalMatch = /\$\s*([\d,]+\.?\d*)/.exec(label);
    const perPcMatch = /\(\$([\d.]+)\/pc\)/.exec(label);
    if (!totalMatch) continue;
    const total = Number(totalMatch[1].replace(/,/g, ""));
    const unit = perPcMatch ? Number(perPcMatch[1]) : (qty === 1 ? total : Number((total / qty).toFixed(4)));
    tiers.push({ minQty: qty, totalPrice: total, unitPrice: unit });
  }
  // Dedupe by qty (page may repeat the select) and sort ascending.
  const byQty = new Map();
  for (const t of tiers) if (!byQty.has(t.minQty)) byQty.set(t.minQty, t);
  return [...byQty.values()].sort((a, b) => a.minQty - b.minQty);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const done = new Set();
  if (existsSync(OUT)) {
    for (const line of readFileSync(OUT, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try { done.add(JSON.parse(line).graceSku); } catch {}
    }
  }
  const rows = parseCsv(readFileSync(CSV, "utf8"))
    .filter((r) => r.graceSku && (r.productUrl || "").startsWith("http"))
    .filter((r) => !done.has(r.graceSku));
  console.log(`resume: ${done.size} done | to fetch: ${Math.min(rows.length, LIMIT)}`);

  let ok = 0, empty = 0, fail = 0, n = 0;
  for (const r of rows) {
    if (n++ >= LIMIT) break;
    try {
      const res = await fetch(r.productUrl, { redirect: "follow", headers: { "User-Agent": "BestBottles-pricing-sync/1.0" } });
      if (!res.ok) {
        appendFileSync(OUT, JSON.stringify({ graceSku: r.graceSku, websiteSku: r.websiteSku, url: r.productUrl, error: `http_${res.status}`, tiers: [] }) + "\n");
        fail++;
      } else {
        const tiers = parseTiers(await res.text());
        appendFileSync(OUT, JSON.stringify({ graceSku: r.graceSku, websiteSku: r.websiteSku, family: r.family, url: r.productUrl, tiers, scrapedAt: new Date().toISOString() }) + "\n");
        tiers.length ? ok++ : empty++;
      }
    } catch (e) {
      appendFileSync(OUT, JSON.stringify({ graceSku: r.graceSku, websiteSku: r.websiteSku, url: r.productUrl, error: String(e).slice(0, 120), tiers: [] }) + "\n");
      fail++;
    }
    if ((ok + empty + fail) % 100 === 0) console.log(`progress: ok=${ok} empty=${empty} fail=${fail}`);
    await new Promise((res) => setTimeout(res, 180)); // polite pacing (~5/s)
  }
  console.log(`DONE. tiers=${ok} empty=${empty} failed=${fail} -> ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
