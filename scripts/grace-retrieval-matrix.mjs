#!/usr/bin/env node
/**
 * Layer A — Deterministic searchCatalog matrix (families × capacities + applicator spots).
 *
 * Proves Convex `grace.searchCatalog` returns plausible rows for representative queries
 * (same code path Grace uses via /api/elevenlabs/server-tools).
 *
 * Usage:
 *   npm run test:grace:matrix
 *   npm run test:grace:matrix -- --verbose
 *   npm run test:grace:matrix -- --fail-fast
 *
 * Requires NEXT_PUBLIC_CONVEX_URL (or CONVEX_URL) in .env.local / env.
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

const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const failFast = args.includes("--fail-fast");

const configPath = resolve(ROOT, "data/grace-evals/retrieval-matrix-config.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));
const capacityMlTolerance = config.capacityMlTolerance ?? 0;

/** @type {Array<{ id: string, searchTerm: string, familyLimit?: string, applicatorFilter?: string, expectFamily: string, expectCapacityMl: number | null, tolerance?: number }>} */
const cases = [];

for (const family of config.families) {
    const caps = config.capacityMlByFamily[family];
    if (!caps?.length) continue;
    for (const ml of caps) {
        const id = `matrix-${family.replace(/\s+/g, "-")}-${ml}ml`;
        cases.push({
            id,
            searchTerm: `${ml}ml ${family}`,
            familyLimit: family,
            expectFamily: family,
            expectCapacityMl: ml,
            tolerance: capacityMlTolerance,
        });
    }
}

for (const spot of config.applicatorSpots || []) {
    cases.push({
        id: spot.id,
        searchTerm: spot.searchTerm,
        familyLimit: spot.familyLimit,
        applicatorFilter: spot.applicatorFilter,
        expectFamily: spot.expectFamily,
        expectCapacityMl: spot.expectCapacityMl ?? null,
        tolerance:
            spot.capacityMlTolerance ??
            config.capacityMlTolerance ??
            0,
    });
}

const client = new ConvexHttpClient(CONVEX_URL);

function matchesExpectation(result, expectFamily, expectCapacityMl, tolerance) {
    const tol = tolerance ?? 0;
    return result.some((row) => {
        if (row.family !== expectFamily) return false;
        if (expectCapacityMl == null) return true;
        if (row.capacityMl == null) return false;
        return Math.abs(row.capacityMl - expectCapacityMl) <= tol;
    });
}

async function run() {
    let passed = 0;
    let failed = 0;
    const failures = [];

    console.log(`Layer A — searchCatalog matrix (${cases.length} cases) → ${CONVEX_URL}\n`);

    for (const c of cases) {
        let result;
        try {
            result = await client.query(api.grace.searchCatalog, {
                searchTerm: c.searchTerm,
                familyLimit: c.familyLimit,
                applicatorFilter: c.applicatorFilter,
            });
        } catch (e) {
            failed++;
            const msg = e instanceof Error ? e.message : String(e);
            failures.push({ id: c.id, reason: `Convex error: ${msg}` });
            console.log(`FAIL ${c.id} — ${msg}`);
            if (failFast) process.exit(1);
            continue;
        }

        const rows = Array.isArray(result) ? result : [];
        if (rows.length === 0) {
            failed++;
            failures.push({ id: c.id, reason: "zero results" });
            console.log(`FAIL ${c.id} — zero results`);
            if (failFast) process.exit(1);
            continue;
        }

        const ok = matchesExpectation(rows, c.expectFamily, c.expectCapacityMl, c.tolerance);
        if (!ok) {
            failed++;
            const top = rows.slice(0, 3).map((r) => `${r.family}/${r.capacityMl}`).join("; ");
            failures.push({ id: c.id, reason: `no row matched family+cap (sample: ${top})` });
            console.log(`FAIL ${c.id} — expected ${c.expectFamily} @ ${c.expectCapacityMl}ml (±${c.tolerance ?? 0})`);
            if (verbose) console.log("  sample:", JSON.stringify(rows.slice(0, 5), null, 2));
            if (failFast) process.exit(1);
            continue;
        }

        passed++;
        if (verbose) console.log(`OK   ${c.id} (${rows.length} hits)`);
    }

    console.log(`\n── Summary ──`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    if (failures.length && !verbose) {
        console.log(`\nFailed cases:`);
        for (const f of failures) console.log(`  - ${f.id}: ${f.reason}`);
    }

    process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
    console.error(e);
    process.exit(1);
});
