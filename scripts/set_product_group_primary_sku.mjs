#!/usr/bin/env node
/**
 * Select the representative/default SKU for a Best Bottles product group.
 *
 * This updates Convex productGroups.primaryWebsiteSku / primaryGraceSku and,
 * when the selected SKU already has Shopify CDN media cached in products.imageUrl,
 * productGroups.heroImageUrl.
 *
 * It does not change Shopify products, SKUs, slugs, filenames, or Madison data.
 *
 * Usage:
 *   node scripts/set_product_group_primary_sku.mjs --slug cylinder-5ml-cobalt-blue-13-415 --website-sku GBCylBlu5Sl
 *   node scripts/set_product_group_primary_sku.mjs --grace-sku GB-CYL-BLU-5ML-SLV-T
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function loadEnv() {
    try {
        const content = readFileSync(resolve(ROOT, ".env.local"), "utf8");
        for (const line of content.split("\n")) {
            const match = line.match(/^([^#=]+)=(.*)$/);
            if (!match) continue;
            const key = match[1].trim();
            if (process.env[key] == null) {
                process.env[key] = match[2].trim().replace(/^["']|["']$/g, "");
            }
        }
    } catch {
        // Optional in CI.
    }
}

function argValue(name) {
    const index = process.argv.indexOf(name);
    if (index < 0) return undefined;
    const value = process.argv[index + 1];
    return value && !value.startsWith("--") ? value : undefined;
}

loadEnv();

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const WRITE_TOKEN = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
const productGroupSlug = argValue("--slug");
const websiteSku = argValue("--website-sku");
const graceSku = argValue("--grace-sku");

const missing = [
    !CONVEX_URL ? "NEXT_PUBLIC_CONVEX_URL" : "",
    !WRITE_TOKEN ? "BEST_BOTTLES_CONVEX_WRITE_TOKEN" : "",
    !websiteSku && !graceSku ? "--website-sku or --grace-sku" : "",
].filter(Boolean);

if (missing.length) {
    console.error(`Missing required value: ${missing.join(", ")}`);
    process.exit(1);
}

const convex = new ConvexHttpClient(CONVEX_URL);
const result = await convex.mutation(api.products.setProductGroupPrimarySku, {
    writeToken: WRITE_TOKEN,
    productGroupSlug,
    websiteSku,
    graceSku,
});

console.log(JSON.stringify(result, null, 2));

if (!result.success) process.exit(1);
if (result.warning) process.exitCode = 2;
