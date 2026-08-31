#!/usr/bin/env node
/**
 * Full product scrape of bestbottles.com — EVERY field, EVERY pricing tier.
 *
 * Why this exists: data/bestbottles_raw_website_data.json (Feb 2026) captured
 * only `price1pc`. Convex's `webPrice12pc` came from elsewhere and a 70-SKU
 * cross-check showed it is semantically inconsistent — sometimes the per-piece
 * price at 12, sometimes the 12-piece TOTAL, sometimes matching nothing on the
 * page. The live site is the source of truth, so every field is taken verbatim
 * and nothing is inferred.
 *
 * Page markup, after tag-stripping:
 *   Item Type: … | Item Name: <websiteSku> | Item Description: … |
 *   Purchase: 1 pcs -&nbsp$0.42/pc | 12 pcs -&nbsp$4.79($0.40/pc) | … |
 *   Item Capacity: … | Item Height with Cap: … | Item Height without Cap: … |
 *   Item Diameter: … | Neck Thread Size: …
 *
 * NOTE the entity is `&nbsp` WITHOUT a trailing semicolon — the first version of
 * this script normalised only `&nbsp;` and therefore parsed 0 of 2,309 pages.
 *
 * Usage: node scripts/scrape_live_tier_pricing.mjs [concurrency]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const OUT = "docs/reviews/audit-2026-08-06/live-site-full-scrape.json";
const URLS = "docs/reviews/audit-2026-08-06/urls-to-scrape.txt";
const CONCURRENCY = Number(process.argv[2] ?? 12);

/** Normalise page HTML to a single delimited text run. */
export function toText(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, "|")
        .replace(/&nbsp;?/g, " ")      // semicolon is optional on this site
        .replace(/&amp;/g, "&")
        .replace(/&#177;/g, "±")
        .replace(/&reg;/g, "")
        .replace(/&times;/g, "x")
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/\|+/g, " | ")
        .replace(/[ \t]+/g, " ");
}

/**
 * Every tier on the page.
 *   "1 pcs - $0.42/pc"          → qty 1,  unit 0.42, total derived
 *   "12 pcs - $4.79($0.40/pc)"  → qty 12, unit 0.40, total 4.79 (stated)
 */
export function parseTiers(text) {
    const tiers = [];
    const re = /([\d,]+)\s*pcs?\s*-\s*\$\s*([\d,]+\.\d{2})\s*(?:\(\s*\$?\s*([\d,]+\.\d{2})\s*\/pc\s*\))?/g;
    let m;
    while ((m = re.exec(text)) !== null) {
        const qty = Number(m[1].replace(/,/g, ""));
        const first = Number(m[2].replace(/,/g, ""));
        const paren = m[3] ? Number(m[3].replace(/,/g, "")) : null;
        tiers.push({
            qty,
            unitPrice: paren ?? first,
            lineTotal: paren ? first : Number((first * qty).toFixed(2)),
            totalStated: Boolean(paren),
        });
    }
    // Same qty can appear twice if the page repeats a block; keep the first.
    const seen = new Set();
    return tiers.filter((t) => (seen.has(t.qty) ? false : (seen.add(t.qty), true)));
}

const field = (text, label) => {
    const re = new RegExp(`${label}\\s*:\\s*\\|?\\s*([^|]+)`, "i");
    const m = re.exec(text);
    return m ? m[1].trim().replace(/\s+/g, " ") || null : null;
};

export function parseProduct(text) {
    return {
        siteSku: field(text, "Item Name"),
        itemType: field(text, "Item Type"),
        itemDescription: field(text, "Item Description"),
        capacity: field(text, "Item Capacity"),
        heightWithCap: field(text, "Item Height with Cap"),
        heightWithoutCap: field(text, "Item Height without Cap"),
        diameter: field(text, "Item Diameter"),
        neckThreadSize: field(text, "Neck Thread Size"),
        minimumPurchase: (/Minimum Purchase Requirement is\s*(US \$[\d,]+)/i.exec(text) ?? [])[1] ?? null,
        tiers: parseTiers(text),
    };
}

async function scrapeOne(url) {
    const res = await fetch(url, {
        headers: { "user-agent": "Mozilla/5.0 (BestBottles price reconciliation audit)" },
        signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return { url, status: `http_${res.status}`, tiers: [] };
    const html = await res.text();
    const text = toText(html);
    const parsed = parseProduct(text);
    const imageMatch = /https:\/\/www\.bestbottles\.com\/images\/store\/enlarged_pics\/[^"' )]+/i.exec(html);
    return {
        url,
        status: parsed.tiers.length > 0 ? "ok" : "no_tiers",
        imageUrl: imageMatch ? imageMatch[0] : null,
        ...parsed,
    };
}

async function main() {
    const urls = readFileSync(URLS, "utf8").split("\n").map((s) => s.trim()).filter(Boolean);
    const prior = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];
    const keep = prior.filter((d) => d.status === "ok");
    const doneUrls = new Set(keep.map((d) => d.url));
    const todo = urls.filter((u) => !doneUrls.has(u));
    console.error(`total ${urls.length} | already ok ${doneUrls.size} | to fetch ${todo.length}`);

    const results = [...keep];
    let i = 0, completed = 0;

    async function worker() {
        while (i < todo.length) {
            const url = todo[i++];
            try {
                results.push(await scrapeOne(url));
            } catch (e) {
                results.push({ url, status: "error", error: String(e).slice(0, 120), tiers: [] });
            }
            completed++;
            if (completed % 200 === 0) {
                process.stderr.write(`  ${completed}/${todo.length}\n`);
                writeFileSync(OUT, JSON.stringify(results, null, 2));
            }
        }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    writeFileSync(OUT, JSON.stringify(results, null, 2));

    const ok = results.filter((r) => r.status === "ok");
    const tierCounts = {};
    for (const r of ok) tierCounts[r.tiers.length] = (tierCounts[r.tiers.length] ?? 0) + 1;
    const withSpec = (k) => ok.filter((r) => r[k]).length;
    console.error(`\nscraped ok: ${ok.length}/${results.length}`);
    console.error(`tier-count distribution: ${JSON.stringify(tierCounts)}`);
    console.error(`total tier rows: ${ok.reduce((n, r) => n + r.tiers.length, 0)}`);
    console.error(`field coverage — sku ${withSpec("siteSku")}, capacity ${withSpec("capacity")}, `
        + `heightWithCap ${withSpec("heightWithCap")}, diameter ${withSpec("diameter")}, `
        + `neckThread ${withSpec("neckThreadSize")}, itemType ${withSpec("itemType")}, image ${withSpec("imageUrl")}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
