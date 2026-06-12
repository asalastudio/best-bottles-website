#!/usr/bin/env node
/**
 * Build a true missing-only Best Bottles image generation manifest.
 *
 * Read-only against Madison Supabase/local data. Writes local manifest/evidence
 * files only. This prevents wasting paid image generation on SKUs that already
 * have Madison/Shopify/new-site image evidence.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const SITE_ROOT = "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026";
const MADISON_ROOT = "/Users/jordanrichter/Projects/Madison Studio/madison-app";
const ORG_ID = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const PIPELINE_LANE_ID = "grid-card-2000x2200";

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name, fallback = null) => {
    const idx = args.indexOf(name);
    return idx >= 0 ? args[idx + 1] ?? fallback : fallback;
  };
  return {
    maxRows: Number(get("--max-rows", "0")),
    mode: get("--mode", "cap-on"),
    material: get("--material", "all"), // all | clear | frosted
    outDir: get("--out-dir", `${MADISON_ROOT}/tmp`),
    name: get("--name", "best-bottles-missing-images-nb2"),
    evidenceScope: get("--evidence-scope", "madison-shopify"), // madison-shopify | all-site | shopify-only | generated-only
  };
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    const commentIdx = value.indexOf(" #");
    if (commentIdx >= 0) value = value.slice(0, commentIdx).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function clean(v) {
  return typeof v === "string" ? v.trim() : "";
}

function normalizeUrl(v) {
  return clean(v).replace(/\/+$/, "");
}

function collectStrings(value, out = []) {
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
    return out;
  }
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) collectStrings(child, out);
  }
  return out;
}

function collectImageUrls(value, out = []) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^https?:\/\//i.test(trimmed) && /(cdn\.shopify|shopify|supabase|storage|bestbottles\.com\/images|\.(png|jpe?g|webp|gif)(\?|$))/i.test(trimmed)) {
      out.push(trimmed);
    }
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectImageUrls(item, out);
    return out;
  }
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) collectImageUrls(child, out);
  }
  return out;
}

function rowIdentities(row) {
  const content = row?.published_content && typeof row.published_content === "object" ? row.published_content : {};
  const nested = content.pipelineSkuJob && typeof content.pipelineSkuJob === "object" ? content.pipelineSkuJob : {};
  const bb = content.bestBottlesConvex && typeof content.bestBottlesConvex === "object" ? content.bestBottlesConvex : {};
  const vals = [
    row?.grace_sku, row?.graceSku, row?.website_sku, row?.websiteSku, row?.shopify_sku, row?.shopifySku, row?.sku,
    row?.primary_grace_sku, row?.primaryGraceSku, row?.primary_website_sku, row?.primaryWebsiteSku,
    nested.graceSku, nested.grace_sku, nested.websiteSku, nested.website_sku, nested.shopifySku, nested.shopify_sku,
    bb.graceSku, bb.websiteSku, bb.shopifySku,
  ];
  return Array.from(new Set(vals.map(clean).filter(Boolean)));
}

async function fetchSupabaseTable(table, { supabaseUrl, supabaseKey, orgId, pageSize = 1000, maxPages = 20 }) {
  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    Accept: "application/json",
  };
  const base = `${normalizeUrl(supabaseUrl)}/rest/v1/${encodeURIComponent(table)}`;
  const rows = [];
  for (let page = 0; page < maxPages; page++) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const urls = [
      `${base}?select=*&organization_id=eq.${encodeURIComponent(orgId)}&limit=${pageSize}&offset=${from}`,
      `${base}?select=*&limit=${pageSize}&offset=${from}`,
    ];
    let data = null;
    for (const url of urls) {
      const res = await fetch(url, { headers });
      const text = await res.text();
      if (!res.ok) {
        if (/organization_id|column|PGRST/i.test(text)) continue;
        throw new Error(`${table}: ${res.status} ${text.slice(0, 240)}`);
      }
      data = text ? JSON.parse(text) : [];
      break;
    }
    if (!Array.isArray(data) || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

function loadCandidateRows(mode) {
  const dir = `${MADISON_ROOT}/tmp/best-bottles-${mode === "cap-off" ? "cap-off" : "cap-on"}-generation-cycles`;
  const paths = existsSync(dir)
    ? Array.from({ length: 99 }, (_, i) => `${dir}/cycle-${String(i + 1).padStart(2, "0")}.json`).filter(existsSync)
    : [];
  const bySku = new Map();
  for (const path of paths) {
    const data = JSON.parse(readFileSync(path, "utf8"));
    for (const row of data.rows ?? []) {
      if (!row.graceSku) continue;
      if (!bySku.has(row.graceSku)) bySku.set(row.graceSku, row);
    }
  }
  return Array.from(bySku.values());
}

function loadLocalImageEvidence() {
  const files = [
    "data/grace_products_final.json",
    "data/live-site-product-master.json",
    "pipeline/madison-hero-sync/catalog-enriched.json",
  ];
  const evidence = [];
  for (const rel of files) {
    const path = `${SITE_ROOT}/${rel}`;
    if (!existsSync(path)) continue;
    const raw = JSON.parse(readFileSync(path, "utf8"));
    let rows = [];
    if (Array.isArray(raw)) rows = raw;
    else if (raw && typeof raw === "object") rows = raw.products || raw.rows || Object.values(raw).filter((v) => v && typeof v === "object");
    for (const row of rows) {
      const ids = Array.from(new Set([
        row.grace_sku, row.graceSku, row.website_sku, row.websiteSku, row.shopify_sku, row.shopifySku, row.sku, row.legacyCode,
      ].map(clean).filter(Boolean)));
      const imageUrls = collectImageUrls(row);
      if (ids.length && imageUrls.length) evidence.push({ source: rel, ids, imageUrls: imageUrls.slice(0, 3) });
    }
  }
  return evidence;
}

function buildEvidenceIndex(records, source) {
  const exact = new Map();
  const fuzzy = [];
  for (const row of records) {
    const ids = rowIdentities(row);
    const imageUrls = collectImageUrls(row);
    const strings = collectStrings(row).join("\n");
    const record = { source, id: clean(row.id), ids, imageUrls: imageUrls.slice(0, 3), created_at: clean(row.created_at), updated_at: clean(row.updated_at) };
    for (const id of ids) {
      if (!exact.has(id)) exact.set(id, []);
      exact.get(id).push(record);
    }
    fuzzy.push({ ...record, strings });
  }
  return { exact, fuzzy };
}

function evidenceForCandidate(row, indexes, localEvidence, options) {
  const ids = [row.graceSku, row.websiteSku].map(clean).filter(Boolean);
  const evidence = [];
  for (const [name, idx] of Object.entries(indexes)) {
    for (const id of ids) {
      for (const rec of idx.exact.get(id) ?? []) evidence.push({ source: name, match: "exact", matchedId: id, recordId: rec.id, imageUrls: rec.imageUrls });
    }
    // For generated_images, IDs are often only in labels/session/prompt JSON, so allow text search when an image URL exists.
    if (name === "generated_images") {
      for (const rec of idx.fuzzy) {
        if (!rec.imageUrls.length) continue;
        const hit = ids.find((id) => rec.strings.includes(id));
        if (hit) evidence.push({ source: name, match: "fuzzy_text", matchedId: hit, recordId: rec.id, imageUrls: rec.imageUrls });
      }
    }
  }
  for (const rec of localEvidence) {
    const hit = ids.find((id) => rec.ids.includes(id));
    if (!hit) continue;
    const source = rec.source;
    // Local legacy image URLs are evidence for "already has a site/catalog image" but are less authoritative than publish logs.
    evidence.push({ source, match: "exact", matchedId: hit, recordId: "", imageUrls: rec.imageUrls });
  }
  return evidence;
}

function materialMatches(row, material) {
  if (material === "all") return true;
  const color = `${row.color ?? ""} ${row.graceSku ?? ""} ${row.productGroupSlug ?? ""}`.toLowerCase();
  if (material === "clear") return color.includes("clear") || row.graceSku?.includes("-CLR-");
  if (material === "frosted") return color.includes("frost") || row.graceSku?.includes("-FRS-");
  return true;
}

function isAuthoritativeEvidence(e, scope) {
  const hasImage = Array.isArray(e.imageUrls) && e.imageUrls.length > 0;
  if (!hasImage) return false;
  if (scope === "shopify-only") return e.source === "shopify_publish_log";
  if (scope === "generated-only") return e.source === "generated_images";
  if (scope === "all-site") {
    return e.source === "shopify_publish_log" ||
      e.source === "generated_images" ||
      e.source === "data/grace_products_final.json" ||
      e.source === "data/live-site-product-master.json";
  }
  // Default: Madison/Shopify production workflow evidence only.
  return e.source === "shopify_publish_log" || e.source === "generated_images";
}

async function main() {
  const options = parseArgs();
  loadEnvFile(resolve(SITE_ROOT, ".env.local"));
  loadEnvFile(resolve(MADISON_ROOT, ".env.local"));
  loadEnvFile(resolve(MADISON_ROOT, ".env"));
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase URL/key env");

  const candidatesAll = loadCandidateRows(options.mode).filter((row) => materialMatches(row, options.material));
  const [publishRows, generatedRows, groupRows, skuRows] = await Promise.all([
    fetchSupabaseTable("shopify_publish_log", { supabaseUrl, supabaseKey, orgId: ORG_ID }),
    fetchSupabaseTable("generated_images", { supabaseUrl, supabaseKey, orgId: ORG_ID }),
    fetchSupabaseTable("best_bottles_pipeline_groups", { supabaseUrl, supabaseKey, orgId: ORG_ID }),
    fetchSupabaseTable("best_bottles_pipeline_sku_jobs", { supabaseUrl, supabaseKey, orgId: ORG_ID }),
  ]);
  const indexes = {
    shopify_publish_log: buildEvidenceIndex(publishRows, "shopify_publish_log"),
    generated_images: buildEvidenceIndex(generatedRows, "generated_images"),
    best_bottles_pipeline_groups: buildEvidenceIndex(groupRows, "best_bottles_pipeline_groups"),
    best_bottles_pipeline_sku_jobs: buildEvidenceIndex(skuRows, "best_bottles_pipeline_sku_jobs"),
  };
  const localEvidence = loadLocalImageEvidence();

  const rows = [];
  const evidenceRows = [];
  const covered = [];
  for (const row of candidatesAll) {
    const ev = evidenceForCandidate(row, indexes, localEvidence, options);
    const authoritative = ev.filter((e) => isAuthoritativeEvidence(e, options.evidenceScope));
    const isMissing = authoritative.length === 0;
    const status = isMissing ? "missing" : "covered";
    evidenceRows.push({
      graceSku: row.graceSku,
      websiteSku: row.websiteSku,
      productGroupSlug: row.productGroupSlug,
      family: row.family,
      color: row.color,
      status,
      evidenceCount: ev.length,
      authoritativeEvidenceCount: authoritative.length,
      evidenceSources: Array.from(new Set(ev.map((e) => e.source))).join(";"),
      firstEvidence: ev[0] ? `${ev[0].source}:${ev[0].match}:${ev[0].matchedId}` : "",
    });
    if (isMissing) rows.push(row);
    else covered.push(row);
  }

  const selectedRows = options.maxRows > 0 ? rows.slice(0, options.maxRows) : rows;
  const now = new Date().toISOString();
  const safeName = options.name.replace(/[^a-z0-9_.-]+/gi, "-");
  mkdirSync(options.outDir, { recursive: true });
  const manifestPath = `${options.outDir}/${safeName}.json`;
  const evidenceJsonPath = `${options.outDir}/${safeName}-evidence.json`;
  const evidenceCsvPath = `${options.outDir}/${safeName}-evidence.csv`;
  const manifest = {
    generatedAt: now,
    source: "build_missing_best_bottles_image_manifest.mjs",
    sourceCandidateMode: options.mode,
    sourceCandidateMaterial: options.material,
    evidenceScope: options.evidenceScope,
    pipelineLaneId: PIPELINE_LANE_ID,
    mode: options.mode,
    cycleId: `${safeName}-${now.slice(0, 10)}`,
    launchOrder: 1,
    totalRows: selectedRows.length,
    totalMissingRowsBeforeMax: rows.length,
    totalCoveredRows: covered.length,
    rows: selectedRows.map((row, idx) => ({ ...row, cycleId: `${safeName}-${now.slice(0, 10)}`, launchOrder: idx + 1, pipelineLaneId: PIPELINE_LANE_ID, mode: options.mode })),
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  writeFileSync(evidenceJsonPath, JSON.stringify({
    generatedAt: now,
    candidates: candidatesAll.length,
    missing: rows.length,
    covered: covered.length,
    selected: selectedRows.length,
    supabaseRowsFetched: {
      shopify_publish_log: publishRows.length,
      generated_images: generatedRows.length,
      best_bottles_pipeline_groups: groupRows.length,
      best_bottles_pipeline_sku_jobs: skuRows.length,
    },
    rows: evidenceRows,
  }, null, 2));
  const csvHeaders = ["graceSku", "websiteSku", "productGroupSlug", "family", "color", "status", "evidenceCount", "authoritativeEvidenceCount", "evidenceSources", "firstEvidence"];
  const csv = [csvHeaders.join(","), ...evidenceRows.map((r) => csvHeaders.map((h) => JSON.stringify(String(r[h] ?? ""))).join(","))].join("\n") + "\n";
  writeFileSync(evidenceCsvPath, csv);

  console.log(JSON.stringify({
    candidates: candidatesAll.length,
    covered: covered.length,
    missing: rows.length,
    selected: selectedRows.length,
    supabaseRowsFetched: {
      shopify_publish_log: publishRows.length,
      generated_images: generatedRows.length,
      best_bottles_pipeline_groups: groupRows.length,
      best_bottles_pipeline_sku_jobs: skuRows.length,
    },
    manifestPath,
    evidenceJsonPath,
    evidenceCsvPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
