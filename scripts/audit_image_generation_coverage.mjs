#!/usr/bin/env node
/**
 * Full-catalog Best Bottles image generation coverage audit.
 *
 * Read-only against Convex, Madison Supabase, Shopify/CDN evidence, and local
 * reference folders. Writes local audit artifacts only.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import {
    DEFAULT_LOCAL_REFERENCE_DIRS,
    buildImageGenerationAudit,
    buildLocalReferencesBySku,
    buildMadisonEvidenceBySku,
    scanLocalReferenceImages,
    writeAuditArtifacts,
} from "./lib/image-generation-coverage.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const DEFAULT_MADISON_REPO = "/Users/jordanrichter/Projects/Madison Studio/madison-app";
const DEFAULT_ORG_ID = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const DEFAULT_TABLES = [
    "shopify_publish_log",
    "generated_images",
    "paper_doll_approved_assets",
    "best_bottles_pipeline_sku_jobs",
    "best_bottles_pipeline_groups",
];

function loadEnvFile(filePath) {
    if (!existsSync(filePath)) return;
    for (const rawLine of readFileSync(filePath, "utf8").split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#") || !line.includes("=")) continue;
        const eqIdx = line.indexOf("=");
        const key = line.slice(0, eqIdx).trim();
        let value = line.slice(eqIdx + 1).trim();
        if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        const commentIdx = value.indexOf(" #");
        if (commentIdx >= 0) value = value.slice(0, commentIdx).trim();
        if (!process.env[key]) process.env[key] = value;
    }
}

function argValue(name, fallback = null) {
    const index = process.argv.indexOf(name);
    if (index < 0) return fallback;
    const value = process.argv[index + 1];
    return value && !value.startsWith("--") ? value : fallback;
}

function parseArgs() {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const madisonRepo = argValue("--madison-repo", process.env.MADISON_REPO_PATH || DEFAULT_MADISON_REPO);
    return {
        madisonRepo,
        convexUrl: argValue("--convex-url", process.env.NEXT_PUBLIC_CONVEX_URL),
        orgId: argValue("--org-id", process.env.MADISON_BEST_BOTTLES_ORG_ID || DEFAULT_ORG_ID),
        outDir: resolve(argValue("--out-dir", `data/audits/image-generation-coverage-${date}`)),
        mode: argValue("--mode", "cap-on"),
        family: argValue("--family", null),
        noSupabase: process.argv.includes("--no-supabase"),
        json: process.argv.includes("--json"),
        localSourceDirs: (argValue("--local-source-dirs", null)?.split(",").map((value) => value.trim()).filter(Boolean)) || DEFAULT_LOCAL_REFERENCE_DIRS,
        supabaseTables: (argValue("--supabase-tables", null)?.split(",").map((value) => value.trim()).filter(Boolean)) || DEFAULT_TABLES,
    };
}

function normalizeUrl(value) {
    return String(value || "").trim().replace(/\/+$/, "");
}

function postgrestValue(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/,/g, "\\,");
}

async function fetchJson(url, headers) {
    let response;
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            response = await fetch(url, { method: "GET", headers });
            break;
        } catch (error) {
            lastError = error;
            if (attempt < 3) await new Promise((resolveRetry) => setTimeout(resolveRetry, attempt * 500));
        }
    }
    if (!response) throw lastError;
    const text = await response.text();
    let body = null;
    try {
        body = text ? JSON.parse(text) : null;
    } catch {
        body = text;
    }
    if (!response.ok) {
        const message = body && typeof body === "object" && "message" in body
            ? body.message
            : text || response.statusText;
        throw new Error(`${response.status} ${message}`);
    }
    return body;
}

async function fetchSupabaseTable({ supabaseUrl, supabaseKey, table, orgId, limit = 1000, maxPages = 30 }) {
    const headers = {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Accept: "application/json",
    };
    const rows = [];
    const base = `${normalizeUrl(supabaseUrl)}/rest/v1/${encodeURIComponent(table)}`;
    for (let page = 0; page < maxPages; page += 1) {
        const offset = page * limit;
        const urls = [
            `${base}?select=*&organization_id=eq.${postgrestValue(orgId)}&limit=${limit}&offset=${offset}`,
            `${base}?select=*&limit=${limit}&offset=${offset}`,
        ];
        let data = null;
        const attempts = [];
        for (const url of urls) {
            try {
                data = await fetchJson(url, headers);
                break;
            } catch (error) {
                attempts.push(error.message);
                if (!/organization_id|PGRST|column/i.test(error.message)) throw error;
            }
        }
        if (!Array.isArray(data)) {
            throw new Error(`Unable to query ${table}: ${attempts.join(" | ")}`);
        }
        if (data.length === 0) break;
        rows.push(...data);
        if (data.length < limit) break;
    }
    return rows;
}

async function fetchMadisonRecords(options) {
    if (options.noSupabase) return { recordsBySource: {}, warnings: ["Supabase evidence disabled with --no-supabase."] };
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !supabaseKey) return { recordsBySource: {}, warnings: ["Missing Supabase URL/key; Madison generated evidence was not folded into coverage."] };

    const settled = await Promise.allSettled(options.supabaseTables.map(async (table) => {
        const rows = await fetchSupabaseTable({
            supabaseUrl,
            supabaseKey,
            table,
            orgId: options.orgId,
        });
        return [table, rows];
    }));
    const recordsBySource = {};
    const warnings = [];
    for (let i = 0; i < settled.length; i += 1) {
        const result = settled[i];
        const table = options.supabaseTables[i];
        if (result.status === "fulfilled") {
            const [source, rows] = result.value;
            recordsBySource[source] = rows;
        } else {
            recordsBySource[table] = [];
            warnings.push(`Unable to query ${table}: ${result.reason?.message || result.reason}`);
        }
    }
    return { recordsBySource, warnings };
}

async function fetchConvexProducts(convexUrl) {
    if (!convexUrl) throw new Error("Missing NEXT_PUBLIC_CONVEX_URL or --convex-url.");
    const convex = new ConvexHttpClient(convexUrl);
    const products = [];
    let cursor = null;
    while (true) {
        const result = await convex.action(api.products.getProductExportPage, {
            cursor,
            numItems: 250,
        });
        products.push(...result.page);
        if (result.isDone) return products;
        cursor = result.continueCursor;
    }
}

async function main() {
    const options = parseArgs();
    loadEnvFile(resolve(ROOT, ".env.local"));
    loadEnvFile(resolve(options.madisonRepo, ".env.local"));
    loadEnvFile(resolve(options.madisonRepo, ".env"));

    if (!options.convexUrl) options.convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    const productsAll = await fetchConvexProducts(options.convexUrl);
    const products = options.family
        ? productsAll.filter((product) => product.family === options.family)
        : productsAll;
    const localImages = scanLocalReferenceImages({
        root: ROOT,
        sourceDirs: options.localSourceDirs,
    });
    const [{ recordsBySource, warnings: supabaseWarnings }] = await Promise.all([
        fetchMadisonRecords(options),
    ]);

    const localReferencesBySku = buildLocalReferencesBySku({ products, localImages });
    const madisonEvidenceBySku = buildMadisonEvidenceBySku({ products, recordsBySource });
    const audit = buildImageGenerationAudit({
        products,
        localReferencesBySku,
        madisonEvidenceBySku,
    });
    audit.inputs = {
        convexUrl: options.convexUrl,
        family: options.family || "ALL",
        localReferenceImageFiles: localImages.length,
        localSourceDirs: options.localSourceDirs,
        madisonSupabaseTables: Object.fromEntries(Object.entries(recordsBySource).map(([key, rows]) => [key, rows.length])),
        supabaseWarnings,
    };

    const paths = writeAuditArtifacts({
        audit,
        outDir: options.outDir,
        root: ROOT,
        mode: options.mode,
    });

    const result = {
        outDir: options.outDir,
        paths,
        inputs: audit.inputs,
        summary: audit.summary,
    };
    console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
    console.error(error?.stack || error?.message || error);
    process.exit(1);
});
