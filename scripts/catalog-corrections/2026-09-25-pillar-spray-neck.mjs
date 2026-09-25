#!/usr/bin/env node
/**
 * 2026-09-25 — the Pillar 9 mL spray bottle is a 13-415, not a 17-415 (Jordan).
 *
 * GBPillar9SpryBlkMatt was never in the master seed. The February migration
 * `addMissingFineMistSprayers` hand-typed it as a 17-415 and gave it the 9 mL Cylinder's
 * component list (convex/migrations.ts, GBCYL_SWRL_9_COMPONENTS), so the catalogue filed it as
 * "9 ml · 17-415" in its own group. Its siblings (GBPillar9BlkShSht, GBPillar9RollBlkDot,
 * GBPillar9MtlRollBlkdot) are 13-415 on bestbottles.com, and the legacy photos show one glass
 * body for all four. The master sheet's row for this SKU is a sprayer component (20 mm tall),
 * which is where "Component - Multi-Use" and heightWithCap "20" leaked in.
 *
 * What this writes (each conditional on the current value, each logged in catalogChangeLog):
 *   product GBPillar9SpryBlkMatt   neckThreadSize 17-415 → 13-415
 *                                   graceDescription "… Thread 17-415." → "… Thread 13-415."
 *                                   useCaseDescription "Component - Multi-Use" → "Multi-Use"
 *                                   heightWithCap "20" → null
 *                                   components: the Cylinder 17-415 list → the 13-415 list every
 *                                   other 13-415 spray bottle carries (copied from GBTallCyl9SpryBlkMatt)
 *   group pillar-9ml-clear-17-415-finemist   neckThreadSize 17-415 → 13-415
 *
 * The group's slug keeps its old spelling for now. Three things key on it — the hero registry
 * (src/lib/products/catalog-heroes.json), the Sanity productGroupContent document, and the
 * catalogue's legacy-alias filter (an alias hides the old slug from the grid until the data has
 * moved) — so renaming it to pillar-9ml-clear-13-415-finemist is a separate, coordinated step
 * (`catalogCorrections:correctGroupFields` accepts `slug` when that day comes).
 *
 *   node scripts/catalog-corrections/2026-09-25-pillar-spray-neck.mjs            # dry run, dev
 *   node scripts/catalog-corrections/2026-09-25-pillar-spray-neck.mjs --apply    # write, dev
 *   node scripts/catalog-corrections/2026-09-25-pillar-spray-neck.mjs --prod [--apply]
 *   ... --revert [--apply]   # swap expect and patch (components copied back from GBCylSwrl9SpryBlk)
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, "");
}
const PROD_URL = "https://precise-raccoon-123.convex.cloud";
const prod = process.argv.includes("--prod");
const apply = process.argv.includes("--apply");
const revert = process.argv.includes("--revert");
const url = prod ? PROD_URL : process.env.NEXT_PUBLIC_CONVEX_URL;
const writeToken = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
if (!url || !writeToken) { console.error("NEXT_PUBLIC_CONVEX_URL and BEST_BOTTLES_CONVEX_WRITE_TOKEN must be set in .env.local"); process.exit(1); }
if (!prod && url === PROD_URL) { console.error(".env.local points at prod; pass --prod explicitly"); process.exit(1); }

const SKU = "GBPillar9SpryBlkMatt";
const GROUP_SLUG = "pillar-9ml-clear-17-415-finemist";

/** [field, wrong value, right value] — the product's descriptive fields. */
const PRODUCT_FIELDS = [
    ["neckThreadSize", "17-415", "13-415"],
    ["graceDescription", "9ml Clear Pillar bottle with matte black spray. Thread 17-415.", "9ml Clear Pillar bottle with matte black spray. Thread 13-415."],
    ["useCaseDescription", "Component - Multi-Use", "Multi-Use"],
    ["heightWithCap", "20", null],
];
/** The 9 mL Cylinder 17-415 list the migration copied onto the Pillar (convex/migrations.ts GBCYL_SWRL_9_COMPONENTS). */
const CYLINDER_17_415_COMPONENTS = [
    "CMP-ROC-MSLV-17415", "CMP-ROC-SLV-17415-DOT", "CMP-ROC-PNK-17415-DOT", "CMP-ROC-MGLD-17415", "CMP-ROC-SGLD-17415",
    "CMP-ROC-SSLV-17415", "CMP-ROC-CPR-17415", "CMP-ROC-SBLK-17415", "CMP-ROC-WHT-17415", "CMP-ROC-BLK-17415-DOT",
    "CMP-LPM-MSLV-17-415", "CMP-LPM-SGLD-17-415", "CMP-LPM-BLK-17-415",
    "CMP-SPR-SGLD-17-415", "CMP-SPR-SLV-17-415", "CMP-SPR-SSLV-17-415", "CMP-SPR-BLK-17-415-01",
];
/** The list every other 13-415 fine-mist bottle carries (GBTallCyl9SpryBlkMatt, GBSleek8SpryBlkMatt, …). */
const STANDARD_13_415_COMPONENTS = [
    "CMP-CAP-WHT-S-13-415", "CMP-CAP-SLV-13-415-01", "CMP-CAP-SGLD-13-415-01",
    "CMP-ROC-SLV-13415-DOT", "CMP-ROC-MSLV-13415", "CMP-ROC-PNK-13415-DOT", "CMP-ROC-MGLD-13415", "CMP-ROC-SSLV-13415",
    "CMP-ROC-MCPR-13415", "CMP-ROC-SGLD-13415", "CMP-ROC-SBLK-13415",
    "CMP-SPR-MTCP-13-415-07", "CMP-SPR-SHBK-13-415-07", "CMP-SPR-MTBL-13-415-07", "CMP-SPR-SHGD-13-415-07",
    "CMP-SPR-MTGD-13-415-07", "CMP-SPR-MTSL-13-415-07", "CMP-SPR-SHSL-13-415-07", "CMP-SPR-CLR-30ML", "CMP-SPR-SLV-",
    "CMP-CAP-BLK-S-13-415", "CMP-ROC-BLK-13415-DOT", "CMP-SPR-MTBK-13-415-07",
];

const reason = revert ? "revert 2026-09-25 Pillar 9 mL spray neck (13-415)" : "2026-09-25 Pillar 9 mL spray is a 13-415, not 17-415 (Jordan)";
const productEntry = { websiteSku: SKU, expect: {}, patch: {} };
for (const [field, wrong, right] of PRODUCT_FIELDS) {
    productEntry.expect[field] = revert ? right : wrong;
    productEntry.patch[field] = revert ? wrong : right;
}
const groupEntry = revert
    ? { slug: GROUP_SLUG, expect: { neckThreadSize: "13-415" }, patch: { neckThreadSize: "17-415" } }
    : { slug: GROUP_SLUG, expect: { neckThreadSize: "17-415" }, patch: { neckThreadSize: "13-415" } };
const componentArgs = revert
    ? { websiteSku: SKU, copyFromWebsiteSku: "GBCylSwrl9SpryBlk", expectComponentSkus: STANDARD_13_415_COMPONENTS }
    : { websiteSku: SKU, copyFromWebsiteSku: "GBTallCyl9SpryBlkMatt", expectComponentSkus: CYLINDER_17_415_COMPONENTS };

const client = new ConvexHttpClient(url);
console.log(`${prod ? "PROD" : "dev"} ${apply ? "APPLY" : "dry run"}${revert ? " (revert)" : ""}`);
let problems = 0;

const fields = await client.mutation("catalogCorrections:correctProductFields", { writeToken, dryRun: !apply, reason, entries: [productEntry] });
for (const w of fields.written) console.log(`  ${apply ? "wrote" : "would write"} ${w.websiteSku}.${w.field}: ${w.before} → ${w.after}`);
if (fields.alreadyCorrect.length) console.log(`  already correct: ${fields.alreadyCorrect.join(", ")}`);
if (fields.changedSince.length) { problems++; console.log(`  changed since, left alone: ${fields.changedSince.map(c => `${c.websiteSku}.${c.field}=${c.now}`).join(", ")}`); }
if (fields.notFound.length) { problems++; console.log(`  not found: ${fields.notFound.join(", ")}`); }

const components = await client.mutation("catalogCorrections:correctProductComponents", { writeToken, dryRun: !apply, reason, ...componentArgs });
console.log(`  components ${components.outcome}: ${components.before.length} → ${components.after.length} (from ${componentArgs.copyFromWebsiteSku})`);
if (components.outcome === "changed-since" || components.outcome === "not-found") { problems++; console.log(`    now lists: ${components.before.join(", ") || "(none)"}`); }

const group = await client.mutation("catalogCorrections:correctGroupFields", { writeToken, dryRun: !apply, reason, entries: [groupEntry] });
for (const w of group.written) console.log(`  ${apply ? "wrote" : "would write"} group ${w.slug}.${w.field}: ${w.before} → ${w.after}`);
if (group.alreadyCorrect.length) console.log(`  already correct: ${group.alreadyCorrect.join(", ")}`);
if (group.changedSince.length) { problems++; console.log(`  changed since, left alone: ${group.changedSince.map(c => `${c.slug}.${c.field}=${c.now}`).join(", ")}`); }
if (group.notFound.length) { problems++; console.log(`  group not found: ${group.notFound.join(", ")}`); }

if (problems) process.exitCode = 1;
