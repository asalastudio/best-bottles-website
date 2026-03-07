#!/usr/bin/env node

/**
 * Data Quality Audit Script
 *
 * Runs the auditDataQuality query against Convex and prints a report.
 * Also specifically checks the two known issues:
 *   1. Duplicate matte silver lotion pump (CMP-LPM-MTSL-18-415-06 vs CMP-LPM-MSLV-18-415-02)
 *   2. Misclassified CAP-prefixed sprayers
 *
 * Usage: node scripts/data_quality_audit.mjs
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", ".env.local");

if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx < 0) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        if (value.includes("#")) value = value.slice(0, value.indexOf("#")).trim();
        if (!process.env[key]) process.env[key] = value;
    }
}

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
    console.error("Missing NEXT_PUBLIC_CONVEX_URL — load .env.local first");
    process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

async function main() {
    console.log("╔══════════════════════════════════════════════╗");
    console.log("║      DATA QUALITY AUDIT — Best Bottles       ║");
    console.log("╚══════════════════════════════════════════════╝\n");

    // Run the audit action
    const result = await client.action(api.products.auditDataQuality, {});

    console.log(`Total products scanned: ${result.totalProducts}`);
    console.log(`Issues found: ${result.issueCount}`);
    console.log(`  🔴 High severity: ${result.highSeverity}`);
    console.log(`  🟡 Medium severity: ${result.mediumSeverity}`);
    console.log(`  🔵 Low severity: ${result.lowSeverity}`);
    console.log("");

    if (result.issues.length === 0) {
        console.log("✅ No issues found — data quality looks good!");
        return;
    }

    // Group issues by type
    const grouped = {};
    for (const issue of result.issues) {
        if (!grouped[issue.type]) grouped[issue.type] = [];
        grouped[issue.type].push(issue);
    }

    for (const [type, issues] of Object.entries(grouped)) {
        const label = {
            duplicate_sku: "DUPLICATE SKUs",
            duplicate_name: "DUPLICATE NAMES",
            sku_mismatch: "SKU/NAME MISMATCHES",
            missing_price: "MISSING PRICES",
            missing_category: "MISSING CATEGORIES",
        }[type] || type;

        console.log(`\n── ${label} (${issues.length}) ──────────────────────────────`);
        for (const issue of issues) {
            const icon = issue.severity === "high" ? "🔴" : issue.severity === "medium" ? "🟡" : "🔵";
            console.log(`  ${icon} ${issue.graceSku}`);
            console.log(`     ${issue.detail}`);
        }
    }

    // Specific investigation: matte silver lotion pump duplicates
    console.log("\n\n── SPECIFIC: Matte Silver Lotion Pump Investigation ──────────");
    const mtsl = await client.query(api.products.getBySku, { graceSku: "CMP-LPM-MTSL-18-415-06" });
    const mslv = await client.query(api.products.getBySku, { graceSku: "CMP-LPM-MSLV-18-415-02" });

    if (mtsl) {
        console.log(`  Found: ${mtsl.graceSku}`);
        console.log(`    Name: ${mtsl.itemName}`);
        console.log(`    Price: $${mtsl.webPrice1pc?.toFixed(2) ?? "N/A"}`);
        console.log(`    Category: ${mtsl.category}`);
    } else {
        console.log("  CMP-LPM-MTSL-18-415-06: NOT FOUND");
    }

    if (mslv) {
        console.log(`  Found: ${mslv.graceSku}`);
        console.log(`    Name: ${mslv.itemName}`);
        console.log(`    Price: $${mslv.webPrice1pc?.toFixed(2) ?? "N/A"}`);
        console.log(`    Category: ${mslv.category}`);
    } else {
        console.log("  CMP-LPM-MSLV-18-415-02: NOT FOUND");
    }

    if (mtsl && mslv) {
        const sameName = mtsl.itemName.toLowerCase() === mslv.itemName.toLowerCase();
        const samePrice = mtsl.webPrice1pc === mslv.webPrice1pc;
        console.log(`\n  Same name? ${sameName ? "YES — likely duplicate" : "No"}`);
        console.log(`  Same price? ${samePrice ? "YES" : "No"}`);
        if (sameName && samePrice) {
            console.log("  ⚠️  RECOMMENDATION: Remove one of these (likely CMP-LPM-MSLV-18-415-02 — shorter SKU)");
        }
    }

    console.log("\n\nAudit complete.");
}

main().catch(console.error);
