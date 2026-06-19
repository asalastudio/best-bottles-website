#!/usr/bin/env node
/**
 * Read-only Convex Grace SKU product-truth audit.
 *
 * Pulls the current Convex catalog, compares each row's Grace SKU and Convex
 * metadata against legacy BestBottles website evidence, and writes CSV/JSON/MD
 * artifacts for SKU cleanup before Madison/Shopify image pushes.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const OUTPUT_DIR = resolve(
  ROOT,
  "data/audits/convex-grace-sku-truth-2026-06-19",
);

const KNOWN_APP_CODES = new Set([
  "ASP",
  "AST",
  "ATM",
  "CAP",
  "DRP",
  "GWA",
  "LPM",
  "MRL",
  "RBL",
  "RDC",
  "ROL",
  "SPR",
  "STP",
  "SHT",
]);

const EXPECTED_GROUP_SUFFIX = {
  antiquespray: ["antiquespray", "spray"],
  "antiquespray-tassel": ["antiquespray", "tassel", "spray"],
  atomizer: ["atomizer"],
  cap: ["cap"],
  dropper: ["dropper"],
  glassrod: ["glasswand", "glassrod"],
  glassstopper: ["glassapplicator", "glassstopper", "stopper"],
  lotionpump: ["lotionpump", "lotion"],
  reducer: ["reducer"],
  rollon: ["rollon"],
  spray: ["spray", "finemist", "perfumespray"],
};

const IDENTITY_BLOCKER_TYPES = new Set([
  "legacy_color_vs_convex_color",
  "legacy_color_vs_grace_sku_color",
  "legacy_applicator_vs_convex_applicator",
  "legacy_applicator_vs_grace_sku_applicator",
  "legacy_family_vs_convex_family",
  "legacy_family_vs_grace_sku_family",
  "product_group_slug_applicator_drift",
]);

function loadEnvLocal() {
  const envPath = resolve(ROOT, ".env.local");
  try {
    for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const [key, ...rest] = line.split("=");
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // Optional when vars are already present.
  }
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function norm(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function compactSku(value) {
  return clean(value).replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function toCsv(rows, columns) {
  return [
    columns.map(csvCell).join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ].join("\n");
}

function countBy(rows, fn) {
  const counts = new Map();
  for (const row of rows) {
    const key = fn(row) || "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function familyFromSku(value) {
  const sku = compactSku(value);
  if (!sku) return null;
  if (/^(GB)?ATOM/.test(sku)) return "Atomizer";
  if (/^(GB|LB)?DIVA/.test(sku)) return "Diva";
  if (/^(GB|LB)?ELG/.test(sku)) return "Elegant";
  if (/^(GB|LB)?(TALL)?CYL/.test(sku)) return "Cylinder";
  if (/^(GB|LB)?CRCL|^(GB|LB)?CIRCLE/.test(sku)) return "Circle";
  if (/^(GB|LB)?BSTN|^(GB|LB)?BOSTON/.test(sku)) return "Boston Round";
  if (/^(GB|LB)?SLEEK|^(GB|LB)?SLK/.test(sku)) return "Sleek";
  if (/^(GB|LB)?SLIM|^(GB|LB)?SLM/.test(sku)) return "Slim";
  if (/^(GB|LB)?EMPR|^(GB|LB)?EMP/.test(sku)) return "Empire";
  if (/^(GB|LB)?(TALL)?RECT/.test(sku)) return "Rectangle";
  if (/^(GB|LB)?ROUND|^(GB|LB)?RND/.test(sku)) return "Round";
  if (/^(GB|LB)?SQR|^(GB|LB)?SQST/.test(sku)) return "Square";
  if (/^(GB|LB)?DMD|^(GB|LB)?DMND|^(GB|LB)?DIAMOND/.test(sku)) return "Diamond";
  if (/^(GB|LB)?GRACE|^(GB|LB)?GRCE/.test(sku)) return "Grace";
  if (/^(GB|LB)?BELL/.test(sku)) return "Bell";
  if (/^(GB|LB)?TULIP/.test(sku)) return "Tulip";
  if (/^(GB|LB)?ROYAL/.test(sku)) return "Royal";
  if (/^(GB)?VIAL|^(GB)?V/.test(sku)) return "Vial";
  if (/^LB/.test(sku)) return "Lotion Bottle";
  if (sku.startsWith("ALU")) return "Aluminum Bottle";
  return null;
}

function familyFromGracePrefix(value) {
  const tokens = clean(value).toUpperCase().split("-");
  const code = tokens[1] ?? "";
  const map = {
    ALU: "Aluminum Bottle",
    APT: "Apothecary",
    BEL: "Bell",
    BST: "Boston Round",
    BSR: "Boston Round",
    CIR: "Circle",
    CRL: "Circle",
    CYL: "Cylinder",
    DEC: "Decorative",
    DIA: "Diamond",
    DMD: "Diamond",
    DVA: "Diva",
    ELG: "Elegant",
    EMP: "Empire",
    FLR: "Flair",
    GRC: "Grace",
    RCT: "Rectangle",
    RND: "Round",
    ROY: "Royal",
    RYL: "Royal",
    SLK: "Sleek",
    SLM: "Slim",
    SQR: "Square",
    TLP: "Tulip",
    VIA: "Vial",
    VIL: "Vial",
  };
  return map[code] ?? null;
}

function colorFromGraceSku(value) {
  const tokens = clean(value).toUpperCase().split("-");
  const map = {
    AMB: "Amber",
    BLK: "Black",
    BLU: "Cobalt Blue",
    CLR: "Clear",
    FRS: "Frosted",
    GRN: "Green",
    PNK: "Pink",
    WHT: "White",
  };
  return map[tokens[2]] ?? null;
}

function inferColor({ websiteSku, text }) {
  const sku = clean(websiteSku);
  const words = norm(text);

  if (/frst/i.test(sku) || /\bfrosted glass\b|\bfrosted bottle\b|\bfrosted lotion\b/.test(words)) return "Frosted";
  if (/\bamber glass\b|\bamber bottle\b/.test(words)) return "Amber";
  if (/\bcobalt blue glass\b|\bblue glass\b|\bcobalt blue bottle\b/.test(words)) return "Cobalt Blue";
  if (/\bgreen glass\b|\bgreen bottle\b/.test(words)) return "Green";
  if (/\bblack glass\b|\bblack bottle\b/.test(words)) return "Black";
  if (/\bwhite glass\b|\bwhite bottle\b/.test(words)) return "White";
  if (/\bclear glass\b|\bclear bottle\b|\bclear vial\b|\bclear lotion bottle\b/.test(words)) return "Clear";
  if (/^(?:GB)?(?:Bstn|Cyl|Diva|Elg|Slk|Slm|Crcl|Rnd|Rect|Royal|Bell|Tulip|V|Vial)Amb/i.test(sku)) return "Amber";
  if (/^(?:GB)?(?:Bstn|Cyl|Diva|Elg|Slk|Slm|Crcl|Rnd|Rect|Royal|Bell|Tulip|V|Vial)(?:Blu|Blue)/i.test(sku)) return "Cobalt Blue";
  if (/^(?:GB)?(?:Bstn|Cyl|Diva|Elg|Slk|Slm|Crcl|Rnd|Rect|Royal|Bell|Tulip|V|Vial)(?:Grn|Green)/i.test(sku)) return "Green";
  return null;
}

function inferApplicatorBucket({ websiteSku, text }) {
  const sku = clean(websiteSku);
  const words = norm([websiteSku, text].join(" "));

  if (/AnSpTsl/i.test(sku) || /\btassel\b/.test(words)) return "antiquespray-tassel";
  if (/AnSp/i.test(sku) || /\bantique\b|\bvintage\b|\bbulb sprayer\b|\bbulb spray\b/.test(words)) return "antiquespray";
  if (/Rdcr/i.test(sku) || /\breducer\b|\borifice reducer\b/.test(words)) return "reducer";
  if (/Drp|Drpr/i.test(sku) || /\bdropper\b|\bpipette\b/.test(words)) return "dropper";
  if (/Ltn|Lotion/i.test(sku) || /\blotion pump\b|\btreatment pump\b/.test(words)) return "lotionpump";
  if (/Roll|R\/O|Rollon/i.test(sku) || /\broll on\b|\brollon\b|\broll on\b|\broller\b|\brollerball\b|\broller ball\b/.test(words)) return "rollon";
  if (/Atom/i.test(sku) || /\batomizer\b/.test(words)) return "atomizer";
  if (/GlassRod|BlackCapApp/i.test(sku) || /\bglass rod\b|\bglass wand\b/.test(words)) return "glassrod";
  if (/Stpr|Stopper|Apth/i.test(sku) || /\bglass stopper\b|\bground glass\b|\bstopper\b/.test(words)) return "glassstopper";
  if (/Spry|Spray/i.test(sku) || /\bspray pump\b|\bfine mist\b|\bsprayer\b/.test(words)) return "spray";
  if (/Cap|Sht|Tall/i.test(sku) || /\bcap\b|\bshort cap\b|\btall cap\b/.test(words)) return "cap";
  return null;
}

function normalizeFinishWord(value) {
  const word = norm(value);
  const map = {
    black: "Black",
    gold: "Gold",
    ivory: "Ivory",
    lavendar: "Lavender",
    lavender: "Lavender",
    matte: "Matte",
    "matte silver": "Matte Silver",
    pink: "Pink",
    red: "Red",
    shiny: "Shiny",
    silver: "Silver",
    white: "White",
  };
  return map[word] ?? clean(value);
}

function finishCode(value) {
  const normalized = clean(value).toLowerCase();
  const map = {
    black: "BLK",
    gold: "GLD",
    ivory: "IV",
    lavender: "LVN",
    lavendar: "LVN",
    "matte gold": "MGLD",
    "matte silver": "MSLV",
    pink: "PNK",
    red: "RED",
    "shiny gold": "SGLD",
    "shiny silver": "SSLV",
    silver: "SLV",
    white: "WHT",
  };
  return map[normalized] ?? "";
}

function inferAccessoryFinish({ text, appBucket }) {
  const raw = clean(text);
  const lower = raw.toLowerCase();
  const sprayerMatch = raw.match(
    /\b(black|gold|ivory|lavend[ae]r|matte silver|pink|red|silver|white)\s+vintage style bulb sprayer/i,
  );
  const collarMatch = raw.match(/\b(shiny|matte)?\s*(gold|silver)\s+collar cap/i);
  const ringMatch = raw.match(/\b(?:(jeweled)\s+)?(gold|silver)?\s*ring\b/i) || lower.includes("collar-ring");
  const accessoryColor = sprayerMatch ? normalizeFinishWord(sprayerMatch[1]) : "";
  const collarFinish = collarMatch
    ? `${collarMatch[1] ? normalizeFinishWord(collarMatch[1]) : "Shiny"} ${normalizeFinishWord(collarMatch[2])}`
    : "";
  const ringColor = typeof ringMatch === "object" && ringMatch?.[2] ? normalizeFinishWord(ringMatch[2]) : "";
  const hasRing = Boolean(ringMatch);
  const isTassel = appBucket === "antiquespray-tassel";
  const accessoryCode = [
    isTassel ? "AST" : appBucket === "antiquespray" ? "ASP" : "",
    finishCode(accessoryColor),
    collarFinish && ["Ivory"].includes(accessoryColor) ? finishCode(collarFinish).replace(/^S/, "") : "",
    hasRing ? "RNG" : "",
  ].filter(Boolean).join("-");

  return {
    expectedAccessoryColor: accessoryColor,
    expectedTasselColor: isTassel ? accessoryColor : "",
    expectedCollarFinish: collarFinish,
    expectedRing: hasRing ? "yes" : "no",
    expectedRingColor: ringColor,
    suggestedAccessoryCode: accessoryCode,
  };
}

function appBucketFromConvex(product) {
  const value = norm([product.applicator, product.capStyle, product.itemName].join(" "));
  if (/\btassel\b/.test(value)) return "antiquespray-tassel";
  if (/\bvintage\b|\bantique\b|\bbulb sprayer\b/.test(value)) return "antiquespray";
  if (/\breducer\b/.test(value)) return "reducer";
  if (/\bdropper\b/.test(value)) return "dropper";
  if (/\bspray\b|\bsprayer\b|\bperfume spray\b|\bfine mist\b/.test(value)) return "spray";
  if (/\blotion pump\b|\btreatment pump\b/.test(value)) return "lotionpump";
  if (/\broll\b|\broller\b/.test(value)) return "rollon";
  if (/\batomizer\b/.test(value)) return "atomizer";
  if (/\bglass rod\b|\bglass wand\b/.test(value)) return "glassrod";
  if (/\bglass stopper\b|\bground glass\b|\bstopper\b/.test(value)) return "glassstopper";
  if (/\bcap\b|\btall\b|\bshort\b/.test(value)) return "cap";
  return null;
}

function appCodeFromGraceSku(value) {
  const tokens = clean(value).toUpperCase().split("-");
  const capacityIndex = tokens.findIndex((token) => /^\d+(?:\.\d+)?(?:ML|OZ|DRM)$/.test(token));
  const suffix = capacityIndex >= 0 ? tokens.slice(capacityIndex + 1) : tokens.slice(3);
  const code = suffix.find((token) => KNOWN_APP_CODES.has(token)) ?? null;
  const genericOnly = suffix.length === 0 || suffix.every((token) => token === "T" || /^\d+$/.test(token));
  return { code, suffix: suffix.join("-"), genericOnly };
}

function appBucketFromCode(code) {
  const map = {
    ASP: "antiquespray",
    AST: "antiquespray-tassel",
    ATM: "atomizer",
    CAP: "cap",
    DRP: "dropper",
    GWA: "glassrod",
    LPM: "lotionpump",
    MRL: "rollon",
    RBL: "rollon",
    RDC: "reducer",
    ROL: "rollon",
    SPR: "spray",
    STP: "glassstopper",
    SHT: "cap",
  };
  return code ? map[code] ?? null : null;
}

function bucketLabel(bucket) {
  const labels = {
    antiquespray: "Vintage Bulb Sprayer",
    "antiquespray-tassel": "Vintage Bulb Sprayer with Tassel",
    atomizer: "Atomizer",
    cap: "Cap/Closure",
    dropper: "Dropper",
    glassrod: "Glass Rod",
    glassstopper: "Glass Stopper",
    lotionpump: "Lotion Pump",
    reducer: "Reducer",
    rollon: "Roll-On",
    spray: "Spray Pump/Sprayer",
  };
  return bucket ? labels[bucket] ?? bucket : "";
}

function isBottleLike(product) {
  const category = norm(product.category);
  if (category.includes("component") || category.includes("cap closure") || category.includes("accessory")) return false;
  return Boolean(clean(product.graceSku).match(/^(GB|LB|AB)-/));
}

function issue(severity, type, message) {
  return { severity, type, message };
}

function groupMatchesExpectedApp(groupSlug, expectedBucket) {
  if (!groupSlug || !expectedBucket) return true;
  const slug = norm(groupSlug).replace(/\s+/g, "-");
  const tokens = EXPECTED_GROUP_SUFFIX[expectedBucket] ?? [];
  if (tokens.length === 0) return true;
  return tokens.some((token) => slug.includes(token));
}

function recommendations(issues, expected) {
  const types = new Set(issues.map((entry) => entry.type));
  if (types.has("duplicate_website_sku")) return "Resolve duplicate Convex rows for the same websiteSku before image push.";
  if (types.has("legacy_color_vs_grace_sku_color") || types.has("legacy_color_vs_convex_color")) {
    return `Correct color identity to ${expected.color ?? "legacy evidence"} or remap to the matching websiteSku.`;
  }
  if (types.has("legacy_applicator_vs_grace_sku_applicator") || types.has("legacy_applicator_vs_convex_applicator")) {
    return `Move to the correct ${bucketLabel(expected.appBucket) || "applicator"} Grace SKU/group before generation or Shopify push.`;
  }
  if (types.has("generic_grace_sku_missing_applicator")) {
    return `Rename/crosswalk Grace SKU to include ${bucketLabel(expected.appBucket) || "the exact applicator"} intent.`;
  }
  if (types.has("product_group_slug_applicator_drift")) {
    return "Move Convex row/Madison job to the product group whose slug matches the actual applicator.";
  }
  return issues.length > 0 ? "Review row against legacy website evidence before image push." : "No SKU-truth blocker detected.";
}

function analyzeProduct(product, context) {
  const legacy = context.legacyByWebsiteSku.get(compactSku(product.websiteSku));
  const group = context.groupById.get(clean(product.productGroupId));
  const text = [
    legacy?.itemName,
    legacy?.itemDescription,
    legacy?.productUrl,
    product.itemName,
    product.itemDescription,
    product.productUrl,
  ].filter(Boolean).join(" ");

  const expected = {
    family: familyFromSku(product.websiteSku) ?? familyFromSku(legacy?.websiteSku) ?? null,
    color: inferColor({ websiteSku: product.websiteSku, text }),
    appBucket: inferApplicatorBucket({ websiteSku: product.websiteSku, text }),
  };
  const accessoryFinish = inferAccessoryFinish({ text, appBucket: expected.appBucket });
  const grace = {
    family: familyFromGracePrefix(product.graceSku),
    color: colorFromGraceSku(product.graceSku),
    ...appCodeFromGraceSku(product.graceSku),
  };
  grace.appBucket = appBucketFromCode(grace.code);
  const convexAppBucket = appBucketFromConvex(product);
  const duplicateWebsiteSkuCount = context.websiteSkuCounts.get(compactSku(product.websiteSku)) ?? 0;

  const issues = [];
  const bottleLike = isBottleLike(product);

  if (duplicateWebsiteSkuCount > 1) {
    issues.push(issue("critical", "duplicate_website_sku", "Multiple Convex rows share this websiteSku."));
  }
  if (bottleLike && expected.family && product.family && norm(expected.family) !== norm(product.family)) {
    issues.push(issue("high", "legacy_family_vs_convex_family", "Legacy/website SKU family differs from Convex family."));
  }
  if (bottleLike && expected.family && grace.family && norm(expected.family) !== norm(grace.family)) {
    issues.push(issue("high", "legacy_family_vs_grace_sku_family", "Legacy/website SKU family differs from Grace SKU prefix."));
  }
  if (bottleLike && expected.color && product.color && norm(expected.color) !== norm(product.color)) {
    issues.push(issue("high", "legacy_color_vs_convex_color", "Legacy evidence color differs from Convex color."));
  }
  if (bottleLike && expected.color && grace.color && norm(expected.color) !== norm(grace.color)) {
    issues.push(issue("high", "legacy_color_vs_grace_sku_color", "Legacy evidence color differs from Grace SKU color token."));
  }
  if (bottleLike && expected.appBucket && convexAppBucket && expected.appBucket !== convexAppBucket) {
    issues.push(issue("high", "legacy_applicator_vs_convex_applicator", "Legacy evidence applicator differs from Convex applicator/cap metadata."));
  }
  if (bottleLike && expected.appBucket && grace.appBucket && expected.appBucket !== grace.appBucket) {
    issues.push(issue("high", "legacy_applicator_vs_grace_sku_applicator", "Legacy evidence applicator differs from Grace SKU applicator token."));
  }
  if (bottleLike && expected.appBucket && !grace.appBucket && grace.genericOnly) {
    issues.push(issue("high", "generic_grace_sku_missing_applicator", "Grace SKU suffix is generic and omits the actual applicator/closure identity."));
  }
  if (bottleLike && expected.appBucket && !groupMatchesExpectedApp(group?.slug, expected.appBucket)) {
    issues.push(issue("high", "product_group_slug_applicator_drift", "Product group slug does not reflect the applicator inferred from legacy evidence."));
  }
  if (bottleLike && expected.appBucket && !convexAppBucket) {
    issues.push(issue("medium", "missing_convex_applicator", "Convex row does not expose a clear applicator/cap identity."));
  }
  if (bottleLike && expected.color && !product.color) {
    issues.push(issue("medium", "missing_convex_color", "Convex row does not expose a clear bottle color."));
  }
  if (bottleLike && expected.appBucket && !grace.appBucket && !grace.genericOnly) {
    issues.push(issue("medium", "unrecognized_grace_sku_applicator", "Grace SKU suffix does not map to a known applicator token."));
  }
  if (bottleLike && !legacy) {
    issues.push(issue("medium", "missing_legacy_website_sku_evidence", "No cached legacy row matched this websiteSku."));
  }

  const severityRank = { critical: 4, high: 3, medium: 2, low: 1 };
  const highestSeverity = issues.reduce((best, entry) => {
    return (severityRank[entry.severity] ?? 0) > (severityRank[best] ?? 0) ? entry.severity : best;
  }, "none");

  return {
    severity: highestSeverity,
    issueTypes: issues.map((entry) => entry.type).join(";"),
    issueMessages: issues.map((entry) => entry.message).join(" "),
    action: recommendations(issues, expected),
    graceSku: clean(product.graceSku),
    websiteSku: clean(product.websiteSku),
    productId: clean(product.productId),
    productGroupSlug: clean(group?.slug),
    productGroupDisplayName: clean(group?.displayName),
    category: clean(product.category),
    convexFamily: clean(product.family),
    expectedFamily: clean(expected.family),
    graceSkuFamily: clean(grace.family),
    convexColor: clean(product.color),
    expectedColor: clean(expected.color),
    graceSkuColor: clean(grace.color),
    convexApplicator: clean(product.applicator),
    convexCapStyle: clean(product.capStyle),
    expectedApplicator: bucketLabel(expected.appBucket),
    expectedAccessoryColor: accessoryFinish.expectedAccessoryColor,
    expectedTasselColor: accessoryFinish.expectedTasselColor,
    expectedCollarFinish: accessoryFinish.expectedCollarFinish,
    expectedRing: accessoryFinish.expectedRing,
    expectedRingColor: accessoryFinish.expectedRingColor,
    suggestedAccessoryCode: accessoryFinish.suggestedAccessoryCode,
    graceSkuApplicatorCode: clean(grace.code),
    graceSkuApplicator: bucketLabel(grace.appBucket),
    graceSkuSuffix: clean(grace.suffix),
    itemName: clean(product.itemName),
    legacyDescription: clean(legacy?.itemDescription),
    legacyUrl: clean(legacy?.productUrl ?? product.productUrl),
    imageUrl: clean(product.imageUrl),
    isBottleLike: bottleLike ? "yes" : "no",
  };
}

async function fetchConvexProducts(client) {
  const products = [];
  let cursor = null;
  let pageCount = 0;
  while (true) {
    const page = await client.action(api.products.getProductExportPage, {
      cursor,
      numItems: 250,
    });
    products.push(...page.page);
    pageCount += 1;
    console.log(`Fetched Convex product page ${pageCount}: +${page.page.length} (${products.length})`);
    if (page.isDone) break;
    cursor = page.continueCursor;
  }
  return products;
}

async function fetchProductGroups(client) {
  const groups = await client.query(api.products.getCatalogGroups, { limit: 1000 });
  return groups ?? [];
}

function writeMarkdown({ summary, issueRows, topIssueTypes, topFamilies, outDir }) {
  const lines = [
    "# Convex Grace SKU Truth Audit",
    "",
    `Generated: ${summary.generatedAt}`,
    "Mode: read-only",
    "",
    "## Summary",
    "",
    `- Convex products audited: ${summary.convexProductsAudited}`,
    `- Bottle-like products audited: ${summary.bottleLikeProductsAudited}`,
    `- Product groups loaded: ${summary.productGroupsLoaded}`,
    `- Rows with critical/high blockers: ${summary.criticalHighRows}`,
    `- Rows with any issue: ${summary.rowsWithIssues}`,
    `- Identity blocker rows: ${summary.identityBlockerRows}`,
    `- Generic Grace SKU rows missing applicator identity: ${summary.genericGraceSkuRows}`,
    `- Generic Grace SKU identity blockers: ${summary.genericGraceSkuBlockerRows}`,
    `- Generic Grace SKU naming-only rows: ${summary.genericGraceSkuNamingOnlyRows}`,
    `- Duplicate websiteSku rows: ${summary.duplicateWebsiteSkuRows}`,
    "",
    "## Top Issue Types",
    "",
    ...topIssueTypes.slice(0, 15).map(([type, count]) => `- ${type}: ${count}`),
    "",
    "## Top Families With Issues",
    "",
    ...topFamilies.slice(0, 15).map(([family, count]) => `- ${family}: ${count}`),
    "",
    "## Critical/High Samples",
    "",
  ];

  for (const row of issueRows.slice(0, 80)) {
    lines.push(
      `- **${row.severity.toUpperCase()}** \`${row.graceSku}\` / \`${row.websiteSku}\` — ${row.issueTypes} — expected ${row.expectedColor || "unknown color"} ${row.expectedApplicator || "unknown applicator"}; Convex has ${row.convexColor || "unknown color"} ${row.convexApplicator || row.convexCapStyle || "unknown applicator"}.`,
    );
  }
  if (issueRows.length > 80) {
    lines.push(`- ...${issueRows.length - 80} more critical/high rows in CSV.`);
  }

  lines.push(
    "",
    "## Files",
    "",
    `- Full row audit: ${resolve(outDir, "convex_grace_sku_truth_rows.csv")}`,
    `- Critical/high blockers: ${resolve(outDir, "critical_high_blockers.csv")}`,
    `- Identity blockers: ${resolve(outDir, "identity_blockers.csv")}`,
    `- Generic SKU blockers: ${resolve(outDir, "generic_sku_identity_blockers.csv")}`,
    `- Generic SKU naming-only rows: ${resolve(outDir, "generic_sku_naming_only.csv")}`,
    `- Diva 46 crosswalk: ${resolve(outDir, "diva_46_crosswalk.csv")}`,
    `- JSON detail: ${resolve(outDir, "convex_grace_sku_truth.json")}`,
    "",
  );
  return `${lines.join("\n")}\n`;
}

async function main() {
  loadEnvLocal();
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  if (!convexUrl) throw new Error("Missing NEXT_PUBLIC_CONVEX_URL or CONVEX_URL.");

  const client = new ConvexHttpClient(convexUrl);
  const [products, groups] = await Promise.all([
    fetchConvexProducts(client),
    fetchProductGroups(client),
  ]);

  const legacyRows = JSON.parse(readFileSync(resolve(ROOT, "data/bestbottles_raw_website_data.json"), "utf8"));
  const legacyByWebsiteSku = new Map(
    legacyRows.map((row) => [compactSku(row.websiteSku), row]).filter(([key]) => key),
  );
  const groupById = new Map(groups.map((group) => [clean(group._id), group]));
  const websiteSkuCounts = new Map();
  for (const product of products) {
    const key = compactSku(product.websiteSku);
    if (key) websiteSkuCounts.set(key, (websiteSkuCounts.get(key) ?? 0) + 1);
  }

  const rows = products.map((product) =>
    analyzeProduct(product, {
      groupById,
      legacyByWebsiteSku,
      websiteSkuCounts,
    }),
  );
  const issueRows = rows.filter((row) => row.severity !== "none");
  const criticalHighRows = issueRows.filter((row) => row.severity === "critical" || row.severity === "high");
  const duplicateWebsiteSkuRows = rows.filter((row) => row.issueTypes.includes("duplicate_website_sku"));
  const genericGraceSkuRows = rows.filter((row) => row.issueTypes.includes("generic_grace_sku_missing_applicator"));
  const identityBlockerRows = rows.filter((row) =>
    row.isBottleLike === "yes" && row.issueTypes.split(";").some((type) => IDENTITY_BLOCKER_TYPES.has(type)),
  );
  const genericGraceSkuBlockerRows = genericGraceSkuRows.filter((row) =>
    row.issueTypes.split(";").some((type) => IDENTITY_BLOCKER_TYPES.has(type) || type === "duplicate_website_sku"),
  );
  const genericGraceSkuNamingOnlyRows = genericGraceSkuRows.filter(
    (row) => !genericGraceSkuBlockerRows.includes(row),
  );
  const diva46Rows = rows.filter((row) =>
    row.graceSku.startsWith("GB-DVA-") && row.graceSku.includes("46ML"),
  );
  const topIssueTypes = countBy(
    issueRows.flatMap((row) => row.issueTypes.split(";").filter(Boolean).map((type) => ({ type }))),
    (row) => row.type,
  );
  const topFamilies = countBy(issueRows, (row) => row.convexFamily || row.expectedFamily || "unknown");

  const summary = {
    generatedAt: new Date().toISOString(),
    mode: "read-only",
    convexUrl,
    convexProductsAudited: products.length,
    bottleLikeProductsAudited: rows.filter((row) => row.isBottleLike === "yes").length,
    productGroupsLoaded: groups.length,
    rowsWithIssues: issueRows.length,
    criticalHighRows: criticalHighRows.length,
    identityBlockerRows: identityBlockerRows.length,
    genericGraceSkuRows: genericGraceSkuRows.length,
    genericGraceSkuBlockerRows: genericGraceSkuBlockerRows.length,
    genericGraceSkuNamingOnlyRows: genericGraceSkuNamingOnlyRows.length,
    duplicateWebsiteSkuRows: duplicateWebsiteSkuRows.length,
    topIssueTypes,
    topFamilies,
  };

  const columns = [
    "severity",
    "issueTypes",
    "action",
    "graceSku",
    "websiteSku",
    "productId",
    "productGroupSlug",
    "productGroupDisplayName",
    "category",
    "convexFamily",
    "expectedFamily",
    "graceSkuFamily",
    "convexColor",
    "expectedColor",
    "graceSkuColor",
    "convexApplicator",
    "convexCapStyle",
    "expectedApplicator",
    "expectedAccessoryColor",
    "expectedTasselColor",
    "expectedCollarFinish",
    "expectedRing",
    "expectedRingColor",
    "suggestedAccessoryCode",
    "graceSkuApplicatorCode",
    "graceSkuApplicator",
    "graceSkuSuffix",
    "itemName",
    "legacyDescription",
    "legacyUrl",
    "imageUrl",
    "isBottleLike",
    "issueMessages",
  ];

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(resolve(OUTPUT_DIR, "convex_grace_sku_truth_rows.csv"), `${toCsv(rows, columns)}\n`);
  writeFileSync(resolve(OUTPUT_DIR, "critical_high_blockers.csv"), `${toCsv(criticalHighRows, columns)}\n`);
  writeFileSync(resolve(OUTPUT_DIR, "identity_blockers.csv"), `${toCsv(identityBlockerRows, columns)}\n`);
  writeFileSync(resolve(OUTPUT_DIR, "generic_grace_sku_rows.csv"), `${toCsv(genericGraceSkuRows, columns)}\n`);
  writeFileSync(resolve(OUTPUT_DIR, "generic_sku_identity_blockers.csv"), `${toCsv(genericGraceSkuBlockerRows, columns)}\n`);
  writeFileSync(resolve(OUTPUT_DIR, "generic_sku_naming_only.csv"), `${toCsv(genericGraceSkuNamingOnlyRows, columns)}\n`);
  writeFileSync(resolve(OUTPUT_DIR, "duplicate_website_sku_rows.csv"), `${toCsv(duplicateWebsiteSkuRows, columns)}\n`);
  writeFileSync(resolve(OUTPUT_DIR, "diva_46_crosswalk.csv"), `${toCsv(diva46Rows, columns)}\n`);
  writeFileSync(
    resolve(OUTPUT_DIR, "convex_grace_sku_truth.json"),
    JSON.stringify({ summary, rows }, null, 2),
  );
  writeFileSync(
    resolve(OUTPUT_DIR, "convex_grace_sku_truth_summary.md"),
    writeMarkdown({ summary, issueRows: criticalHighRows, topIssueTypes, topFamilies, outDir: OUTPUT_DIR }),
  );

  console.log(JSON.stringify(summary, null, 2));
  console.log(`Saved audit: ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
