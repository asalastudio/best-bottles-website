#!/usr/bin/env tsx
/**
 * Grace catalogue search: today's word-list rules vs. Jev (TypeSafe) reading the request.
 *
 * For every labelled phrase in data/grace-evals/jev-intent-cases.json it compares:
 *   rules   — searchCatalog({ searchTerm }) exactly as today; the internal
 *             word lists decide applicator / family / colour.
 *   jev     — the same search plus the applicatorFilter / familyLimit Jev
 *             derives (src/lib/grace/jevIntent.ts). searchCatalog is unchanged.
 *   ideal   — the same search with the labelled answers as filters. The
 *             ceiling of the current search code given perfect understanding.
 *   grace   — (--grace-model) Grace's own text model fills searchCatalog's
 *             arguments from the phrase, as askGrace does in production.
 *   grace+jev — Grace's search term, with Jev's filters where Jev is confident.
 *   jev+table — jev, plus the draft use-case table (src/lib/grace/useCaseApplicators.ts)
 *             when the customer named no applicator but a use ("bottle for attar").
 *   route / route+table — (with Grace) Jev's search when Jev set a filter, else
 *             Grace's. Picked from the searches above; no extra calls.
 *
 * Two levels are scored: did the arm understand the request (intent), and do
 * the top products the search returns actually match (retrieval).
 *
 * Usage:
 *   npm run eval:grace:jev
 *   npm run eval:grace:jev -- --grace-model          # adds Grace's own text model (OpenAI tokens)
 *   npm run eval:grace:jev -- --grace-voice          # same, with the voice-mode model and effort
 *   npm run eval:grace:jev -- --threshold=0.7 --only=c001,c015 --verbose --fresh
 *   npm run eval:grace:jev -- --cases=data/grace-evals/jev-intent-cases-community.json
 *
 * Reads TYPESAFE_API_KEY, NEXT_PUBLIC_CONVEX_URL (and OPENAI_API_KEY for
 * --grace-model) from .env.local. Queries the Convex deployment in
 * .env.local (read-only). Jev and Grace-model answers are cached in
 * data/grace-evals/results/ so re-runs are free; --fresh ignores the cache.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import OpenAI from "openai";
import { anyApi } from "convex/server";
import { detectApplicatorIntent, detectCatalogColor, normalizeApplicatorValue, normalizeSearchTerm } from "../convex/graceSearchUtils";
import { GRACE_TOOLS, MODEL_TEXT, MODEL_VOICE } from "../convex/graceToolDefs";
import { buildSystemPrompt } from "../convex/gracePrompt";
import { CATALOG_FAMILIES, PRODUCT_APPLICATOR_VALUES, UNBUCKETED_APPLICATOR_VALUES, canonicalGlassColor, detectCatalogFamily } from "../src/lib/catalogFilters";
import {
    APPLICATOR_INTENT_FILTER_VALUES,
    JEV_MODEL,
    buildGraceIntentQuestions,
    classifyGraceIntent,
    intentToSearchArgs,
    isFilterableApplicatorIntent,
    type GraceIntentAnswers,
} from "../src/lib/grace/jevIntent";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RESULTS_DIR = resolve(ROOT, "data/grace-evals/results");
const CACHE_PATH = resolve(RESULTS_DIR, "jev-intent-cache.json");

// ─── Config ───────────────────────────────────────────────────────────────────

for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
}
const flag = (name: string) => process.argv.includes(`--${name}`);
const opt = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

const THRESHOLD = Number(opt("threshold") ?? 0.6);
const WITH_GRACE = flag("grace-model") || flag("grace-voice");
const FRESH = flag("fresh");
const VERBOSE = flag("verbose");
const ONLY = opt("only")?.split(",");
const CONCURRENCY = Number(opt("concurrency") ?? 6);
const TOP_K = 5;
// Grace's text model by default; --grace-voice uses the model and effort askGrace uses in voice mode.
const GRACE_VOICE = flag("grace-voice");
const GRACE_MODEL = GRACE_VOICE ? MODEL_VOICE : MODEL_TEXT;
const GRACE_EFFORT = GRACE_VOICE ? "minimal" : "low";

const TYPESAFE_API_KEY = process.env.TYPESAFE_API_KEY;
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
if (!TYPESAFE_API_KEY) throw new Error("TYPESAFE_API_KEY missing from .env.local");
if (!CONVEX_URL) throw new Error("NEXT_PUBLIC_CONVEX_URL missing from .env.local");
if (WITH_GRACE && !process.env.OPENAI_API_KEY) throw new Error("--grace-model needs OPENAI_API_KEY in .env.local");

const convex = new ConvexHttpClient(CONVEX_URL);
// convex/_generated/api.js is CommonJS-shaped and has no named ESM export under tsx; anyApi is the same reference.
const api = anyApi;

// ─── Cases ────────────────────────────────────────────────────────────────────

type Expect = {
    applicator: string;
    /** When applicator is "ambiguous": the intents a labeller would accept. Skipped for understanding, unioned for search relevance. */
    applicatorAny?: string[];
    family: string | null;
    /** Labeller could not decide the family (or colour); not graded. */
    familySkip?: boolean;
    glassColour: string | null;
    colourSkip?: boolean;
    /** Omit to skip grading. `null` means none named. */
    atomizerFinish?: string | null;
    /** Omit to skip grading. `null` means none named. */
    capFinish?: string | null;
    capacityMl: number | null;
    /** "unclear" is not graded. */
    wants: "complete_bottle" | "component_only" | "unclear";
    tassel: boolean | null;
};
type Case = { id: string; text: string; split: "tune" | "holdout"; expect: Expect; tags: string[] };

const CASES_PATH = opt("cases") ?? "data/grace-evals/jev-intent-cases.json";
const caseFile = JSON.parse(readFileSync(resolve(ROOT, CASES_PATH), "utf8"));
const cases: Case[] = (caseFile.cases as Case[]).filter((c) => !ONLY || ONLY.includes(c.id));

// ─── Cache ────────────────────────────────────────────────────────────────────

mkdirSync(RESULTS_DIR, { recursive: true });
const cache: Record<string, unknown> = !FRESH && existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, "utf8")) : {};
const saveCache = () => writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 1));

// ─── Applicator vocabularies ──────────────────────────────────────────────────

const ALL_APPLICATOR_VALUES = Array.from(new Set([
    ...PRODUCT_APPLICATOR_VALUES,
    ...UNBUCKETED_APPLICATOR_VALUES,
    "Antique Bulb Sprayer",
    "Antique Bulb Sprayer with Tassel",
]));
const BULB_VALUES = ["Vintage Bulb Sprayer", "Vintage Bulb Sprayer with Tassel", "Antique Bulb Sprayer", "Antique Bulb Sprayer with Tassel"];

/** Which stored applicator values count as a right answer, per labelled intent (broader than the filters). */
function acceptableApplicators(expect: Expect): Set<string> | null {
    if (expect.applicator === "ambiguous") {
        const union = new Set<string>();
        for (const intent of expect.applicatorAny ?? []) {
            for (const value of acceptableApplicators({ ...expect, applicator: intent, applicatorAny: undefined }) ?? []) union.add(value);
        }
        return union.size ? union : null;
    }
    switch (expect.applicator) {
        case "rollon": return new Set(["Metal Roller Ball", "Plastic Roller Ball", "Metal Roller", "Plastic Roller"]);
        case "spray": return new Set(["Fine Mist Sprayer", "Perfume Spray Pump", "Atomizer", "Metal Atomizer", ...BULB_VALUES]);
        case "bulb_spray": {
            if (expect.tassel === true) return new Set(BULB_VALUES.filter((v) => v.endsWith("Tassel")));
            if (expect.tassel === false) return new Set(BULB_VALUES.filter((v) => !v.endsWith("Tassel")));
            return new Set(BULB_VALUES);
        }
        case "lotionpump": return new Set(["Lotion Pump"]);
        case "dropper": return new Set(["Dropper"]);
        case "reducer": return new Set(["Reducer"]);
        case "cap": return new Set(["Cap/Closure"]);
        case "stopper": return new Set(["Glass Stopper", "Glass Rod"]);
        default: return null;
    }
}

/** The applicator values today's internal regex keeps (convex/grace.ts variant filter). */
const RULE_PATTERNS: Record<string, RegExp> = {
    rollon: /(roller|roll)/i, spray: /(spray|atomizer|mist)/i, dropper: /dropper/i, pump: /pump/i, reducer: /reducer/i,
};
const valuesMatching = (re: RegExp) => new Set(ALL_APPLICATOR_VALUES.filter((v) => re.test(v)));

function parseFilterValues(filter: string | null | undefined): { values: Set<string>; invalid: string[] } | null {
    if (!filter) return null;
    const values = new Set<string>();
    const invalid: string[] = [];
    for (const raw of filter.split(",").map((s) => s.trim()).filter(Boolean)) {
        const normalized = normalizeApplicatorValue(raw);
        if (normalized && ALL_APPLICATOR_VALUES.includes(normalized)) values.add(normalized);
        else invalid.push(raw);
    }
    return { values, invalid };
}

// ─── Intent grading ───────────────────────────────────────────────────────────

type Outcome = "correct" | "correct_none" | "wrong" | "missed" | "false_filter";

function gradeApplicator(expect: Expect, armValues: Set<string> | null): Outcome | null {
    if (expect.applicator === "ambiguous") return null;
    const acceptable = acceptableApplicators(expect);
    if (!acceptable) return armValues && armValues.size > 0 ? "false_filter" : "correct_none";
    if (!armValues || armValues.size === 0) return "missed";
    return [...armValues].some((v) => acceptable.has(v)) ? "correct" : "wrong";
}

function gradeValue(expected: string | null, got: string | null): Outcome {
    if (!expected) return got ? "false_filter" : "correct_none";
    if (!got) return "missed";
    return expected.toLowerCase() === got.toLowerCase() ? "correct" : "wrong";
}

/** `undefined` on the label means the field is not graded for that case. */
function gradeOptionalFinish(expected: string | null | undefined, got: string | null): Outcome | null {
    if (expected === undefined) return null;
    return gradeValue(expected, got);
}

// ─── Retrieval grading ────────────────────────────────────────────────────────

type Row = { itemName?: string; applicator?: string | null; family?: string | null; canonicalColor?: string | null; color?: string | null; capacityMl?: number | null; graceSku?: string };

function rowIsRelevant(row: Row, expect: Expect): boolean {
    const acceptable = acceptableApplicators(expect);
    if (acceptable) {
        const applicator = normalizeApplicatorValue(row.applicator ?? "");
        if (!applicator || !acceptable.has(applicator)) return false;
    }
    if (expect.family && (row.family ?? "").toLowerCase() !== expect.family.toLowerCase()) return false;
    if (expect.glassColour) {
        const colour = canonicalGlassColor(row.canonicalColor ?? row.color ?? null);
        if (colour !== expect.glassColour) return false;
    }
    if (expect.capacityMl !== null) {
        const ml = row.capacityMl;
        const tolerance = Math.max(1, expect.capacityMl * 0.1);
        if (typeof ml !== "number" || Math.abs(ml - expect.capacityMl) > tolerance) return false;
    }
    return true;
}

function isRetrievalCase(c: Case): boolean {
    if (c.expect.wants === "component_only" || c.expect.applicator === "not_carried") return false;
    return Boolean(acceptableApplicators(c.expect) || c.expect.family || c.expect.glassColour || c.expect.capacityMl !== null);
}

type SearchArgs = { searchTerm: string; applicatorFilter?: string; familyLimit?: string; categoryLimit?: string };
type ArmRun = { args: SearchArgs; rows: Row[]; ms: number; error?: string };

async function search(args: SearchArgs): Promise<ArmRun> {
    const clean = Object.fromEntries(Object.entries(args).filter(([, v]) => v !== undefined && v !== null && v !== "")) as SearchArgs;
    const started = Date.now();
    try {
        const rows = await convex.query(api.grace.searchCatalog, clean);
        return { args: clean, rows: Array.isArray(rows) ? (rows as Row[]) : [], ms: Date.now() - started };
    } catch (error) {
        return { args: clean, rows: [], ms: Date.now() - started, error: error instanceof Error ? error.message : String(error) };
    }
}

function retrievalScore(run: ArmRun, expect: Expect) {
    const top = run.rows.slice(0, TOP_K);
    const relevant = top.filter((row) => rowIsRelevant(row, expect)).length;
    return {
        empty: run.rows.length === 0,
        hit1: top.length > 0 && rowIsRelevant(top[0], expect),
        precision: top.length ? relevant / top.length : 0,
        any: relevant > 0,
        anyInAll: run.rows.some((row) => rowIsRelevant(row, expect)),
    };
}

// ─── Jev and Grace-model calls (cached) ───────────────────────────────────────

// Any change to the question wording invalidates cached answers.
const QUESTIONS_HASH = createHash("sha256").update(JSON.stringify(buildGraceIntentQuestions())).digest("hex").slice(0, 12);

async function jevFor(text: string): Promise<{ answers: GraceIntentAnswers; ms: number; tokens: number | null; model: string } | { error: string }> {
    const key = `jev:${JEV_MODEL}:${QUESTIONS_HASH}:${text}`;
    if (cache[key]) return cache[key] as never;
    const result = await classifyGraceIntent({ request: text }, { apiKey: TYPESAFE_API_KEY!, timeoutMs: 10_000 });
    if (!result.ok) return { error: result.error };
    const value = { answers: result.answers, ms: result.ms, tokens: result.inputTokens, model: result.model };
    cache[key] = value;
    return value;
}

const openai = WITH_GRACE ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
// askGrace reads the text channel (six catalogue tools, links instead of navigation tools).
const GRACE_SYSTEM_PROMPT = WITH_GRACE ? buildSystemPrompt({ channel: "text" }) : "";
const SEARCH_TOOL = GRACE_TOOLS.find((tool) => tool.type === "function" && tool.function.name === "searchCatalog")!;

async function graceArgsFor(text: string): Promise<{ args: Record<string, string | null>; ms: number } | { error: string }> {
    const key = `grace:${GRACE_MODEL}:${GRACE_EFFORT}:${text}`;
    if (cache[key]) return cache[key] as never;
    const started = Date.now();
    try {
        const completion = await openai!.chat.completions.create({
            model: GRACE_MODEL,
            reasoning_effort: GRACE_EFFORT,
            messages: [
                { role: "system", content: GRACE_SYSTEM_PROMPT },
                { role: "user", content: text },
            ],
            tools: [SEARCH_TOOL],
            tool_choice: { type: "function", function: { name: "searchCatalog" } },
        } as never);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const call = (completion as any).choices?.[0]?.message?.tool_calls?.[0];
        if (!call) return { error: "no tool call" };
        const value = { args: JSON.parse(call.function.arguments), ms: Date.now() - started };
        cache[key] = value;
        return value;
    } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
    }
}

// ─── Run ──────────────────────────────────────────────────────────────────────

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const out: R[] = new Array(items.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const index = next++;
            out[index] = await fn(items[index]);
        }
    }));
    return out;
}

type ArmName = "rules" | "jev" | "jev+table" | "ideal" | "grace" | "grace+jev" | "route" | "route+table";
const ARMS: ArmName[] = WITH_GRACE
    ? ["rules", "jev", "jev+table", "ideal", "grace", "grace+jev", "route", "route+table"]
    : ["rules", "jev", "jev+table", "ideal"];

function idealArgs(c: Case): SearchArgs {
    const args: SearchArgs = { searchTerm: c.text };
    if (c.expect.applicator === "ambiguous") {
        const values = (c.expect.applicatorAny ?? []).filter(isFilterableApplicatorIntent).flatMap((intent) => [...APPLICATOR_INTENT_FILTER_VALUES[intent]]);
        if (values.length) args.applicatorFilter = values.join(",");
    } else if (isFilterableApplicatorIntent(c.expect.applicator)) {
        let values = [...APPLICATOR_INTENT_FILTER_VALUES[c.expect.applicator]];
        if (c.expect.applicator === "bulb_spray" && c.expect.tassel === true) values = values.filter((v) => v.endsWith("with Tassel"));
        if (c.expect.applicator === "bulb_spray" && c.expect.tassel === false) values = values.filter((v) => !v.endsWith("with Tassel"));
        args.applicatorFilter = values.join(",");
    }
    if (c.expect.family) args.familyLimit = c.expect.family;
    return args;
}

console.log(`Cases: ${CASES_PATH}`);
console.log(`Grace search: rules vs Jev — ${cases.length} cases, threshold ${THRESHOLD}, arms: ${ARMS.join(", ")}`);
console.log(`Convex: ${CONVEX_URL.replace(/\/\/([a-z]+-[a-z]+)-\d+/, "//$1-***")}  Jev model: ${JEV_MODEL}${WITH_GRACE ? `  Grace model: ${GRACE_MODEL} (${GRACE_EFFORT} effort)` : ""}\n`);

const results = await pool(cases, CONCURRENCY, async (c) => {
    const normalized = normalizeSearchTerm(c.text) || c.text;
    const ruleIntent = detectApplicatorIntent(normalized);
    const rules = {
        applicator: ruleIntent ? valuesMatching(RULE_PATTERNS[ruleIntent]) : null,
        applicatorLabel: ruleIntent ?? "(none)",
        family: detectCatalogFamily(normalized.toLowerCase()),
        colour: detectCatalogColor(normalized.toLowerCase()),
    };

    const jev = await jevFor(c.text);
    const jevArgs = "answers" in jev ? intentToSearchArgs(jev.answers, { minConfidence: THRESHOLD, requestText: c.text }) : null;
    const jevTableArgs = "answers" in jev ? intentToSearchArgs(jev.answers, { minConfidence: THRESHOLD, useCaseTable: true, requestText: c.text }) : null;

    let grace: { args: Record<string, string | null>; ms: number } | { error: string } | null = null;
    if (WITH_GRACE) grace = await graceArgsFor(c.text);
    const graceArgs = grace && "args" in grace ? grace.args : null;
    const graceFilter = parseFilterValues(graceArgs?.applicatorFilter ?? null);
    const graceFamily = graceArgs?.familyLimit && CATALOG_FAMILIES.includes(graceArgs.familyLimit) ? graceArgs.familyLimit : null;

    const runs: Partial<Record<ArmName, ArmRun>> = {};
    runs.rules = await search({ searchTerm: c.text });
    runs.jev = await search({ searchTerm: c.text, applicatorFilter: jevArgs?.applicatorFilter, familyLimit: jevArgs?.familyLimit });
    runs["jev+table"] = jevTableArgs?.applicatorFilter === jevArgs?.applicatorFilter
        ? runs.jev
        : await search({ searchTerm: c.text, applicatorFilter: jevTableArgs?.applicatorFilter, familyLimit: jevTableArgs?.familyLimit });
    runs.ideal = await search(idealArgs(c));
    if (WITH_GRACE && graceArgs) {
        const base: SearchArgs = {
            searchTerm: graceArgs.searchTerm ?? c.text,
            categoryLimit: graceArgs.categoryLimit ?? undefined,
            familyLimit: graceArgs.familyLimit ?? undefined,
            applicatorFilter: graceArgs.applicatorFilter ?? undefined,
        };
        runs.grace = await search(base);
        runs["grace+jev"] = await search({
            ...base,
            applicatorFilter: jevArgs?.applicatorFilter ?? (graceFilter && graceFilter.values.size ? [...graceFilter.values].join(",") : undefined),
            familyLimit: jevArgs?.familyLimit ?? graceFamily ?? undefined,
        });
    }

    const jevFilterValues = jevArgs?.applicatorFilter ? new Set(jevArgs.applicatorFilter.split(",")) : null;
    const intent = {
        applicator: {
            rules: gradeApplicator(c.expect, rules.applicator),
            jev: jevArgs ? gradeApplicator(c.expect, jevFilterValues) : null,
            grace: graceArgs ? gradeApplicator(c.expect, graceFilter?.values ?? null) : null,
        },
        family: c.expect.familySkip ? { rules: null, jev: null, grace: null } : {
            rules: gradeValue(c.expect.family, rules.family),
            jev: jevArgs ? gradeValue(c.expect.family, jevArgs.familyLimit ?? null) : null,
            grace: graceArgs ? gradeValue(c.expect.family, graceFamily) : null,
        },
        colour: c.expect.colourSkip ? { rules: null, jev: null } : {
            rules: gradeValue(c.expect.glassColour, rules.colour),
            jev: jevArgs ? gradeValue(c.expect.glassColour, jevArgs.glassColour ?? null) : null,
        },
        atomizerFinish: {
            jev: jevArgs ? gradeOptionalFinish(c.expect.atomizerFinish, jevArgs.atomizerFinish ?? null) : null,
        },
        capFinish: {
            jev: jevArgs ? gradeOptionalFinish(c.expect.capFinish, jevArgs.capFinish ?? null) : null,
        },
        wants: "answers" in jev && c.expect.wants !== "unclear" ? (jev.answers.wants.choice === c.expect.wants ? "correct" : "wrong") : null,
    };

    const retrieval: Partial<Record<ArmName, ReturnType<typeof retrievalScore>>> | null = isRetrievalCase(c)
        ? Object.fromEntries(Object.entries(runs).map(([arm, run]) => [arm, retrievalScore(run!, c.expect)]))
        : null;
    if (retrieval && WITH_GRACE && retrieval.grace) {
        const jevFiltered = Boolean(jevArgs?.applicatorFilter || jevArgs?.familyLimit);
        const tableFiltered = Boolean(jevTableArgs?.applicatorFilter || jevTableArgs?.familyLimit);
        retrieval.route = jevFiltered ? retrieval.jev : retrieval.grace;
        retrieval["route+table"] = tableFiltered ? retrieval["jev+table"] : retrieval.grace;
    }

    return {
        case: c,
        rules: { ...rules, applicator: rules.applicator ? [...rules.applicator] : null },
        jev: "answers" in jev
            ? {
                applicator: `${jev.answers.applicator.choice} @ ${jev.answers.applicator.confidence.toFixed(2)}`,
                family: `${jev.answers.family.choice} @ ${jev.answers.family.confidence.toFixed(2)}`,
                colour: `${jev.answers.glass_colour.choice} @ ${jev.answers.glass_colour.confidence.toFixed(2)}`,
                atomizerFinish: jev.answers.atomizer_finish
                    ? `${jev.answers.atomizer_finish.choice} @ ${jev.answers.atomizer_finish.confidence.toFixed(2)}`
                    : null,
                capFinish: jev.answers.cap_finish
                    ? `${jev.answers.cap_finish.choice} @ ${jev.answers.cap_finish.confidence.toFixed(2)}`
                    : null,
                wants: `${jev.answers.wants.choice} @ ${jev.answers.wants.confidence.toFixed(2)}`,
                tassel: jev.answers.tassel.noul,
                decisions: jevArgs?.decisions,
                tableDecisions: jevTableArgs?.decisions,
                useCase: jev.answers.use_case ? `${jev.answers.use_case.choice} @ ${jev.answers.use_case.confidence.toFixed(2)}` : null,
                travel: jev.answers.travel?.noul ?? null,
                ms: jev.ms,
                tokens: jev.tokens,
                raw: jev.answers,
            }
            : { error: jev.error },
        grace: graceArgs ? { args: graceArgs, invalidApplicatorValues: graceFilter?.invalid ?? [] } : grace,
        intent,
        retrieval,
        searches: Object.fromEntries(Object.entries(runs).map(([arm, run]) => [arm, {
            args: run!.args,
            ms: run!.ms,
            error: run!.error,
            top: run!.rows.slice(0, TOP_K).map((r) => `${r.itemName} [${r.applicator ?? "-"} | ${r.family ?? "-"} | ${r.canonicalColor ?? r.color ?? "-"} | ${r.capacityMl ?? "-"}ml]`),
        }])),
    };
});
saveCache();

// ─── Summaries ────────────────────────────────────────────────────────────────

type R = (typeof results)[number];
const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "—");

function intentSummary(rows: R[], field: "applicator" | "family" | "colour" | "atomizerFinish" | "capFinish", arm: "rules" | "jev" | "grace") {
    const outcomes = rows.map((r) => (r.intent[field] as Record<string, Outcome | null>)[arm]).filter((o): o is Outcome => Boolean(o));
    const count = (o: Outcome) => outcomes.filter((x) => x === o).length;
    const right = count("correct") + count("correct_none");
    return {
        n: outcomes.length,
        right,
        accuracy: pct(right, outcomes.length),
        harmful: count("wrong") + count("false_filter"),
        missed: count("missed"),
        detail: `correct ${count("correct")}, correct-none ${count("correct_none")}, missed ${count("missed")}, wrong ${count("wrong")}, false filter ${count("false_filter")}`,
    };
}

function retrievalSummary(rows: R[], arm: ArmName) {
    const scored = rows.filter((r) => r.retrieval && r.retrieval.ideal?.anyInAll && r.retrieval[arm]);
    const s = scored.map((r) => r.retrieval![arm]!);
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    return {
        n: s.length,
        hit1: pct(s.filter((x) => x.hit1).length, s.length),
        precision: `${Math.round(100 * mean(s.map((x) => x.precision)))}%`,
        any: pct(s.filter((x) => x.any).length, s.length),
        empty: s.filter((x) => x.empty).length,
    };
}

function paired(rows: R[], a: ArmName, b: ArmName) {
    const scored = rows.filter((r) => r.retrieval && r.retrieval.ideal?.anyInAll && r.retrieval[a] && r.retrieval[b]);
    let wins = 0, losses = 0;
    const lost: string[] = [];
    for (const r of scored) {
        const d = r.retrieval![b]!.precision - r.retrieval![a]!.precision;
        if (d > 0.001) wins++;
        else if (d < -0.001) { losses++; lost.push(r.case.id); }
    }
    return { wins, losses, ties: scored.length - wins - losses, lost };
}

const lines: string[] = [];
const say = (s = "") => { lines.push(s); console.log(s); };

for (const split of ["tune", "holdout", "all"] as const) {
    const rows = results.filter((r) => split === "all" || r.case.split === split);
    if (!rows.length) continue;
    say(`\n══ ${split.toUpperCase()} (${rows.length} cases) ══`);
    say("Understanding the request (share of cases right; 'harmful' = a filter that hides the right products):");
    for (const field of ["applicator", "family", "colour", "atomizerFinish", "capFinish"] as const) {
        const finishField = field === "atomizerFinish" || field === "capFinish";
        const arms = finishField
            ? (["jev"] as const)
            : field === "colour"
                ? (["rules", "jev"] as const)
                : WITH_GRACE ? (["rules", "jev", "grace"] as const) : (["rules", "jev"] as const);
        for (const arm of arms) {
            const s = intentSummary(rows, field, arm);
            if (finishField && s.n === 0) continue;
            say(`  ${field.padEnd(14)} ${arm.padEnd(6)} ${s.accuracy.padStart(4)}  (${s.right}/${s.n})  harmful ${s.harmful}  missed ${s.missed}   [${s.detail}]`);
        }
    }
    const wantsRows = rows.filter((r) => r.intent.wants);
    say(`  bottle-or-part  jev ${pct(wantsRows.filter((r) => r.intent.wants === "correct").length, wantsRows.length)} (${wantsRows.filter((r) => r.intent.wants === "correct").length}/${wantsRows.length})`);

    say(`Search results (top ${TOP_K}, cases the ideal filters can satisfy):`);
    for (const arm of ARMS) {
        const s = retrievalSummary(rows, arm);
        say(`  ${arm.padEnd(10)} first result right ${s.hit1.padStart(4)}   top-${TOP_K} precision ${s.precision.padStart(4)}   any right in top ${TOP_K} ${s.any.padStart(4)}   empty ${s.empty}   (n=${s.n})`);
    }
    const comparisons: Array<[ArmName, ArmName]> = [["rules", "jev"], ["jev", "jev+table"]];
    if (WITH_GRACE) comparisons.push(["grace", "grace+jev"], ["grace", "route"], ["grace", "route+table"]);
    for (const [a, b] of comparisons) {
        const p = paired(rows, a, b);
        say(`  ${b} vs ${a}, per case: better ${p.wins}, worse ${p.losses}, same ${p.ties}${p.lost.length && split !== "holdout" ? `  (worse: ${p.lost.join(", ")})` : ""}`);
    }
}

const unsatisfiable = results.filter((r) => r.retrieval && !r.retrieval.ideal?.anyInAll).map((r) => r.case.id);
say(`\nCases where even the ideal filters found nothing matching (catalogue gap or search limit, excluded above): ${unsatisfiable.length ? unsatisfiable.join(", ") : "none"}`);

say("\nJev applicator understanding by confidence threshold (all cases, no extra calls):");
for (const t of [0.5, 0.6, 0.7, 0.8, 0.9]) {
    const outcomes = results.filter((r) => "raw" in r.jev).map((r) => {
        const args = intentToSearchArgs((r.jev as { raw: GraceIntentAnswers }).raw, { minConfidence: t, requestText: r.case.text });
        return gradeApplicator(r.case.expect, args.applicatorFilter ? new Set(args.applicatorFilter.split(",")) : null);
    }).filter((o): o is Outcome => o !== null);
    const right = outcomes.filter((o) => o === "correct" || o === "correct_none").length;
    say(`  ≥${t.toFixed(1)}  right ${pct(right, outcomes.length)}   harmful ${outcomes.filter((o) => o === "wrong" || o === "false_filter").length}   missed ${outcomes.filter((o) => o === "missed").length}`);
}

const jevMs = results.map((r) => ("ms" in r.jev ? (r.jev.ms as number) : null)).filter((x): x is number => x !== null).sort((a, b) => a - b);
const jevErrors = results.filter((r) => "error" in r.jev).length;
if (jevMs.length) {
    say(`\nJev latency (uncached calls only; cached runs show the original timing): median ${jevMs[Math.floor(jevMs.length / 2)]} ms, p95 ${jevMs[Math.floor(jevMs.length * 0.95)]} ms, max ${jevMs[jevMs.length - 1]} ms. Errors: ${jevErrors}.`);
}
if (WITH_GRACE) {
    const graceMs = results.map((r) => cache[`grace:${GRACE_MODEL}:${GRACE_EFFORT}:${r.case.text}`] as { ms?: number } | undefined)
        .map((v) => v?.ms).filter((x): x is number => typeof x === "number").sort((a, b) => a - b);
    if (graceMs.length) say(`Grace model (${GRACE_MODEL}, ${GRACE_EFFORT}) choosing the search: median ${graceMs[Math.floor(graceMs.length / 2)]} ms, p95 ${graceMs[Math.floor(graceMs.length * 0.95)]} ms.`);
    const invalid = results.filter((r) => r.grace && "invalidApplicatorValues" in r.grace && (r.grace.invalidApplicatorValues as string[]).length);
    say(`Grace model sent applicator values the catalogue does not have in ${invalid.length} case(s)${invalid.length ? `: ${invalid.map((r) => `${r.case.id} ${JSON.stringify((r.grace as { invalidApplicatorValues: string[] }).invalidApplicatorValues)}`).join("; ")}` : ""}.`);
}

if (VERBOSE) {
    say("\nPer-case detail (tune split only):");
    for (const r of results.filter((x) => x.case.split === "tune")) {
        const flagged = r.intent.applicator.rules !== r.intent.applicator.jev || r.intent.family.rules !== r.intent.family.jev || r.intent.colour.rules !== r.intent.colour.jev;
        if (!flagged && !process.argv.includes("--all-cases")) continue;
        say(`  ${r.case.id} "${r.case.text}"  expect ${JSON.stringify(r.case.expect)}`);
        say(`     rules: applicator ${r.rules.applicatorLabel} (${r.intent.applicator.rules}), family ${r.rules.family ?? "-"} (${r.intent.family.rules}), colour ${r.rules.colour ?? "-"} (${r.intent.colour.rules})`);
        if ("applicator" in r.jev) say(`     jev:   applicator ${r.jev.applicator} (${r.intent.applicator.jev}), family ${r.jev.family} (${r.intent.family.jev}), colour ${r.jev.colour} (${r.intent.colour.jev}), wants ${r.jev.wants}`);
        if (r.retrieval) say(`     top-${TOP_K} precision: ${Object.entries(r.retrieval).map(([arm, s]) => `${arm} ${Math.round(100 * s!.precision)}%`).join("  ")}`);
    }
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outJson = resolve(RESULTS_DIR, `jev-intent-${stamp}.json`);
writeFileSync(outJson, JSON.stringify({ ranAt: new Date().toISOString(), cases: CASES_PATH, threshold: THRESHOLD, jevModel: JEV_MODEL, graceModel: WITH_GRACE ? `${GRACE_MODEL}:${GRACE_EFFORT}` : null, arms: ARMS, summary: lines, results }, null, 1));
console.log(`\nFull results: ${outJson.replace(ROOT + "/", "")}`);
