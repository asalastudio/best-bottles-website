#!/usr/bin/env node
/**
 * Read-only comparison of Convex caseQuantity values with the quantity breaks
 * published on legacy bestbottles.com.
 *
 * A price break is not automatically a case pack. This audit intentionally
 * reports equality and non-equality without proposing or applying corrections.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const productsPath = path.join(
    repo,
    "docs/reviews/audit-2026-08-06/convex-products-for-crosscheck.json",
);
const liveSitePath = path.join(
    repo,
    "docs/reviews/audit-2026-08-06/live-site-full-scrape.json",
);

const products = JSON.parse(readFileSync(productsPath, "utf8"));
const liveRows = JSON.parse(readFileSync(liveSitePath, "utf8"));
const liveBySku = new Map(
    liveRows
        .filter((row) => row.status === "ok" && row.siteSku)
        .map((row) => [row.siteSku, row]),
);

const comparable = [];
for (const product of products) {
    const caseQuantity = product.caseQuantity;
    const live = liveBySku.get(product.websiteSku);
    if (!Number.isFinite(caseQuantity) || caseQuantity <= 1 || !live?.tiers?.length) continue;

    const breaks = live.tiers
        .map((tier) => tier.qty)
        .filter((qty) => Number.isFinite(qty))
        .sort((a, b) => a - b);
    comparable.push({
        websiteSku: product.websiteSku,
        graceSku: product.graceSku,
        family: product.family,
        capacity: product.capacity,
        caseQuantity,
        breaks,
        matchingBreakIndex: breaks.indexOf(caseQuantity),
    });
}

const exactMatches = comparable.filter((row) => row.matchingBreakIndex >= 0);
const matchesByPosition = new Map();
for (const row of exactMatches) {
    const position = row.matchingBreakIndex + 1;
    matchesByPosition.set(position, (matchesByPosition.get(position) ?? 0) + 1);
}

const target = comparable.find((row) => row.websiteSku === "GBTallCyl9RollBlkDot") ?? null;
const report = {
    sources: {
        caseQuantity: path.relative(repo, productsPath),
        livePriceTiers: path.relative(repo, liveSitePath),
    },
    comparableProducts: comparable.length,
    exactMatchWithAnyPublishedBreak: exactMatches.length,
    noExactMatchWithPublishedBreak: comparable.length - exactMatches.length,
    exactMatchRate: comparable.length
        ? Number((exactMatches.length / comparable.length).toFixed(4))
        : 0,
    matchesByBreakPosition: Object.fromEntries(
        [...matchesByPosition].sort(([a], [b]) => a - b),
    ),
    target,
    conclusion:
        "Published quantity breaks do not reliably identify case packs; do not replace caseQuantity from this comparison.",
};

console.log(JSON.stringify(report, null, 2));
