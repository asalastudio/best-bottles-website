#!/usr/bin/env node
/**
 * Shopify product names for the bulb sprayers, in the site's wording (Jordan, 2026-09-28: it must say "vintage
 * style bulb sprayer" and "vintage style bulb sprayer with tassel"). The checkout, receipts and order emails show
 * Shopify's product title, and all 56 bulb sprayer products still say "Vintage Bulb Spray Bottle" (or "… Sprayer").
 *
 * Only the title changes: no handle (the site matches products to pages by handle), price, variant, image or
 * status. The webhook sync never renames anything in the catalogue (convex/shopifySync.ts), so a new title stays in
 * Shopify. Orders already placed keep the title they were bought under.
 *
 * Five products hold plain and tassel bottles under one plain title. Their new title stays plain and the plan
 * flags them: naming the tassel bottles there needs a decision (split the product, or name the variants).
 *
 *   node scripts/shopify_bulb_sprayer_titles.mjs                     # dry run: writes the plan, changes nothing
 *   node scripts/shopify_bulb_sprayer_titles.mjs --apply [--only <product gid>]
 *   node scripts/shopify_bulb_sprayer_titles.mjs --rollback <file>   # put the old titles back
 *
 * --apply re-reads each product and skips it if its title is no longer the planned "before"; the old titles are
 * written to a rollback file BEFORE the first change. Plan and rollback live in data/audits/shopify-bulb-sprayer-titles/.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(resolve(REPO, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, "");
}
const PROD_URL = "https://precise-raccoon-123.convex.cloud";
const domain = (process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
const token = process.env.SHOPIFY_ADMIN_TOKEN;
if (!domain || !token) { console.error("NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_TOKEN must be set in .env.local"); process.exit(1); }
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const rollbackFile = args.includes("--rollback") ? args[args.indexOf("--rollback") + 1] : null;
const DIR = resolve(REPO, "data/audits/shopify-bulb-sprayer-titles");
mkdirSync(DIR, { recursive: true });

async function gql(query, variables) {
    for (let attempt = 1; attempt <= 4; attempt++) {
        const r = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
            method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token }, body: JSON.stringify({ query, variables }),
        });
        if (r.status === 429) { await new Promise(s => setTimeout(s, 1500 * attempt)); continue; }
        const j = await r.json();
        if (j.errors) throw new Error(JSON.stringify(j.errors).slice(0, 300));
        return j.data;
    }
    throw new Error("rate limited");
}

async function rest(method, path, body) {
    for (let attempt = 1; attempt <= 4; attempt++) {
        const r = await fetch(`https://${domain}/admin/api/2025-01/${path}`, {
            method, headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token }, body: body ? JSON.stringify(body) : undefined,
        });
        if (r.status === 429) { await new Promise(s => setTimeout(s, 1500 * attempt)); continue; }
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${JSON.stringify(j).slice(0, 300)}`);
        return j;
    }
    throw new Error("rate limited");
}

/** The site's wording (src/lib/catalogFilters.ts displayApplicatorName, pdp-redesign pageTitle): "Vintage-Style Bulb Sprayer Bottle with Tassel". */
export function siteTitle(title) {
    return title
        .replace(/\bVintage Bulb Spray Bottle with Tassel\b/g, "Vintage-Style Bulb Sprayer Bottle with Tassel")
        .replace(/\bVintage Bulb Sprayer with Tassel Bottle\b/g, "Vintage-Style Bulb Sprayer Bottle with Tassel")
        .replace(/\bVintage Bulb Spray Bottle\b/g, "Vintage-Style Bulb Sprayer Bottle")
        .replace(/\bVintage Bulb Sprayer\b/g, "Vintage-Style Bulb Sprayer")
        .replace(/^(\d+(?:\.\d+)?) mL\b/, "$1 ml");
}

if (rollbackFile) {
    const prior = JSON.parse(readFileSync(resolve(REPO, rollbackFile), "utf8"));
    for (const p of prior) {
        await rest("PUT", `products/${p.id}.json`, { product: { id: p.id, title: p.title } });
        console.log("restored", p.id, p.title);
    }
    process.exit(0);
}

// Production's catalogue says which bottles are tassel sprayers (the applicator, or a tassel page for the parts sold alone).
const convex = new ConvexHttpClient(PROD_URL);
const groups = new Map((await convex.query(anyApi.products.getAllCatalogGroups, {})).map(g => [String(g._id), g.slug]));
const tasselByVariant = new Map();
for (let cursor = null; ;) {
    const page = await convex.action(anyApi.products.getProductExportPage, { cursor, numItems: 500 });
    for (const row of page.page) {
        if (!row.shopifyVariantId) continue;
        const slug = groups.get(String(row.productGroupId)) ?? "";
        tasselByVariant.set(row.shopifyVariantId, /tassel/i.test(row.applicator ?? "") || /tassel/.test(slug));
    }
    if (page.isDone) break;
    cursor = page.continueCursor;
}

const products = new Map();
for (const q of ["title:*Bulb*", "title:*Vintage*", "title:*Antique*"]) {
    for (let after = null; ;) {
        const d = await gql(`query($q:String!,$after:String){ products(first:50, query:$q, after:$after){ pageInfo{hasNextPage endCursor}
            nodes{ id title handle status variants(first:100){ nodes{ id sku } } } } }`, { q, after });
        for (const p of d.products.nodes) products.set(p.id, p);
        if (!d.products.pageInfo.hasNextPage) break;
        after = d.products.pageInfo.endCursor;
    }
}

const plan = [...products.values()]
    .filter(p => /bulb/i.test(p.title))
    .sort((a, b) => a.title.localeCompare(b.title))
    .map(p => {
        const variants = p.variants.nodes;
        const tassel = variants.filter(v => tasselByVariant.get(v.id) ?? /Tsl/.test(v.sku ?? "")).length;
        const plain = variants.length - tassel;
        const after = siteTitle(p.title);
        const mixed = tassel > 0 && plain > 0;
        const note = mixed ? `holds ${tassel} tassel and ${plain} plain bottles under one name: the tassel ones need a split or variant names (Jordan's call)`
            : tassel > 0 && !/tassel/i.test(after) ? "every bottle here is a tassel sprayer but the name does not say so"
                : "";
        return { id: p.id, handle: p.handle, status: p.status, variants: variants.length, tassel, plain, before: p.title, after, change: after !== p.title, note };
    });

writeFileSync(resolve(DIR, "plan.json"), JSON.stringify(plan, null, 1) + "\n");
const csv = (v) => `"${String(v).replace(/"/g, '""')}"`;
writeFileSync(resolve(DIR, "plan.csv"), ["handle,status,variants,tassel,plain,before,after,note", ...plan.map(r => [r.handle, r.status, r.variants, r.tassel, r.plain, r.before, r.after, r.note].map(csv).join(","))].join("\n") + "\n");
const todo = plan.filter(r => r.change && (!only || r.id === only));
console.log(`${APPLY ? "APPLY" : "DRY RUN"}: ${plan.length} bulb sprayer products, ${plan.filter(r => r.change).length} to rename, ${plan.filter(r => r.note).length} flagged; plan in data/audits/shopify-bulb-sprayer-titles/`);
if (!APPLY) {
    for (const r of todo) console.log(`  ${r.before}\n    → ${r.after}${r.note ? `   [${r.note}]` : ""}`);
    process.exit(0);
}

const prior = [];
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
for (const r of todo) {
    const id = r.id.split("/").pop();
    const { product } = await rest("GET", `products/${id}.json?fields=id,title,handle`);
    if (product.title !== r.before) { console.log(`  skipped, changed since the plan: ${product.title}`); continue; }
    prior.push({ id: product.id, title: product.title });
    writeFileSync(resolve(DIR, `rollback-${stamp}.json`), JSON.stringify(prior, null, 1) + "\n");   // written BEFORE the change
    const { product: updated } = await rest("PUT", `products/${id}.json`, { product: { id: product.id, title: r.after } });
    if (updated.handle !== product.handle) throw new Error(`handle changed on ${product.title}: ${product.handle} → ${updated.handle}`);
    console.log(`  ${product.title} → ${updated.title}`);
    await new Promise(s => setTimeout(s, 600));
}
