#!/usr/bin/env node
/**
 * Build Best Bottles reference-backed generation manifests.
 *
 * Operational rule: generate every prompt-ready SKU that has a usable reference.
 * Local references are immediately generatable. Live-site references are tracked
 * as fallback candidates and can be downloaded/normalized in a later step.
 *
 * This script performs no network or database writes.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, relative, resolve } from "node:path";

const SITE_ROOT = "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026";
const MADISON_ROOT = "/Users/jordanrichter/Projects/Madison Studio/madison-app";
const PIPELINE_LANE_ID = "grid-card-2000x2200";
const DEFAULT_OUT_DIR = `${MADISON_ROOT}/tmp`;

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name, fallback = null) => {
    const idx = args.indexOf(name);
    return idx >= 0 ? args[idx + 1] ?? fallback : fallback;
  };
  return {
    mode: get("--mode", "cap-on"),
    material: get("--material", "all"),
    maxRows: Number(get("--max-rows", "0")) || Infinity,
    outDir: get("--out-dir", DEFAULT_OUT_DIR),
    name: get("--name", "best-bottles-reference-backed-cap-on"),
    chunkSize: Number(get("--chunk-size", "150")) || 150,
  };
}

function loadCatalog() {
  const p = `${SITE_ROOT}/pipeline/madison-hero-sync/catalog-enriched.json`;
  const raw = JSON.parse(readFileSync(p, "utf8"));
  return Array.isArray(raw) ? raw : raw.products || raw.rows || [];
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function lower(value) {
  return clean(value).toLowerCase();
}

function materialBucket(row) {
  const color = lower(row.color);
  const sku = clean(row.graceSku).toUpperCase();
  const family = lower(row.family);
  if (color.includes("frost") || sku.includes("-FRS-")) return "frosted";
  if (color.includes("clear") || sku.includes("-CLR-")) return "clear";
  if (color.includes("amber") || sku.includes("-AMB-")) return "amber";
  if (color.includes("black") || sku.includes("-BLK-")) return "black";
  if (family.includes("aluminum") || sku.startsWith("AB-")) return "metal";
  if (family.includes("plastic") || sku.startsWith("PB-")) return "plastic";
  return color || "unknown";
}

function matchesMaterial(row, filter) {
  if (!filter || filter === "all") return true;
  return materialBucket(row) === filter;
}

function promptMissing(row) {
  const required = ["applicator", "capStyle", "capColor", "heightWithoutCap", "heightWithCap", "diameter"];
  return required.filter((field) => !clean(row[field]) && row[field] !== 0);
}

function isHttpImage(value) {
  return /^https?:\/\//i.test(clean(value)) && /\.(png|jpe?g|webp|gif)(\?|$)|bestbottles\.com\/images|cdn\.shopify|storage\/v1\/object/i.test(clean(value));
}

function scanSkuPngs(root) {
  const map = new Map();
  const rootAbs = resolve(root);
  if (!existsSync(rootAbs)) return map;
  const stack = [rootAbs];
  while (stack.length) {
    const dir = stack.pop();
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const p = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        stack.push(p);
        continue;
      }
      if (!entry.isFile() || extname(entry.name).toLowerCase() !== ".png" || entry.name.startsWith("_")) continue;
      const stem = basename(entry.name, ".png");
      const sku = stem.includes("__") ? stem.split("__", 1)[0] : stem.replace(/-body$/, "");
      if (!map.has(sku)) map.set(sku, p);
    }
  }
  return map;
}

function buildReferenceIndex() {
  const sources = [
    {
      name: "madison-master",
      root: `${SITE_ROOT}/pipeline/madison-hero-sync/renders/madison-masters-2080x2288-all-families-2026-05-08`,
    },
    {
      name: "pdp-reference-flattened",
      root: `${SITE_ROOT}/pipeline/aios-shopify-pdp-images/00-input/reference-flattened`,
    },
    {
      name: "paper-doll-reference",
      root: `${SITE_ROOT}/pipeline/paper-doll/reference-images`,
    },
  ];
  const bySku = new Map();
  for (const source of sources) {
    const m = scanSkuPngs(source.root);
    for (const [sku, path] of m) {
      if (!bySku.has(sku)) bySku.set(sku, []);
      bySku.get(sku).push({ source: source.name, path });
    }
  }
  return bySku;
}

function preferredReference(sku, refs) {
  const candidates = refs.get(sku) || [];
  const priority = ["madison-master", "pdp-reference-flattened", "paper-doll-reference"];
  return candidates.sort((a, b) => priority.indexOf(a.source) - priority.indexOf(b.source))[0] || null;
}

function productGroupSlug(row) {
  return clean(row.productGroupSlug) || clean(row.product_group_slug) || lower([row.family, row.capacityMl, row.color, row.applicator].filter(Boolean).join("-"))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function manifestRow(row, ref, idx, cycleId, mode) {
  return {
    cycleId,
    launchOrder: idx,
    pipelineLaneId: PIPELINE_LANE_ID,
    mode,
    graceSku: row.graceSku,
    websiteSku: row.websiteSku || null,
    family: row.family || null,
    productGroupSlug: productGroupSlug(row),
    productGroupDisplayName: row.itemName || row.displayName || row.graceDescription || null,
    applicator: row.applicator || null,
    capacityMl: row.capacityMl != null ? String(row.capacityMl) : null,
    color: row.color || null,
    materialBucket: materialBucket(row),
    referenceSource: ref.source,
    bestReferenceCandidatePath: relative(SITE_ROOT, ref.path),
    absoluteReferencePath: ref.path,
    liveReferenceUrl: isHttpImage(row.imageUrl) ? row.imageUrl : null,
    expectedCanonicalFilename: row.websiteSku ? `${row.graceSku}__${row.websiteSku}__pdp-main__v001.png` : `${row.graceSku}__pdp-main__v001.png`,
  };
}

function writeCsv(path, rows) {
  const headers = ["graceSku", "websiteSku", "family", "materialBucket", "promptReady", "referenceStatus", "referenceSource", "absoluteReferencePath", "liveReferenceUrl", "missingPromptFields"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  writeFileSync(path, [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n"));
}

function main() {
  const opts = parseArgs();
  const now = new Date().toISOString();
  const outDir = resolve(opts.outDir);
  mkdirSync(outDir, { recursive: true });
  const catalog = loadCatalog().filter((row) => clean(row.graceSku) && matchesMaterial(row, opts.material));
  const refs = buildReferenceIndex();
  const auditRows = [];
  const localReady = [];
  const liveFallbackReady = [];
  const noReferenceReady = [];
  const promptIncomplete = [];

  for (const row of catalog) {
    const sku = clean(row.graceSku);
    const missing = promptMissing(row);
    const localRef = preferredReference(sku, refs);
    const liveUrl = isHttpImage(row.imageUrl) ? clean(row.imageUrl) : "";
    const promptReady = missing.length === 0;
    let referenceStatus = "none";
    let referenceSource = "";
    let absoluteReferencePath = "";
    if (localRef) {
      referenceStatus = "local";
      referenceSource = localRef.source;
      absoluteReferencePath = localRef.path;
    } else if (liveUrl) {
      referenceStatus = "live-site-fallback";
      referenceSource = "bestbottles.com-live";
    }
    const audit = {
      graceSku: sku,
      websiteSku: clean(row.websiteSku),
      family: clean(row.family),
      materialBucket: materialBucket(row),
      promptReady,
      referenceStatus,
      referenceSource,
      absoluteReferencePath,
      liveReferenceUrl: liveUrl,
      missingPromptFields: missing.join(";"),
    };
    auditRows.push(audit);
    if (!promptReady) {
      promptIncomplete.push(audit);
    } else if (localRef) {
      localReady.push({ row, ref: localRef });
    } else if (liveUrl) {
      liveFallbackReady.push(audit);
    } else {
      noReferenceReady.push(audit);
    }
  }

  const selected = localReady.slice(0, opts.maxRows);
  const cycleId = `${opts.name}-2026-06-09`;
  const manifest = {
    generatedAt: now,
    source: "build_reference_backed_image_manifest.mjs",
    operationalRule: "generate every prompt-ready SKU with a usable reference image; local references first; live bestbottles.com as fallback after local pass",
    sourceCandidateMode: opts.mode,
    sourceCandidateMaterial: opts.material,
    referenceScope: "local-reference-first",
    pipelineLaneId: PIPELINE_LANE_ID,
    mode: opts.mode,
    cycleId,
    launchOrder: 1,
    totalRows: selected.length,
    totalCatalogRowsConsidered: catalog.length,
    promptReadyLocalReferenceRows: localReady.length,
    promptReadyLiveFallbackRows: liveFallbackReady.length,
    promptReadyNoReferenceRows: noReferenceReady.length,
    promptIncompleteRows: promptIncomplete.length,
    rows: selected.map(({ row, ref }, i) => manifestRow(row, ref, i + 1, cycleId, opts.mode)),
  };
  const base = `${outDir}/${opts.name}`;
  writeFileSync(`${base}.json`, JSON.stringify(manifest, null, 2));
  writeCsv(`${base}-audit.csv`, auditRows);
  writeFileSync(`${base}-audit.json`, JSON.stringify({ generatedAt: now, options: opts, summary: manifest, rows: auditRows }, null, 2));

  const chunks = [];
  for (let i = 0; i < manifest.rows.length; i += opts.chunkSize) {
    const idx = Math.floor(i / opts.chunkSize) + 1;
    const chunkRows = manifest.rows.slice(i, i + opts.chunkSize).map((r, j) => ({ ...r, launchOrder: j + 1, cycleId: `${opts.name}-batch-${String(idx).padStart(3, "0")}-2026-06-09` }));
    const chunk = { ...manifest, cycleId: `${opts.name}-batch-${String(idx).padStart(3, "0")}-2026-06-09`, totalRows: chunkRows.length, sourceManifest: `${base}.json`, chunkIndex: idx, chunkCount: Math.ceil(manifest.rows.length / opts.chunkSize), rows: chunkRows };
    const p = `${outDir}/${opts.name}-batch-${String(idx).padStart(3, "0")}.json`;
    writeFileSync(p, JSON.stringify(chunk, null, 2));
    chunks.push({ path: p, rows: chunkRows.length });
  }

  const byMaterial = {};
  for (const r of auditRows) {
    byMaterial[r.materialBucket] ||= { total: 0, promptReadyLocal: 0, promptReadyLiveFallback: 0, promptReadyNoReference: 0, promptIncomplete: 0 };
    byMaterial[r.materialBucket].total += 1;
    if (!r.promptReady) byMaterial[r.materialBucket].promptIncomplete += 1;
    else if (r.referenceStatus === "local") byMaterial[r.materialBucket].promptReadyLocal += 1;
    else if (r.referenceStatus === "live-site-fallback") byMaterial[r.materialBucket].promptReadyLiveFallback += 1;
    else byMaterial[r.materialBucket].promptReadyNoReference += 1;
  }

  const result = {
    manifestPath: `${base}.json`,
    auditCsvPath: `${base}-audit.csv`,
    auditJsonPath: `${base}-audit.json`,
    chunkCount: chunks.length,
    chunks,
    counts: {
      totalCatalogRowsConsidered: catalog.length,
      promptReadyLocalReferenceRows: localReady.length,
      promptReadyLiveFallbackRows: liveFallbackReady.length,
      promptReadyNoReferenceRows: noReferenceReady.length,
      promptIncompleteRows: promptIncomplete.length,
      selectedRows: selected.length,
    },
    byMaterial,
  };
  console.log(JSON.stringify(result, null, 2));
}

main();
