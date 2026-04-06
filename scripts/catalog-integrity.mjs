#!/usr/bin/env node
/**
 * SKU / import integrity — Convex-only (no LLM).
 *
 * Paginates via `getCatalogIntegrityBatch` (single paginate per Convex call).
 *
 * Usage:
 *   npm run test:catalog:integrity
 *
 * Requires NEXT_PUBLIC_CONVEX_URL in .env.local / env.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

try {
    const envPath = resolve(ROOT, ".env.local");
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
} catch {
    /* optional */
}

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
if (!CONVEX_URL) {
    console.error("ERROR: NEXT_PUBLIC_CONVEX_URL not set.");
    process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

async function main() {
    const validGroupIds = await client.query(api.products.getProductGroupIdList, {});

    const mergedSku = new Map();
    let totalRows = 0;
    let missingGraceSku = 0;
    let emptyItemName = 0;
    let orphanProductGroupId = 0;
    const orphanSamples = [];
    let cursor = null;
    let batches = 0;

    while (true) {
        const batch = await client.query(api.products.getCatalogIntegrityBatch, {
            cursor,
            validGroupIds,
        });
        batches++;
        totalRows += batch.pageRowCount;
        missingGraceSku += batch.missingGraceSku;
        emptyItemName += batch.emptyItemName;
        orphanProductGroupId += batch.orphanRowCount;
        for (const s of batch.orphanSamples) {
            if (orphanSamples.length < 30) orphanSamples.push(s);
        }
        for (const [sku, n] of Object.entries(batch.skuCounts)) {
            mergedSku.set(sku, (mergedSku.get(sku) ?? 0) + n);
        }
        if (batch.isDone) break;
        cursor = batch.continueCursor;
    }

    const duplicateGraceSkus = [];
    for (const [sku, n] of mergedSku) {
        if (n > 1) duplicateGraceSkus.push(sku);
    }
    duplicateGraceSkus.sort();

    const report = {
        deployment: CONVEX_URL,
        productGroups: validGroupIds.length,
        products: totalRows,
        batches,
        missingGraceSku,
        emptyItemName,
        orphanProductGroupId,
        orphanProductGroupSamples: orphanSamples,
        duplicateGraceSkuCount: duplicateGraceSkus.length,
        duplicateGraceSkus: duplicateGraceSkus.slice(0, 50),
        duplicateGraceSkusTruncated: duplicateGraceSkus.length > 50,
    };

    console.log(JSON.stringify(report, null, 2));

    const bad =
        missingGraceSku > 0 || orphanProductGroupId > 0 || duplicateGraceSkus.length > 0;

    if (bad) {
        console.error("\nSTATUS: ISSUES DETECTED.");
        process.exit(1);
    }
    console.log("\nSTATUS: OK — no duplicate graceSku, no orphan group refs, no missing graceSku.");
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
