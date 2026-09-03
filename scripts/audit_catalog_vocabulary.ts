#!/usr/bin/env tsx
/**
 * Catalogue vocabulary drift audit.
 *
 * Pulls every productGroup from the Convex deployment in .env.local (or the
 * one passed with --url) and diffs the live distinct values against the
 * canonical lists in src/lib/catalogFilters.ts — the lists Convex, the
 * sidebar, the fallback, Grace's tool schemas and the Shopify push all share.
 *
 *   npm run audit:catalog-vocabulary
 *   npx tsx scripts/audit_catalog_vocabulary.ts --url https://precise-raccoon-123.convex.cloud
 *
 * Exit code 1 when live data carries a value no consumer can reach.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
    APPLICATOR_BUCKETS,
    CANONICAL_GLASS_COLORS,
    CATALOG_CATEGORY_VALUES,
    CATALOG_FAMILIES,
    COMPONENT_FAMILIES,
    UNBUCKETED_APPLICATOR_VALUES,
    canonicalGlassColor,
} from "../src/lib/catalogFilters";

function loadEnvLocal() {
    try {
        const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
        for (const line of content.split("\n")) {
            const match = line.match(/^([^#=]+)=(.*)$/);
            if (match && !process.env[match[1].trim()]) {
                process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
            }
        }
    } catch {
        /* no .env.local — rely on the environment */
    }
}

type Group = {
    category: string;
    family: string | null;
    color: string | null;
    neckThreadSize: string | null;
    bottleCollection: string | null;
    applicatorTypes?: string[];
    capacityMl: number | null;
};

const VALID_THREAD_PATTERN = /^\d{1,3}[-/]\d{3,4}$|^\d{1,3}(?:\.\d+)?mm$/i;

async function main() {
    loadEnvLocal();
    const urlFlag = process.argv.indexOf("--url");
    const url = (urlFlag >= 0 ? process.argv[urlFlag + 1] : process.env.NEXT_PUBLIC_CONVEX_URL)?.replace(/\/+$/, "");
    if (!url) throw new Error("Set NEXT_PUBLIC_CONVEX_URL or pass --url");

    const response = await fetch(`${url}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "products:getAllCatalogGroups", args: {}, format: "json" }),
    });
    const payload = (await response.json()) as { status: string; value?: Group[]; errorMessage?: string };
    if (payload.status !== "success" || !payload.value) throw new Error(payload.errorMessage ?? "query failed");
    const groups = payload.value;

    const count = <T,>(values: Iterable<T>) => {
        const out = new Map<T, number>();
        for (const value of values) out.set(value, (out.get(value) ?? 0) + 1);
        return out;
    };
    const fmt = (map: Map<string, number>, keys: string[]) => keys.map((key) => `${key} (${map.get(key)})`).join(", ") || "none";

    let failures = 0;
    const section = (title: string) => console.log(`\n== ${title} ==`);

    // Categories
    const categories = count(groups.map((g) => g.category));
    const unknownCategories = [...categories.keys()].filter((c) => c !== "Internal" && !(CATALOG_CATEGORY_VALUES as readonly string[]).includes(c));
    const phantomCategories = CATALOG_CATEGORY_VALUES.filter((c) => !categories.has(c));
    section(`categories — ${categories.size} distinct in data, ${CATALOG_CATEGORY_VALUES.length} canonical`);
    console.log(`in data but not canonical (Grace cannot request them): ${fmt(categories, unknownCategories)}`);
    console.log(`canonical but absent from data: ${phantomCategories.join(", ") || "none"}`);
    if (unknownCategories.length) failures += 1;

    // Families
    const families = count(groups.map((g) => g.family ?? "(null)"));
    const unknownFamilies = [...families.keys()].filter((f) => f !== "(null)" && !CATALOG_FAMILIES.includes(f) && !COMPONENT_FAMILIES.includes(f));
    const phantomFamilies = CATALOG_FAMILIES.filter((f) => !families.has(f));
    section(`families — ${families.size} distinct in data, ${CATALOG_FAMILIES.length} canonical + ${COMPONENT_FAMILIES.length} component lines`);
    console.log(`in data but unclassified: ${fmt(families, unknownFamilies)}`);
    console.log(`canonical but absent from data: ${phantomFamilies.join(", ") || "none"}`);
    if (unknownFamilies.length) failures += 1;

    // Applicators
    const applicators = count(groups.flatMap((g) => g.applicatorTypes ?? []));
    const reachable = new Set<string>(APPLICATOR_BUCKETS.flatMap((b) => [...b.productValues]));
    const unreachable = [...applicators.keys()].filter((a) => !reachable.has(a) && !(UNBUCKETED_APPLICATOR_VALUES as readonly string[]).includes(a));
    section(`applicatorTypes — ${applicators.size} distinct in data`);
    console.log(`not reachable from any Product Type bucket: ${fmt(applicators, unreachable)}`);
    for (const bucket of APPLICATOR_BUCKETS) {
        const total = bucket.productValues.reduce((sum, value) => sum + (applicators.get(value) ?? 0), 0);
        console.log(`  ${bucket.value.padEnd(20)} ${String(total).padStart(4)} groups`);
    }
    if (unreachable.length) failures += 1;

    // Colours
    const colors = count(groups.map((g) => g.color ?? "(null)"));
    const nonCanonical = [...colors.keys()].filter((c) => c !== "(null)" && canonicalGlassColor(c) !== c);
    const unknownColors = [...colors.keys()].filter((c) => c !== "(null)" && !(CANONICAL_GLASS_COLORS as readonly string[]).includes(canonicalGlassColor(c) ?? ""));
    section(`glass colours — ${colors.size} distinct in data`);
    console.log(`raw spellings folded by canonicalGlassColor: ${fmt(colors, nonCanonical)}`);
    console.log(`outside the canonical list entirely: ${fmt(colors, unknownColors)}`);

    // Neck threads
    const threads = count(groups.map((g) => g.neckThreadSize ?? "(null)"));
    const hiddenThreads = [...threads.keys()].filter((t) => t !== "(null)" && !VALID_THREAD_PATTERN.test(t));
    section(`neck threads — ${threads.size} distinct in data`);
    console.log(`values the sidebar regex hides (still counted in results): ${fmt(threads, hiddenThreads)}`);

    // Capacities
    const capacities = [...new Set(groups.map((g) => g.capacityMl).filter((c): c is number => c != null))].sort((a, b) => a - b);
    section(`capacities — ${capacities.length} distinct ml values`);
    console.log(capacities.join(", "));

    console.log(`\n${groups.length} groups audited against ${url}. ${failures ? `${failures} hard gap(s).` : "No hard gaps."}`);
    process.exit(failures ? 1 : 0);
}

main().catch((error) => {
    console.error(error);
    process.exit(2);
});
