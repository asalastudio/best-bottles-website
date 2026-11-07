#!/usr/bin/env node
/**
 * 2026-11-07 — nine group names (and eight Shopify titles) read "… Bottle Bottle with Cap": the group-name generator
 * added "Bottle with Cap" after families whose own name ends in "Bottle" (fixed in convex/bottleDisplayName.ts).
 * This corrects the stored names, each guarded by the exact value it replaces:
 *   Convex  productGroups.displayName (migrations:patchProductGroupFields) on the deployment the run targets;
 *   Shopify product title for the same handle, on the --prod run only (Shopify is shared by both deployments).
 * lotion-bottle-3ml-clear-snap has no Shopify product. Nothing else is touched.
 *
 *   node scripts/catalog-corrections/2026-11-07-doubled-bottle-names.mjs                 # dry run, dev (reads only)
 *   node scripts/catalog-corrections/2026-11-07-doubled-bottle-names.mjs --apply         # dev Convex
 *   node scripts/catalog-corrections/2026-11-07-doubled-bottle-names.mjs --prod          # dry run, prod Convex + Shopify
 *   node scripts/catalog-corrections/2026-11-07-doubled-bottle-names.mjs --prod --apply  # prod Convex + Shopify titles
 * Record (before/after, for rollback): data/audits/doubled-bottle-names-2026-11-07/<env>.json
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    // A trailing "# team: …" comment (CONVEX_DEPLOYMENT) must not reach the convex CLI.
    if (m) process.env[m[1].trim()] ??= m[2].replace(/\s+#.*$/, "").trim().replace(/^["']|["']$/g, "");
}
const prod = process.argv.includes("--prod");
const apply = process.argv.includes("--apply");
const env = prod ? "prod" : "dev";
const url = prod ? "https://precise-raccoon-123.convex.cloud" : "https://helpful-elephant-638.convex.cloud";
if (!prod && !/^dev:helpful-elephant-638\b/.test(process.env.CONVEX_DEPLOYMENT ?? "")) {
    console.error(`refusing: CONVEX_DEPLOYMENT is ${process.env.CONVEX_DEPLOYMENT}, expected dev:helpful-elephant-638`); process.exit(1);
}
const shopDomain = (process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
const shopToken = process.env.SHOPIFY_ADMIN_TOKEN;
if (prod && (!shopDomain || !shopToken)) { console.error("NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_TOKEN must be set"); process.exit(1); }

/** slug → the doubled name production carried on 7 Nov 2026. */
const DOUBLED = {
    "aluminum-bottle-120ml-mixed-20-410": "120 ml Aluminum Bottle Bottle with Cap",
    "aluminum-bottle-500ml-mixed-20-410": "500 ml Aluminum Bottle Bottle with Cap",
    "aluminum-bottle-100ml-mixed-20-410": "100 ml Aluminum Bottle Bottle with Cap",
    "aluminum-bottle-65ml-mixed-20-410": "65 ml Aluminum Bottle Bottle with Cap",
    "plastic-bottle-10ml-mixed": "10 ml Plastic Bottle Bottle with Cap",
    "plastic-bottle-30ml-mixed": "30 ml Plastic Bottle Bottle with Cap",
    "lotion-bottle-3ml-clear-snap": "3 ml Clear Lotion Bottle Bottle with Cap",
    "lotion-bottle-30ml-clear": "30 ml Clear Lotion Bottle Bottle with Cap",
    "lotion-bottle-30ml-clear-18mm": "30 ml Clear Lotion Bottle Bottle with Cap",
};
const fixed = (name) => name.replace(/\bBottle Bottle\b/, "Bottle");

const say = (msg) => console.log(`${apply ? "APPLY" : "DRY  "} [${env}] ${msg}`);
const record = { at: new Date().toISOString(), env, apply, convex: [], shopify: [] };
const runInternal = (fn, args) => execFileSync("npx", ["convex", "run", ...(prod ? ["--prod"] : []), fn, JSON.stringify(args)],
    { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

// Convex group names
const groups = await new ConvexHttpClient(url).query(anyApi.products.getAllCatalogGroups, {});
for (const [slug, doubled] of Object.entries(DOUBLED)) {
    const g = groups.filter((x) => x.slug === slug);
    if (g.length !== 1) { say(`${slug}: ${g.length} groups, skipped`); record.convex.push({ slug, skipped: `${g.length} groups` }); continue; }
    const now = g[0].displayName;
    if (now === fixed(doubled)) { say(`${slug}: already "${now}"`); continue; }
    if (now !== doubled) { say(`${slug}: changed since ("${now}"), skipped`); record.convex.push({ slug, skipped: "changed since", now }); continue; }
    say(`${slug}: "${now}" → "${fixed(doubled)}"`);
    if (apply) runInternal("migrations:patchProductGroupFields", { id: g[0]._id, fields: { displayName: fixed(doubled) } });
    record.convex.push({ slug, id: g[0]._id, before: now, after: fixed(doubled), written: apply });
}

// Shopify titles (production only: one store serves both deployments)
async function shopify(method, path, body) {
    const r = await fetch(`https://${shopDomain}/admin/api/2025-01/${path}`, {
        method, headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": shopToken }, body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${JSON.stringify(j).slice(0, 300)}`);
    return j;
}
if (prod) {
    for (const [slug, doubled] of Object.entries(DOUBLED)) {
        const { products } = await shopify("GET", `products.json?handle=${encodeURIComponent(slug)}&fields=id,title,handle`);
        if (products.length !== 1) { say(`Shopify ${slug}: ${products.length} products, skipped`); continue; }
        const [p] = products;
        if (p.title === fixed(doubled)) { say(`Shopify ${slug}: already "${p.title}"`); continue; }
        if (p.title !== doubled) { say(`Shopify ${slug}: title changed since ("${p.title}"), skipped`); record.shopify.push({ slug, skipped: "changed since", now: p.title }); continue; }
        say(`Shopify ${slug} (${p.id}): "${p.title}" → "${fixed(doubled)}"`);
        if (apply) await shopify("PUT", `products/${p.id}.json`, { product: { id: p.id, title: fixed(doubled) } });
        record.shopify.push({ slug, id: p.id, before: p.title, after: fixed(doubled), written: apply });
    }
}

if (apply) {
    const dir = resolve(ROOT, "data/audits/doubled-bottle-names-2026-11-07");
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, `${env}.json`), JSON.stringify(record, null, 1) + "\n");
}
