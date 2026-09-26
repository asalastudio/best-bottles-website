#!/usr/bin/env node
/**
 * Export the catalogue facts the item-description generator reads, one row per
 * SKU, from Convex (dev by default; pass CONVEX_URL for prod).
 *
 * Reads group by group (getAllGroupsForPlates -> getProductGroup) so no single
 * query crosses Convex's per-function read limit. Output:
 *   data/descriptions/pdp/catalog-facts.json
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");

function loadEnvLocal() {
    try {
        for (const line of readFileSync(resolve(root, ".env.local"), "utf8").split("\n")) {
            const t = line.trim();
            if (!t || t.startsWith("#")) continue;
            const i = t.indexOf("=");
            if (i < 0) continue;
            const key = t.slice(0, i).trim();
            let val = t.slice(i + 1).trim();
            if (val.includes(" #")) val = val.slice(0, val.indexOf(" #")).trim();
            if (!process.env[key]) process.env[key] = val;
        }
    } catch { /* env may already be set */ }
}
loadEnvLocal();

const url = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
if (!url) { console.error("Set CONVEX_URL or NEXT_PUBLIC_CONVEX_URL"); process.exit(1); }
const client = new ConvexHttpClient(url);

const groups = await client.query(api.products.getAllGroupsForPlates, {});
console.log(`${groups.length} groups on ${url}`);
const rows = [];
const groupRows = [];
let done = 0;
for (const g of groups) {
    const data = await client.query(api.products.getProductGroup, { slug: g.slug });
    if (!data) continue;
    const { group, variants } = data;
    groupRows.push({
        slug: group.slug, displayName: group.displayName, family: group.family, category: group.category,
        capacity: group.capacity ?? null, capacityMl: group.capacityMl ?? null, color: group.color ?? null,
        neckThreadSize: group.neckThreadSize ?? null, applicatorTypes: group.applicatorTypes ?? [],
        primaryWebsiteSku: group.primaryWebsiteSku ?? null, primaryGraceSku: group.primaryGraceSku ?? null,
        variantCount: group.variantCount, groupDescription: group.groupDescription ?? null,
    });
    for (const v of variants) {
        rows.push({
            websiteSku: v.websiteSku, graceSku: v.graceSku, groupSlug: group.slug,
            category: v.category, family: v.family, color: v.color, capacity: v.capacity, capacityMl: v.capacityMl, capacityOz: v.capacityOz,
            applicator: v.applicator, ballMaterial: v.ballMaterial ?? null, capColor: v.capColor, capStyle: v.capStyle, capHeight: v.capHeight ?? null, trimColor: v.trimColor,
            componentGroup: v.componentGroup ?? null, assemblyType: v.assemblyType ?? null,
            neckThreadSize: v.neckThreadSize, heightWithCap: v.heightWithCap, heightWithoutCap: v.heightWithoutCap, diameter: v.diameter,
            bottleWeightG: v.bottleWeightG, caseQuantity: v.caseQuantity, caseWeightG: v.caseWeightG ?? null,
            webPrice1pc: v.webPrice1pc, stockStatus: v.stockStatus,
            itemName: v.itemName, itemDescription: v.itemDescription, useCaseDescription: v.useCaseDescription ?? null, graceDescription: v.graceDescription ?? null,
            productUrl: v.productUrl, imageUrl: v.imageUrl ?? null, shopifySellable: v.shopifySellable ?? null,
        });
    }
    done += 1;
    if (done % 50 === 0) console.log(`  ${done}/${groups.length} groups, ${rows.length} SKUs`);
}
mkdirSync(resolve(root, "data/descriptions/pdp"), { recursive: true });
const out = resolve(root, "data/descriptions/pdp/catalog-facts.json");
writeFileSync(out, JSON.stringify({ exportedAt: new Date().toISOString(), deployment: url, groups: groupRows, products: rows }, null, 1));
console.log(`wrote ${rows.length} SKUs / ${groupRows.length} groups -> ${out}`);
