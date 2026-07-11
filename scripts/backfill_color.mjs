/**
 * Color backfill script — best-bottles-catalog pipeline.
 *
 * Mines `color` from `item_name` + `item_description` text for every
 * CSV row in `data/grace_products_final.csv` and writes the inferred
 * color back into the `color` column. Also adds traceability columns:
 *
 *   color            - the canonical color (e.g. "cobalt_blue",
 *                       "amber", "clear"), used downstream by the
 *                       Convex rebuild and the SKU-lock composer
 *   canonical_slug   - family-capacityMl-color-applicator slug, the
 *                       join key used to merge CSV ↔ Convex ↔ Sanity
 *   colorSource       - "text-mined" if we inferred it, "catalog" if
 *                       the CSV row already had a value
 *   csvLastUpdatedAt  - timestamp of the backfill run (ISO 8601)
 *   convexSyncedAt    - placeholder (""), populated when the rebuild
 *                       mutation runs
 *
 * Usage:
 *   node scripts/backfill_color.mjs              # dry-run, prints diff to stdout
 *   node scripts/backfill_color.mjs --apply      # writes a NEW CSV with the backfilled values
 *   node scripts/backfill_color.mjs --apply --out data/grace_products_final.v2.csv
 *
 * Default mode is dry-run. Apply mode writes a NEW CSV — it never
 * overwrites the source. You diff, review, then rename v2 over the
 * original only when you're satisfied.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_CSV = path.join(REPO_ROOT, "data", "grace_products_final.csv");
const DEFAULT_OUT = path.join(REPO_ROOT, "data", "grace_products_final.v2.csv");

// ── Color inference rules ────────────────────────────────────────
// Order matters: more specific first. Returns the canonical color
// token used by the SKU-lock composer + the Convex productGroups table.
//
// Each rule has a `token` (substring to look for) and a `position` that
// constrains where in the text to look:
//   "anywhere"     - default, look anywhere in the text
//   "start"        - only at the beginning of the text (after stripping
//                    leading words like "the", "a", "design", etc.)
//   "early"        - anywhere in the first 60 chars of the text (catches
//                    "Cylinder design 5ml Blue glass bottle" where
//                    "blue" is the body color, not a later closure)
// This prevents "blue spray" in the closure section from matching,
// while still catching "Blue glass bottle" when "blue" appears
// anywhere in the opening phrase.
const COLOR_HINTS = [
  { token: "cobalt blue",     value: "cobalt_blue", position: "anywhere" },
  { token: "cobalt",          value: "cobalt_blue", position: "anywhere" },
  { token: "emerald",         value: "green",       position: "anywhere" },
  { token: "green glass",     value: "green",       position: "anywhere" },
  { token: "green",           value: "green",       position: "early" },
  { token: "amber",           value: "amber",       position: "early" },
  { token: "frosted",         value: "frosted",     position: "anywhere" },
  { token: "swirl",           value: "swirl",       position: "anywhere" },
  { token: "white glass",     value: "white",       position: "anywhere" },
  { token: "white opaque",    value: "white",       position: "anywhere" },
  { token: "matte white",     value: "white",       position: "anywhere" },
  { token: "white",           value: "white",       position: "early" },
  { token: "matte black",     value: "black",       position: "anywhere" },
  { token: "glossy black",    value: "black",       position: "anywhere" },
  { token: "opaque black",    value: "black",       position: "anywhere" },
  { token: "black glass",     value: "black",       position: "anywhere" },
  { token: "black",           value: "black",       position: "early" },
  { token: "blue",            value: "cobalt_blue", position: "early" },
  { token: "clear glass",     value: "clear",       position: "anywhere" },
  { token: "clear",           value: "clear",       position: "anywhere" },
];

// Strip leading determiners/quantifiers/design-phrase tokens so
// "The blue glass bottle" and "Cylinder design 5ml Blue glass bottle"
// both have a starting position where "blue" is the first color word.
function stripLeading(text) {
  return text.replace(/^[\s,.\-]*(?:an?|the|some|one|two|three|pack of|in)\s+/i, "").trim();
}

function inferColor(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  const start = stripLeading(lower);
  // "early" window = first 80 chars, which covers "Cylinder design 5ml Blue glass bottle with..."
  const early = lower.slice(0, 80);

  for (const hint of COLOR_HINTS) {
    if (hint.position === "anywhere") {
      if (lower.includes(hint.token)) return hint.value;
    } else if (hint.position === "start") {
      if (start.startsWith(hint.token + " ") || start.startsWith(hint.token + ",")
          || start === hint.token || start.startsWith(hint.token + ".")) {
        return hint.value;
      }
    } else if (hint.position === "early") {
      if (early.includes(hint.token)) return hint.value;
    }
  }
  return null;
}

// Parse color from the graceSku code as a fallback. The convention used
// by Grace ERP is to encode the body color as a 3-letter token after the
// family and capacity: GB-CYL-{COLOR}-{CAPACITY}-... Examples:
//   CLR → clear, BLU → cobalt_blue, AMB → amber, FRS → frosted,
//   SWL → swirl, GRN → green, BLK → black, WHT → white, PNK → pink,
//   GLD → ? (closure finish, NOT glass color — usually glass is CLR).
//   SLV/CPR/GLD/LVN/MTC/SLV in the *cap* position are closure finishes,
//   not glass colors.
const SKU_COLOR_TOKENS = {
  CLR: "clear",
  CL:  "clear",
  BLU: "cobalt_blue",
  BL:  "cobalt_blue",
  AMB: "amber",
  AM:  "amber",
  FRS: "frosted",
  FR:  "frosted",
  SWL: "swirl",
  GRN: "green",
  BLK: "black",
  WHT: "white",
  PNK: "pink",     // not in our canonical enum — see note
  GL:  null,      // ambiguous — usually closure finish
  SLV: null,
  CPR: null,
  GLD: null,
  LVN: null,
  MTC: null,
};

function colorFromGraceSku(graceSku) {
  if (!graceSku) return null;
  const parts = String(graceSku).toUpperCase().split("-");
  // Walk parts after the family code; the 3-letter color token appears
  // before the capacity digits.
  for (const part of parts) {
    const upper = part.toUpperCase();
    // Exact match
    if (upper in SKU_COLOR_TOKENS) {
      const mapped = SKU_COLOR_TOKENS[upper];
      if (mapped) return mapped;
      // null = known to be closure, not glass — skip
    }
    // 2-letter prefix match
    if (upper.length === 2 && (upper + "") in SKU_COLOR_TOKENS) {
      const mapped = SKU_COLOR_TOKENS[upper + ""];
      if (mapped) return mapped;
    }
  }
  return null;
}

// ── Canonical slug builder ──────────────────────────────────────
// Stable URL-style slug derived from family + capacityMl + color +
// applicator. This is the join key across CSV ↔ Convex ↔ Sanity.
function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function inferApplicator(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  if (lower.includes("vintage bulb sprayer") || lower.includes("antique sprayer")) {
    if (lower.includes("tassel")) return "antiquespray-tassel";
    return "antiquespray";
  }
  if (lower.includes("fine mist sprayer") || lower.includes("sprayer") || lower.includes("spray")) {
    return "finemist";
  }
  if (lower.includes("lotion pump") || lower.includes("lotion treatment")) return "lotionpump";
  if (lower.includes("atomizer")) return "atomizer";
  if (lower.includes("dropper")) return "dropper";
  if (lower.includes("roller ball") || lower.includes("roll-on") || lower.includes("roll on")) return "rollon";
  if (lower.includes("reducer")) return "reducer";
  if (lower.includes("phenolic") || lower.includes("screw cap")) return "capclosure";
  return null;
}

function buildCanonicalSlug(family, capacityMl, color, applicator) {
  const parts = [
    slugify(family),
    capacityMl ? `${capacityMl}ml` : null,
    color && color !== "clear" ? color : null,
    applicator,
  ].filter(Boolean);
  return parts.join("-");
}

// ── CSV read/write ──────────────────────────────────────────────
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function readCsv(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
  return { headers, rows };
}

function csvEscape(s) {
  const v = String(s ?? "");
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function writeCsv(filePath, headers, rows) {
  const out = [];
  out.push(headers.map(csvEscape).join(","));
  for (const row of rows) {
    out.push(headers.map((h) => csvEscape(row[h] ?? "")).join(","));
  }
  fs.writeFileSync(filePath, out.join("\n") + "\n");
}

// ── Main ──────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = {
    apply: false,
    csv: DEFAULT_CSV,
    out: null,
    report: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    switch (key) {
      case "--apply": args.apply = true; break;
      case "--csv": args.csv = path.resolve(argv[++i]); break;
      case "--out": args.out = path.resolve(argv[++i]); break;
      case "--report": args.report = path.resolve(argv[++i]); break;
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
Color backfill script.

Usage:
  node scripts/backfill_color.mjs                  # dry-run
  node scripts/backfill_color.mjs --apply         # write v2 CSV
  node scripts/backfill_color.mjs --apply --out <path>

Options:
  --apply        Write the backfilled CSV (default: dry-run, no write)
  --csv PATH     Source CSV (default data/grace_products_final.csv)
  --out PATH     Output path (default data/grace_products_final.v2.csv)
  --report PATH  Write a JSON report of what changed (optional)
`);
}

function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); }
  catch (err) { console.error(`Error: ${err.message}`); printHelp(); process.exit(2); }

  if (!fs.existsSync(args.csv)) {
    console.error(`CSV not found: ${args.csv}`);
    process.exit(2);
  }

  const outPath = args.out || (args.apply ? DEFAULT_OUT : null);

  const { headers, rows } = readCsv(args.csv);

  // Add the new columns if they don't exist.
  // The original CSV has NO `color` column — we add it as the canonical
  // downstream field. `inferredColor` is the raw inference result for
  // traceability; `color` is what the rest of the pipeline reads.
  const newCols = ["color", "canonical_slug", "colorSource", "csvLastUpdatedAt", "convexSyncedAt"];
  for (const col of newCols) {
    if (!headers.includes(col)) headers.push(col);
  }

  const now = new Date().toISOString();
  let filledFromText = 0;
  let filledFromSku = 0;
  let alreadyFilled = 0;
  let couldNotInfer = 0;
  const distribution = {};
  const inferFailures = [];

  for (const row of rows) {
    const family = (row.family || "").trim();
    const category = (row.category || "").trim();
    if (!family) continue;

    const existingColor = (row.color || "").trim();
    let color = existingColor;
    let colorSource = "catalog";

    // Component-only rows (caps, sprayers, droppers sold separately) and
    // packaging/jar rows have no glass color. Mark them as N/A and skip
    // the infer logic.
    if (category === "Component" || category === "Accessory" || category === "Packaging Box"
        || category === "Packaging Supply" || category === "Packaging" || category === "Gift Bag"
        || category === "Gift Box" || category === "Glass Jar" || category === "Plastic Bottle"
        || category === "Aluminum Bottle") {
      color = "n/a";
      colorSource = "component";
      distribution[color] = (distribution[color] || 0) + 1;

      const capacityMl = parseCapacityMl(row.capacity);
      const applicator = inferApplicator(`${row.item_name || ""} ${row.item_description || ""}`);
      const slug = buildCanonicalSlug(family, capacityMl, color, applicator);

      row.color = color;
      row.canonical_slug = slug;
      row.colorSource = colorSource;
      row.csvLastUpdatedAt = now;
      row.convexSyncedAt = row.convexSyncedAt || "";
      continue;
    }

    if (!color) {
      const text = `${row.item_name || ""} ${row.item_description || ""}`;
      // First try text-mining
      let inferred = inferColor(text);
      let source = "text-mined";
      // Fall back to graceSku code parsing
      if (!inferred) {
        inferred = colorFromGraceSku(row.grace_sku);
        source = inferred ? "sku-code" : "uninferred";
      }
      if (inferred) {
        color = inferred;
        colorSource = source;
        if (source === "text-mined") filledFromText++;
        else if (source === "sku-code") filledFromSku++;
      } else {
        color = "";
        colorSource = "uninferred";
        couldNotInfer++;
        inferFailures.push({
          graceSku: row.grace_sku,
          family,
          itemName: (row.item_name || "").slice(0, 100),
        });
      }
    } else {
      // Normalize existing color values to match our canonical enum
      const normalized = inferColor(existingColor) || existingColor.toLowerCase().replace(/\s+/g, "_");
      if (normalized !== existingColor) {
        color = normalized;
        colorSource = "catalog-normalized";
      }
      alreadyFilled++;
    }

    distribution[color] = (distribution[color] || 0) + 1;

    // Build canonical slug
    const capacityMl = parseCapacityMl(row.capacity);
    const applicator = inferApplicator(`${row.item_name || ""} ${row.item_description || ""}`);
    const slug = buildCanonicalSlug(family, capacityMl, color, applicator);

    row.color = color;
    row.canonical_slug = slug;
    row.colorSource = colorSource;
    row.csvLastUpdatedAt = now;
    row.convexSyncedAt = row.convexSyncedAt || "";
  }

  console.log(`\n=== Color backfill summary ===`);
  console.log(`Source CSV: ${args.csv}`);
  console.log(`  Rows processed: ${rows.length}`);
  console.log(`  Already filled:           ${alreadyFilled}`);
  console.log(`  Filled from text:         ${filledFromText}`);
  console.log(`  Filled from SKU code:     ${filledFromSku}`);
  console.log(`  Could not infer:          ${couldNotInfer}`);
  console.log(`  Marked N/A (component):   ${rows.filter(r => r.colorSource === "component").length}`);
  console.log(`\nColor distribution after backfill:`);
  for (const [c, n] of Object.entries(distribution).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${(c || "(empty)").padEnd(20)}: ${n}`);
  }

  if (inferFailures.length > 0) {
    console.log(`\nRows where color could NOT be inferred (first 20):`);
    for (const f of inferFailures.slice(0, 20)) {
      console.log(`  ${f.graceSku.padEnd(32)} | ${f.family.padEnd(14)} | ${f.itemName}`);
    }
    if (inferFailures.length > 20) {
      console.log(`  ... and ${inferFailures.length - 20} more`);
    }
  }

  if (!args.apply) {
    console.log(`\n=== DRY RUN — no files written ===`);
    console.log(`Run with --apply to write ${outPath || DEFAULT_OUT}`);
    if (args.report) {
      fs.writeFileSync(args.report, JSON.stringify({
        ranAt: now,
        source: args.csv,
        totalRows: rows.length,
        alreadyFilled,
        filledFromText,
        filledFromSku,
        couldNotInfer,
        markedNA: rows.filter(r => r.colorSource === "component").length,
        distribution,
        inferFailures,
      }, null, 2));
      console.log(`Report written: ${args.report}`);
    }
    return;
  }

  // Apply mode: write new CSV
  fs.writeFileSync(outPath,
    headers.map(csvEscape).join(",") + "\n" +
    rows.map((r) => headers.map((h) => csvEscape(r[h] ?? "")).join(",")).join("\n") + "\n"
  );
  console.log(`\nWrote: ${outPath}`);
  console.log(`Diff against source with:  diff ${args.csv} ${outPath}`);
}

function parseCapacityMl(s) {
  if (!s) return null;
  const m = String(s).match(/(\d+)\s*ml/i);
  return m ? parseInt(m[1], 10) : null;
}

main();