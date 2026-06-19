#!/usr/bin/env node
/**
 * Read-only SKU → Convex product → Shopify variant image correctness audit.
 *
 * This does NOT judge pixels directly. It creates the full join and flags rows
 * that require visual QA, with special attention to component/color-sensitive
 * variants such as antique sprayers with tassels.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";

const ROOT = resolve(import.meta.dirname, "..", "..");
const API_VERSION = "2025-01";
const DEFAULT_OUT_DIR = resolve(ROOT, "data/audits/sku-variant-image-correctness-2026-06-14");

function loadEnvFile(filePath) {
  try {
    for (const rawLine of readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const eqIdx = line.indexOf("=");
      const key = line.slice(0, eqIdx).trim();
      let value = line.slice(eqIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {}
}

function argValue(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : fallback;
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(path, rows) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const text = [headers.join(","), ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(","))].join("\n") + "\n";
  writeFileSync(path, text);
}

function normUrl(value) {
  if (!value) return "";
  try {
    const u = new URL(value);
    return `${u.hostname}${u.pathname}`.toLowerCase();
  } catch {
    return String(value).split("?")[0].toLowerCase();
  }
}

function host(value) {
  try { return new URL(value).hostname; } catch { return ""; }
}

const COLOR_WORDS = [
  "black", "white", "red", "gold", "silver", "clear", "blue", "cobalt", "amber", "green", "natural", "matte", "shiny", "copper", "rose", "cream", "frosted",
];

function colorTokens(...values) {
  const source = values.filter(Boolean).join(" ").toLowerCase();
  const out = new Set();
  for (const word of COLOR_WORDS) {
    if (new RegExp(`\\b${word}\\b`, "i").test(source)) out.add(word);
  }
  return [...out];
}

function skuTokens(sku) {
  const parts = String(sku || "").toUpperCase().split(/[-_\s]+/).filter(Boolean);
  const tokens = new Set(parts);
  const tokenMap = {
    BLK: "black", SBLK: "black", MBLK: "black",
    WHT: "white", RED: "red", GLD: "gold", SGLD: "gold", MGLD: "gold",
    SLV: "silver", SSLV: "silver", MSLV: "silver",
    CLR: "clear", BLU: "blue", CBLU: "cobalt", AMB: "amber", GRN: "green", CPR: "copper", MCPR: "copper",
    AST: "antique-sprayer", TSL: "tassel", ROL: "roll-on", MRL: "metal-roll-on", ATM: "atomizer", SPR: "sprayer", LPM: "lotion-pump", TDP: "treatment-pump", RDC: "reducer-cap", LBLT: "label-tab", SBLK: "shiny-black",
  };
  const expanded = new Set();
  for (const t of tokens) if (tokenMap[t]) expanded.add(tokenMap[t]);
  return { raw: [...tokens], expanded: [...expanded] };
}

function riskProfile(product, variant, urlCounts) {
  const risks = [];
  const expected = [product.graceSku, product.websiteSku, product.itemName, product.applicator, product.capStyle, product.capColor, product.trimColor, product.color].filter(Boolean).join(" | ");
  const imageUrl = variant?.imageUrl || "";
  const convexImageUrl = product.imageUrl || "";
  const imagePath = normUrl(imageUrl);
  const convexPath = normUrl(convexImageUrl);
  const skuInfo = skuTokens(product.graceSku);

  if (!variant) risks.push("NO_SHOPIFY_VARIANT_FOR_SKU");
  else {
    if (!variant.imageUrl) risks.push("SHOPIFY_VARIANT_HAS_NO_IMAGE");
    if (product.shopifyVariantId && variant.id && product.shopifyVariantId !== variant.id) risks.push("CONVEX_VARIANT_ID_DIFFERS_FROM_SHOPIFY_SKU_MATCH");
  }
  if (!product.imageUrl) risks.push("CONVEX_PRODUCT_HAS_NO_IMAGE");
  if (variant?.imageUrl && product.imageUrl && imagePath !== convexPath) risks.push("SHOPIFY_VARIANT_IMAGE_DIFFERS_FROM_CONVEX_IMAGE");

  if (imageUrl && urlCounts.get(normUrl(imageUrl)) > 1) risks.push("IMAGE_URL_SHARED_BY_MULTIPLE_SKUS");
  if (imageUrl && /master_corrected_|177\d+|[0-9a-f]{8}-[0-9a-f]{4}/i.test(imageUrl) && !imagePath.includes(String(product.graceSku || "").toLowerCase())) risks.push("OPAQUE_IMAGE_FILENAME_REQUIRES_VISUAL_QA");
  if (imageUrl && /bestbottles\.com\/images\/store/i.test(imageUrl)) risks.push("LEGACY_GIF_OR_LEGACY_SOURCE_IMAGE");

  const sensitive = /tassel|antique|bulb|sprayer|cap|roll|atomizer|pump|collar|overcap|reducer/i.test(expected) || skuInfo.expanded.some((t) => ["antique-sprayer", "tassel", "roll-on", "metal-roll-on", "atomizer", "sprayer", "lotion-pump", "treatment-pump", "reducer-cap"].includes(t));
  if (sensitive) risks.push("COMPONENT_OR_COLOR_SENSITIVE_VARIANT");

  if (/\b(tassel|antique|vintage\s+style\s+bulb|bulb\s+sprayer)\b/i.test(expected) || skuInfo.expanded.includes("antique-sprayer") || skuInfo.expanded.includes("tassel")) risks.push("TASSEL_ANTIQUE_SPRAYER_VISUAL_CHECK_REQUIRED");
  if (product.capColor && product.color && String(product.capColor).toLowerCase() !== String(product.color).toLowerCase()) risks.push("CAP_COLOR_DIFFERS_FROM_BOTTLE_COLOR_CHECK_IMAGE");

  const expectedColors = colorTokens(product.graceSku, product.websiteSku, product.itemName, product.color, product.capColor, product.trimColor);
  const urlColors = colorTokens(imageUrl);
  const urlMentionsOtherColor = urlColors.some((c) => !expectedColors.includes(c) && !["clear"].includes(c));
  if (urlMentionsOtherColor) risks.push(`IMAGE_URL_COLOR_TOKEN_NOT_EXPECTED:${urlColors.filter((c) => !expectedColors.includes(c)).join("|")}`);

  let priority = "P3";
  if (risks.some((r) => ["NO_SHOPIFY_VARIANT_FOR_SKU", "SHOPIFY_VARIANT_HAS_NO_IMAGE", "CONVEX_PRODUCT_HAS_NO_IMAGE", "SHOPIFY_VARIANT_IMAGE_DIFFERS_FROM_CONVEX_IMAGE"].includes(r))) priority = "P0";
  else if (risks.includes("TASSEL_ANTIQUE_SPRAYER_VISUAL_CHECK_REQUIRED") || risks.includes("IMAGE_URL_SHARED_BY_MULTIPLE_SKUS") || risks.includes("OPAQUE_IMAGE_FILENAME_REQUIRES_VISUAL_QA")) priority = "P1";
  else if (risks.includes("COMPONENT_OR_COLOR_SENSITIVE_VARIANT") || risks.includes("CAP_COLOR_DIFFERS_FROM_BOTTLE_COLOR_CHECK_IMAGE")) priority = "P2";

  return { risks, priority, expectedColors, urlColors, skuExpandedTokens: skuInfo.expanded };
}

async function shopifyGraphQL(domain, token, query, variables, attempt = 0) {
  const response = await fetch(`https://${domain}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
  });
  const text = await response.text();
  if (response.status === 429 && attempt < 5) {
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    return shopifyGraphQL(domain, token, query, variables, attempt + 1);
  }
  if (!response.ok) throw new Error(`Shopify HTTP ${response.status}: ${text.slice(0, 500)}`);
  const json = JSON.parse(text);
  if (json.errors?.length) throw new Error(`Shopify GraphQL: ${json.errors.map((e) => e.message).join("; ")}`);
  return json.data;
}

async function fetchShopifyVariants(domain, token) {
  const variants = [];
  let cursor = null;
  const query = `query ProductVariants($first: Int!, $after: String) {
    productVariants(first: $first, after: $after) {
      edges { cursor node { id sku title image { id url altText } product { id title handle } } }
      pageInfo { hasNextPage endCursor }
    }
  }`;
  while (true) {
    const data = await shopifyGraphQL(domain, token, query, { first: 250, after: cursor });
    for (const edge of data.productVariants.edges) variants.push(edge.node);
    if (!data.productVariants.pageInfo.hasNextPage) return variants;
    cursor = data.productVariants.pageInfo.endCursor;
  }
}

async function fetchConvexProducts(convexUrl) {
  const convex = new ConvexHttpClient(convexUrl);
  const products = [];
  let cursor = null;
  while (true) {
    const result = await convex.action(api.products.getProductExportPage, { cursor, numItems: 250 });
    products.push(...result.page);
    if (result.isDone) return products;
    cursor = result.continueCursor;
  }
}

async function main() {
  loadEnvFile(resolve(ROOT, ".env.local"));
  const outDir = resolve(argValue("--out-dir", DEFAULT_OUT_DIR));
  const convexUrl = argValue("--convex-url", process.env.NEXT_PUBLIC_CONVEX_URL);
  const shopifyDomain = (argValue("--shopify-domain", process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN) || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const shopifyToken = argValue("--shopify-token", process.env.SHOPIFY_ADMIN_TOKEN);
  const limit = Number(argValue("--limit", "0"));
  if (!convexUrl) throw new Error("Missing NEXT_PUBLIC_CONVEX_URL");
  if (!shopifyDomain) throw new Error("Missing NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN");
  if (!shopifyToken) throw new Error("Missing SHOPIFY_ADMIN_TOKEN");
  mkdirSync(outDir, { recursive: true });

  const [productsAll, variantsAll] = await Promise.all([
    fetchConvexProducts(convexUrl),
    fetchShopifyVariants(shopifyDomain, shopifyToken),
  ]);
  const products = limit > 0 ? productsAll.slice(0, limit) : productsAll;
  const variantsBySku = new Map();
  for (const v of variantsAll) if (v.sku) variantsBySku.set(v.sku, v);
  const urlCounts = new Map();
  for (const v of variantsAll) if (v.image?.url) urlCounts.set(normUrl(v.image.url), (urlCounts.get(normUrl(v.image.url)) || 0) + 1);

  const rows = products.map((p) => {
    const v = variantsBySku.get(p.graceSku);
    const variant = v ? { id: v.id, imageUrl: v.image?.url || "", productTitle: v.product?.title || "", productHandle: v.product?.handle || "" } : null;
    const profile = riskProfile(p, variant, urlCounts);
    return {
      priority: profile.priority,
      riskCount: profile.risks.length,
      risks: profile.risks.join(";"),
      graceSku: p.graceSku || "",
      websiteSku: p.websiteSku || "",
      family: p.family || "",
      category: p.category || "",
      productGroupId: p.productGroupId || "",
      productId: p.productId || "",
      itemName: p.itemName || "",
      bottleColor: p.color || "",
      capColor: p.capColor || "",
      trimColor: p.trimColor || "",
      capStyle: p.capStyle || "",
      applicator: p.applicator || "",
      capacity: p.capacity || "",
      convexShopifyVariantId: p.shopifyVariantId || "",
      matchedShopifyVariantId: v?.id || "",
      shopifyProductTitle: v?.product?.title || "",
      shopifyProductHandle: v?.product?.handle || "",
      convexImageUrl: p.imageUrl || "",
      shopifyVariantImageUrl: v?.image?.url || "",
      expectedColors: profile.expectedColors.join("|"),
      urlColors: profile.urlColors.join("|"),
      skuExpandedTokens: profile.skuExpandedTokens.join("|"),
      visualQaInstruction: profile.risks.includes("TASSEL_ANTIQUE_SPRAYER_VISUAL_CHECK_REQUIRED")
        ? "Verify tassel/bulb/collar color exactly matches SKU/itemName, e.g. RED must show red tassel/bulb not black."
        : profile.risks.includes("COMPONENT_OR_COLOR_SENSITIVE_VARIANT")
          ? "Verify applicator/cap/trim/finish visually matches SKU and itemName."
          : "Verify product identity if row is selected for launch-critical QA.",
    };
  }).sort((a, b) => {
    const rank = { P0: 0, P1: 1, P2: 2, P3: 3 };
    return rank[a.priority] - rank[b.priority] || b.riskCount - a.riskCount || a.graceSku.localeCompare(b.graceSku);
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    productsAudited: products.length,
    shopifyVariantsFetched: variantsAll.length,
    countsByPriority: rows.reduce((acc, r) => { acc[r.priority] = (acc[r.priority] || 0) + 1; return acc; }, {}),
    riskCounts: rows.reduce((acc, r) => { for (const risk of r.risks.split(";").filter(Boolean)) acc[risk] = (acc[risk] || 0) + 1; return acc; }, {}),
    highRiskVisualQaRows: rows.filter((r) => r.priority === "P1" || r.priority === "P0").length,
    tasselAntiqueSprayerRows: rows.filter((r) => r.risks.includes("TASSEL_ANTIQUE_SPRAYER_VISUAL_CHECK_REQUIRED")).length,
    note: "This is a join/risk audit. Rows marked P1/P2 still require pixel/visual QA before claiming correctness.",
  };

  writeCsv(resolve(outDir, "sku_variant_image_correctness_audit.csv"), rows);
  writeCsv(resolve(outDir, "p0_blockers.csv"), rows.filter((r) => r.priority === "P0"));
  writeCsv(resolve(outDir, "p1_visual_qa_queue.csv"), rows.filter((r) => r.priority === "P1"));
  writeCsv(resolve(outDir, "tassel_antique_sprayer_visual_qa_queue.csv"), rows.filter((r) => r.risks.includes("TASSEL_ANTIQUE_SPRAYER_VISUAL_CHECK_REQUIRED")));
  writeFileSync(resolve(outDir, "summary.json"), JSON.stringify(summary, null, 2));
  writeFileSync(resolve(outDir, "README.md"), `# SKU → Variant → Image Correctness Audit\n\nGenerated: ${summary.generatedAt}\n\nThis is a read-only join/risk audit across Convex products and Shopify variants. It does not claim pixel-level correctness. Use the visual QA queues for launch-critical human/vision review.\n\n## Counts\n\n- Products audited: ${summary.productsAudited}\n- Shopify variants fetched: ${summary.shopifyVariantsFetched}\n- P0 blockers: ${summary.countsByPriority.P0 || 0}\n- P1 visual QA rows: ${summary.countsByPriority.P1 || 0}\n- P2 sensitive rows: ${summary.countsByPriority.P2 || 0}\n- P3 low-risk rows: ${summary.countsByPriority.P3 || 0}\n- Tassel / antique sprayer rows: ${summary.tasselAntiqueSprayerRows}\n\n## Files\n\n- \`sku_variant_image_correctness_audit.csv\` — full joined audit.\n- \`p0_blockers.csv\` — rows with missing/different image linkage.\n- \`p1_visual_qa_queue.csv\` — highest-priority rows needing visual confirmation.\n- \`tassel_antique_sprayer_visual_qa_queue.csv\` — exact queue for red/black/white tassel/bulb/collar checks.\n- \`summary.json\` — machine-readable summary.\n`);

  console.log(JSON.stringify({ outDir, summary }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
