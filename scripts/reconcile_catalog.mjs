#!/usr/bin/env node
/**
 * Best Bottles catalog reconciliation.
 *
 * Compares the canonical CSV (`data/grace_products_final.v2.csv`) against
 * every other source of truth — Convex, Sanity, master_v8.3 — and writes
 * a markdown report showing divergence.
 *
 * Usage:
 *   node scripts/reconcile_catalog.mjs                       # local sources only
 *   node scripts/reconcile_catalog.mjs --convex-url <url>     # include Convex
 *   node scripts/reconcile_catalog.mjs --sanity-project <id>  # include Sanity
 *   node scripts/reconcile_catalog.mjs --apply               # write report
 *
 * Default mode is dry-run (prints to stdout). --apply writes to
 * reports/reconciliation-<date>.md.
 *
 * Sources compared:
 *   CSV          data/grace_products_final.v2.csv   (canonical, 2285 rows)
 *   master_v8.3  data/master_v8.3_products.json     (legacy master sheet, 3179 entries)
 *   Convex       productGroups + products tables    (live catalog)
 *   Sanity       productGroupContent documents      (editorial overrides)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

// ── arg parsing ──────────────────────────────────────────────────
function parseArgs(argv) {
  const args = {
    csv: path.join(REPO_ROOT, "data", "grace_products_final.v2.csv"),
    master: path.join(REPO_ROOT, "data", "master_v8.3_products.json"),
    convexUrl: null,
    sanityProjectId: null,
    sanityDataset: "production",
    sanityToken: null,
    apply: false,
    out: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    switch (key) {
      case "--csv":            args.csv = path.resolve(argv[++i]); break;
      case "--master":         args.master = path.resolve(argv[++i]); break;
      case "--convex-url":     args.convexUrl = argv[++i]; break;
      case "--sanity-project": args.sanityProjectId = argv[++i]; break;
      case "--sanity-dataset": args.sanityDataset = argv[++i]; break;
      case "--sanity-token":   args.sanityToken = argv[++i]; break;
      case "--apply":          args.apply = true; break;
      case "--out":            args.out = path.resolve(argv[++i]); break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown arg: ${key}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Reconcile CSV ↔ Convex ↔ Sanity ↔ master_v8.3.

Usage:
  node scripts/reconcile_catalog.mjs                       # local sources only
  node scripts/reconcile_catalog.mjs --convex-url <url>     # include Convex
  node scripts/reconcile_catalog.mjs --sanity-project <id>  # include Sanity
  node scripts/reconcile_catalog.mjs --apply               # write report to disk

Options:
  --csv PATH            Path to canonical CSV (default v2)
  --master PATH         Path to master_v8.3 JSON
  --convex-url URL      Convex deployment URL (enables Convex comparison)
  --sanity-project ID   Sanity project ID (enables Sanity comparison)
  --sanity-dataset NAME Sanity dataset (default "production")
  --sanity-token TOKEN  Sanity API token (optional, public datasets work without)
  --apply               Write report to disk instead of stdout
  --out PATH            Output path (default reports/reconciliation-<date>.md)
`);
}

// ── CSV read ──────────────────────────────────────────────────────
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) { out.push(cur); cur = ""; }
    else { cur += ch; }
  }
  out.push(cur);
  return out;
}

function readCsv(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) =>
    Object.fromEntries(headers.map((h, i) => [h, parseCsvLine(line)[i] ?? ""]))
  );
}

// ── Convex read ──────────────────────────────────────────────────
async function fetchConvex(url) {
  // Query Convex HTTP API. We use the query endpoint directly.
  // https://docs.convex.dev/http-api/
  try {
    const res = await fetch(`${url}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "products:getAllCatalogGroups",
        args: {},
        format: "json",
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.value ?? data;
  } catch (err) {
    return { _error: err.message };
  }
}

// ── Sanity read ──────────────────────────────────────────────────
async function fetchSanity(projectId, dataset, token) {
  const query = `*[_type == "productGroupContent"] { _id, title, "slug": slug.current }`;
  const url = `https://${projectId}.api.sanity.io/v2025-02-19/data/query/${dataset}?query=${encodeURIComponent(query)}`;
  try {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.result ?? [];
  } catch (err) {
    return { _error: err.message };
  }
}

// ── Source loaders ──────────────────────────────────────────────
function loadCsv(filePath) {
  return readCsv(filePath) ?? [];
}

function loadMaster(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

// ── Reconciliation logic ─────────────────────────────────────────
function reconcile(csv, master, convex, sanity) {
  // Normalize each source into a {graceSku, websiteSku} set keyed by
  // graceSku. CSV has both fields. master has both. Convex/Sanity use
  // canonicalSlug — we fuzzy-match back to graceSku via the slug.

  const csvBySku = new Map();
  for (const r of csv) {
    if (r.grace_sku) csvBySku.set(r.grace_sku.trim(), r);
  }

  const masterBySku = new Map();
  const masterGraceSkus = new Set();
  const masterWebsiteSkus = new Set();
  for (const m of master) {
    if (m.graceSku) {
      masterBySku.set(m.graceSku, m);
      masterGraceSkus.add(m.graceSku);
    }
    if (m.websiteSku) masterWebsiteSkus.add(m.websiteSku);
  }

  const csvGraceSkus = new Set();
  for (const r of csv) if (r.grace_sku) csvGraceSkus.add(r.grace_sku.trim());

  // CSV ↔ master overlap
  const inCsvOnly = [...csvGraceSkus].filter((s) => !masterGraceSkus.has(s));
  const inMasterOnly = [...masterGraceSkus].filter((s) => !csvGraceSkus.has(s));
  const inBoth = [...csvGraceSkus].filter((s) => masterGraceSkus.has(s));

  // Convex overlap (compare by canonicalSlug → graceSku)
  let convexSummary = null;
  if (Array.isArray(convex)) {
    const convexByGroupId = new Map();
    for (const g of convex) convexByGroupId.set(String(g._id), g);
    let matchedToCsv = 0;
    let matchedToMaster = 0;
    let matchedToNeither = 0;
    const convexOnly = [];
    const slugsByConvex = new Set();
    for (const g of convex) {
      slugsByConvex.add(g.slug);
      // Try to find a CSV row whose canonical_slug matches this group's slug
      let matched = false;
      for (const r of csv) {
        if (r.canonical_slug === g.slug) {
          matched = true;
          matchedToCsv++;
          break;
        }
      }
      if (!matched) {
        for (const m of master) {
          if (m.graceSku === g.primaryGraceSku || m.websiteSku === g.primaryWebsiteSku) {
            matched = true;
            matchedToMaster++;
            break;
          }
        }
      }
      if (!matched) {
        matchedToNeither++;
        convexOnly.push({
          slug: g.slug,
          family: g.family,
          displayName: g.displayName,
          primaryGraceSku: g.primaryGraceSku,
          variantCount: g.variantCount,
        });
      }
    }
    convexSummary = {
      totalGroups: convex.length,
      matchedToCsv,
      matchedToMaster,
      matchedToNeither,
      convexOnly: convexOnly.slice(0, 30),
    };
  }

  // Sanity overlap (compare by slug)
  let sanitySummary = null;
  if (Array.isArray(sanity)) {
    const sanitySlugs = new Set();
    const sanityOrphans = [];
    for (const s of sanity) {
      const slug = s.slug || "";
      if (slug) sanitySlugs.add(slug);
    }
    const csvSlugs = new Set();
    for (const r of csv) if (r.canonical_slug) csvSlugs.add(r.canonical_slug);

    const sanityOnly = [...sanitySlugs].filter((s) => !csvSlugs.has(s));
    const csvOnlySlugs = [...csvSlugs].filter((s) => !sanitySlugs.has(s));
    const inBothSlugs = [...sanitySlugs].filter((s) => csvSlugs.has(s));

    sanitySummary = {
      totalDocuments: sanity.length,
      uniqueSlugs: sanitySlugs.size,
      inBothSlugs: inBothSlugs.length,
      sanityOnly: sanityOnly.slice(0, 30),
      csvOnlySlugs: csvOnlySlugs.slice(0, 30),
    };
  }

  // ProductGroup coverage — how many (family, capacity, color, applicator)
  // tuples are represented in CSV vs Convex
  const csvGroups = new Map();
  for (const r of csv) {
    if (!r.family || !r.color) continue;
    const key = `${r.family}|${r.capacity}|${r.color}|`;
    csvGroups.set(key, (csvGroups.get(key) || 0) + 1);
  }

  return {
    csv: { totalRows: csv.length, withGraceSku: csvGraceSkus.size, withColor: csv.filter((r) => r.color && r.color !== "n/a").length },
    master: { totalEntries: master.length, uniqueGraceSkus: masterGraceSkus.size, uniqueWebsiteSkus: masterWebsiteSkus.size },
    overlap: {
      inBoth: inBoth.length,
      csvOnly: inCsvOnly.length,
      masterOnly: inMasterOnly.length,
      sample_csvOnly: inCsvOnly.slice(0, 10),
      sample_masterOnly: inMasterOnly.slice(0, 10),
    },
    convex: convexSummary,
    sanity: sanitySummary,
    productGroups: { totalUnique: csvGroups.size },
  };
}

// ── Markdown report ─────────────────────────────────────────────
function renderMarkdown(r) {
  const lines = [];
  const ts = new Date().toISOString();

  lines.push(`# Catalog Reconciliation Report`);
  lines.push(``);
  lines.push(`Generated: ${ts}`);
  lines.push(``);
  lines.push(`## Sources`);
  lines.push(``);
  lines.push(`| Source | Records | Notes |`);
  lines.push(`|---|---|---|`);
  lines.push(`| **CSV (canonical)** | ${r.csv.totalRows} rows | \`data/grace_products_final.v2.csv\` |`);
  lines.push(`| **master_v8.3** | ${r.master.totalEntries} entries | \`data/master_v8.3_products.json\` |`);
  if (r.convex) lines.push(`| **Convex productGroups** | ${r.convex.totalGroups} groups | live catalog |`);
  if (r.sanity) lines.push(`| **Sanity productGroupContent** | ${r.sanity.totalDocuments} documents | editorial overrides |`);
  lines.push(``);

  lines.push(`## CSV self-coverage`);
  lines.push(``);
  lines.push(`- Rows with graceSku: **${r.csv.withGraceSku}** / ${r.csv.totalRows}`);
  lines.push(`- Rows with valid color: **${r.csv.withColor}** / ${r.csv.totalRows}`);
  lines.push(`- Distinct (family, capacity, color) tuples: **${r.productGroups.totalUnique}**`);
  lines.push(``);

  lines.push(`## CSV ↔ master_v8.3 (graceSku overlap)`);
  lines.push(``);
  lines.push(`| Set | Count |`);
  lines.push(`|---|---|`);
  lines.push(`| In both | **${r.overlap.inBoth}** |`);
  lines.push(`| CSV only (not in master) | ${r.overlap.csvOnly} |`);
  lines.push(`| master_v8.3 only (not in CSV) | ${r.overlap.masterOnly} |`);
  lines.push(``);

  if (r.overlap.sample_csvOnly.length > 0) {
    lines.push(`### Sample CSV-only graceSkus`);
    lines.push(``);
    for (const s of r.overlap.sample_csvOnly) lines.push(`- \`${s}\``);
    lines.push(``);
  }
  if (r.overlap.sample_masterOnly.length > 0) {
    lines.push(`### Sample master-only graceSkus`);
    lines.push(``);
    for (const s of r.overlap.sample_masterOnly) lines.push(`- \`${s}\``);
    lines.push(``);
  }

  if (r.convex) {
    lines.push(`## Convex productGroups coverage`);
    lines.push(``);
    lines.push(`- Total groups: **${r.convex.totalGroups}**`);
    lines.push(`- Matched to CSV canonical_slug: ${r.convex.matchedToCsv}`);
    lines.push(`- Matched to master_v8.3 (by primaryGraceSku): ${r.convex.matchedToMaster}`);
    lines.push(`- Matched to neither: ${r.convex.matchedToNeither}`);
    lines.push(``);
    if (r.convex.convexOnly.length > 0) {
      lines.push(`### Convex groups with no CSV/master match (first 30)`);
      lines.push(``);
      lines.push(`| Slug | Family | Primary graceSku | variantCount |`);
      lines.push(`|---|---|---|---|`);
      for (const g of r.convex.convexOnly) {
        lines.push(`| \`${g.slug}\` | ${g.family} | ${g.primaryGraceSku || ""} | ${g.variantCount || ""} |`);
      }
      lines.push(``);
    }
  }

  if (r.sanity) {
    lines.push(`## Sanity productGroupContent coverage`);
    lines.push(``);
    lines.push(`- Total documents: **${r.sanity.totalDocuments}**`);
    lines.push(`- Unique slugs: ${r.sanity.uniqueSlugs}`);
    lines.push(`- Matched to CSV canonical_slug: ${r.sanity.inBothSlugs}`);
    lines.push(``);
    if (r.sanity.sanityOnly.length > 0) {
      lines.push(`### Sanity-only slugs (first 30)`);
      lines.push(``);
      for (const s of r.sanity.sanityOnly) lines.push(`- \`${s}\``);
      lines.push(``);
    }
    if (r.sanity.csvOnlySlugs.length > 0) {
      lines.push(`### CSV-only slugs (first 30, missing Sanity document)`);
      lines.push(``);
      for (const s of r.sanity.csvOnlySlugs) lines.push(`- \`${s}\``);
      lines.push(``);
    }
  }

  lines.push(`## Recommendations`);
  lines.push(``);
  lines.push(`1. **CSV is the canonical source.** Any SKUs in master_v8.3 or Convex not in CSV are candidates for archival.`);
  lines.push(`2. **The \`canonical_slug\` column in v2 CSV is the join key.** Use it for any CSV ↔ Convex ↔ Sanity reconciliation.`);
  lines.push(`3. **Convex groups with no CSV match** may be legacy orphans. Decide: archive them, or add them to the CSV.`);
  lines.push(`4. **Sanity documents with no CSV match** are likely orphaned editorial overrides. Reconcile manually.`);
  lines.push(`5. **Run this report daily** after any CSV edit. The numbers should stabilize as Phase 2 (rebuildProductGroupsFromCsv) lands.`);
  lines.push(``);

  return lines.join("\n");
}

// ── main ─────────────────────────────────────────────────────────
async function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); }
  catch (err) { console.error(`Error: ${err.message}`); printHelp(); process.exit(2); }

  console.log("Loading sources...");
  const csv = loadCsv(args.csv);
  const master = loadMaster(args.master);

  let convex = null;
  if (args.convexUrl) {
    console.log(`  Fetching Convex from ${args.convexUrl}...`);
    convex = await fetchConvex(args.convexUrl);
    if (convex && convex._error) {
      console.log(`  Convex error: ${convex._error}`);
      convex = null;
    }
  } else {
    console.log("  Skipping Convex (no --convex-url)");
  }

  let sanity = null;
  if (args.sanityProjectId) {
    console.log(`  Fetching Sanity ${args.sanityProjectId}/${args.sanityDataset}...`);
    sanity = await fetchSanity(args.sanityProjectId, args.sanityDataset, args.sanityToken);
    if (sanity && sanity._error) {
      console.log(`  Sanity error: ${sanity._error}`);
      sanity = null;
    }
  } else {
    console.log("  Skipping Sanity (no --sanity-project)");
  }

  console.log(`\n  CSV: ${csv.length} rows`);
  console.log(`  master_v8.3: ${master.length} entries`);
  if (convex) console.log(`  Convex: ${convex.length} groups`);
  if (sanity) console.log(`  Sanity: ${sanity.length} documents`);

  const result = reconcile(csv, master, convex, sanity);
  const md = renderMarkdown(result);

  if (!args.apply) {
    console.log("\n=== DRY RUN — reconciliation report (printed to stdout) ===\n");
    console.log(md);
    return;
  }

  const outPath = args.out || path.join(
    REPO_ROOT, "reports", `reconciliation-${new Date().toISOString().slice(0, 10)}.md`
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, md);
  console.log(`\nWrote: ${outPath}`);
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});