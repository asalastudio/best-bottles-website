#!/usr/bin/env tsx
/**
 * Storefront search box: today's search vs. "closest matches" vs. ideal filters.
 *
 * For every labelled query in data/grace-evals/catalog-search-queries.json it
 * runs, against one live catalogue snapshot (read-only):
 *   search   — the storefront search as shipped (every word must match;
 *              src/lib/catalogFilters.ts catalogSearchMatches).
 *   +closest — the same search; when it finds nothing, the first "closest
 *              match" (src/lib/catalog/searchInterpretation.ts) as if tapped.
 *              Run twice: without and with the use table.
 *   ideal    — the labelled filters themselves: the ceiling of the catalogue
 *              given perfect understanding.
 *
 * A result is right when the first product shown satisfies every label
 * (dispenser, family, glass colour, size ±10%, neck, loose part). A suggestion
 * is harmful when none of its products satisfy the labels although the ideal
 * filters find some, or when it is offered for something the store does not sell.
 *
 * Usage:
 *   npm run eval:catalog:interpret
 *   npm run eval:catalog:interpret -- --split=holdout --verbose --fresh
 *   npm run eval:catalog:interpret -- --facets     # print live facet values
 *
 * Reads TYPESAFE_API_KEY and NEXT_PUBLIC_CONVEX_URL from .env.local. Jev answers
 * are cached in data/grace-evals/results/ (gitignored); --fresh ignores the cache.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { buildCatalogSearchResult, type CatalogSearchGroup } from "../src/lib/catalogSearchFallback";
import {
    COMPONENT_CATEGORIES,
    EMPTY_FILTERS,
    applicatorBucketMatchesProductValues,
    canonicalGlassColor,
    type ApplicatorBucket,
    type CatalogFilters,
    type SortValue,
} from "../src/lib/catalogFilters";
import { JEV_MODEL, buildGraceIntentQuestions, classifyGraceIntent, type GraceIntentAnswers } from "../src/lib/grace/jevIntent";
import { interpretAgainstSnapshot, validValuesFrom, type CatalogSnapshot } from "../src/lib/catalog/searchInterpretation";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RESULTS_DIR = resolve(ROOT, "data/grace-evals/results");
const CACHE_PATH = resolve(RESULTS_DIR, "catalog-search-jev-cache.json");

for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
}
const flag = (name: string) => process.argv.includes(`--${name}`);
const opt = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

const CASES_PATH = resolve(ROOT, opt("cases") ?? "data/grace-evals/catalog-search-queries.json");
const SPLIT = opt("split");
const VERBOSE = flag("verbose");
const FRESH = flag("fresh");
const TYPESAFE_API_KEY = process.env.TYPESAFE_API_KEY ?? "";
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
if (!CONVEX_URL) throw new Error("NEXT_PUBLIC_CONVEX_URL missing from .env.local");

type Expect = {
    applicators?: ApplicatorBucket[];
    families?: string[];
    colors?: string[];
    capacityMl?: number;
    neck?: string;
    parts?: boolean;
    notCarried?: boolean;
};
type Case = { id: string; text: string; split: "tune" | "holdout"; expect: Expect; viaUseTable?: boolean; source: string };

// ─── Catalogue snapshot (same reads as src/lib/catalogServer.ts) ─────────────

const convex = new ConvexHttpClient(CONVEX_URL);
const [groups, primarySkus] = await Promise.all([
    convex.query(anyApi.products.getAllCatalogGroups, {}),
    convex.query(anyApi.products.getCatalogGroupPrimarySkus, {}),
]);
const snapshot: CatalogSnapshot = { groups, primarySkus, variantPreviewRows: [] };
const valid = validValuesFrom(snapshot);

if (flag("facets")) {
    console.log(JSON.stringify(valid, null, 1));
    process.exit(0);
}

function run(filters: CatalogFilters, sort: SortValue, limit = 1000) {
    return buildCatalogSearchResult({ ...snapshot, filters, sort, view: "visual", limit, cursor: null });
}

// ─── Labels ──────────────────────────────────────────────────────────────────

function satisfies(group: CatalogSearchGroup, expect: Expect): boolean {
    if (expect.applicators?.length && !expect.applicators.some((bucket) => applicatorBucketMatchesProductValues(bucket, group.applicatorTypes ?? []))) return false;
    if (expect.families?.length && !expect.families.includes(group.family ?? "")) return false;
    if (expect.colors?.length && !expect.colors.includes(canonicalGlassColor(group.color) ?? "")) return false;
    if (expect.capacityMl != null && (group.capacityMl == null || Math.abs(group.capacityMl - expect.capacityMl) > expect.capacityMl * 0.1)) return false;
    if (expect.neck && group.neckThreadSize !== expect.neck) return false;
    if (expect.parts && !COMPONENT_CATEGORIES.has(group.category ?? "")) return false;
    return true;
}

function idealFilters(expect: Expect): CatalogFilters {
    return {
        ...EMPTY_FILTERS,
        applicators: expect.applicators ?? [],
        families: expect.families ?? [],
        colors: expect.colors ?? [],
        capacities: expect.capacityMl == null ? [] : valid.capacities.filter((c) => Math.abs(c.ml - expect.capacityMl!) <= expect.capacityMl! * 0.1).map((c) => c.label),
        neckThreadSizes: expect.neck ? [expect.neck] : [],
    };
}

// ─── Jev (cached) ────────────────────────────────────────────────────────────

const questionsHash = createHash("sha256").update(JSON.stringify(buildGraceIntentQuestions())).digest("hex").slice(0, 12);
const cache: Record<string, GraceIntentAnswers> = !FRESH && existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, "utf8")) : {};
const latencies: number[] = [];
let jevErrors = 0;

async function answersFor(query: string): Promise<GraceIntentAnswers | null> {
    const normalized = query.trim().toLowerCase().replace(/\s+/g, " ");
    const key = `${JEV_MODEL}:${questionsHash}:${normalized}`;
    if (cache[key]) return cache[key];
    if (!TYPESAFE_API_KEY) return null;
    const result = await classifyGraceIntent({ request: normalized }, { apiKey: TYPESAFE_API_KEY, timeoutMs: 5000 });
    if (!result.ok) {
        jevErrors++;
        return null;
    }
    latencies.push(result.ms);
    cache[key] = result.answers;
    return result.answers;
}

// ─── Run ─────────────────────────────────────────────────────────────────────

const doc = JSON.parse(readFileSync(CASES_PATH, "utf8")) as { cases: Case[] };
const cases = doc.cases.filter((c) => !SPLIT || c.split === SPLIT);

type Arm = "search" | "closest" | "closestTable" | "ideal";
type Outcome = { empty: boolean; right: boolean; suggested: boolean; harmful: boolean; label?: string };
const rows: Array<{ c: Case; outcomes: Record<Arm, Outcome> }> = [];

for (const c of cases) {
    const baseline = run({ ...EMPTY_FILTERS, search: c.text }, "best-match", 5);
    const baselineEmpty = baseline.totalCount === 0;
    const ideal = run(idealFilters(c.expect), "capacity-asc");
    const idealMatches = ideal.items.filter((g) => satisfies(g, c.expect)).length;

    const outcome = (items: CatalogSearchGroup[], total: number): Outcome => ({
        empty: total === 0,
        right: c.expect.notCarried ? total === 0 : Boolean(items[0] && satisfies(items[0], c.expect)),
        suggested: false,
        harmful: false,
    });
    const searchOutcome = outcome(baseline.items, baseline.totalCount);

    const closest = async (useCases: boolean): Promise<Outcome> => {
        if (!baselineEmpty) return searchOutcome;
        const interpretation = await interpretAgainstSnapshot({ query: c.text, filters: EMPTY_FILTERS }, { mode: "suggest", snapshot, answersFor, useCases });
        const top = interpretation.suggestions[0];
        if (!top) return { ...searchOutcome };
        const tapped = run(top.filters, "capacity-asc");
        const anyMatch = tapped.items.some((g) => satisfies(g, c.expect));
        return {
            empty: tapped.totalCount === 0,
            right: !c.expect.notCarried && Boolean(tapped.items[0] && satisfies(tapped.items[0], c.expect)),
            suggested: true,
            harmful: c.expect.notCarried ? true : (!anyMatch && idealMatches > 0),
            label: interpretation.suggestions.map((s) => s.label).join(" | "),
        };
    };

    rows.push({
        c,
        outcomes: {
            search: searchOutcome,
            closest: await closest(false),
            closestTable: await closest(true),
            ideal: { empty: ideal.totalCount === 0, right: c.expect.notCarried ? true : Boolean(ideal.items[0] && satisfies(ideal.items[0], c.expect)), suggested: false, harmful: false },
        },
    });
}

mkdirSync(RESULTS_DIR, { recursive: true });
writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 1));

// ─── Report ──────────────────────────────────────────────────────────────────

const pct = (n: number, d: number) => (d === 0 ? "—" : `${Math.round((n / d) * 100)}%`);
const ARMS: Array<[Arm, string]> = [["search", "search as shipped"], ["closest", "+ closest match"], ["closestTable", "+ closest, use table"], ["ideal", "ideal filters"]];

function report(title: string, subset: typeof rows) {
    console.log(`\n${title} — ${subset.length} queries`);
    for (const [arm, name] of ARMS) {
        const o = subset.map((r) => r.outcomes[arm]);
        const suggested = o.filter((x) => x.suggested).length;
        console.log(
            `  ${name.padEnd(22)} nothing shown ${pct(o.filter((x) => x.empty).length, o.length).padStart(4)}`
            + `   first product right ${pct(o.filter((x) => x.right).length, o.length).padStart(4)}`
            + (arm.startsWith("closest") ? `   suggested ${String(suggested).padStart(3)}   harmful ${o.filter((x) => x.harmful).length}` : ""),
        );
    }
}

for (const split of ["tune", "holdout"] as const) report(split, rows.filter((r) => r.c.split === split));
report("all", rows);
report("use-table queries only", rows.filter((r) => r.c.viaUseTable));

latencies.sort((a, b) => a - b);
if (latencies.length) {
    const at = (q: number) => latencies[Math.min(latencies.length - 1, Math.floor(q * latencies.length))];
    console.log(`\nJev calls this run: ${latencies.length} (median ${at(0.5)} ms, p95 ${at(0.95)} ms), errors ${jevErrors}`);
} else {
    console.log(`\nJev calls this run: 0 (all cached), errors ${jevErrors}`);
}

if (VERBOSE) {
    console.log("\nPer query (search → closest with use table):");
    for (const r of rows) {
        const s = r.outcomes.search;
        const t = r.outcomes.closestTable;
        const mark = (o: Outcome) => (o.right ? "✓" : o.empty ? "∅" : "✗");
        console.log(`  ${r.c.id} ${r.c.split.padEnd(7)} ${mark(s)} → ${mark(t)}${t.harmful ? " HARMFUL" : ""}  ${r.c.text}${t.label ? `  [${t.label}]` : ""}`);
    }
}

const outPath = resolve(RESULTS_DIR, `catalog-search-interpret-${new Date().toISOString().slice(0, 10)}.json`);
writeFileSync(outPath, JSON.stringify({ model: JEV_MODEL, cases: CASES_PATH, rows }, null, 1));
console.log(`\nWrote ${outPath}`);
