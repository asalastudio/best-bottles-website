#!/usr/bin/env node
/**
 * 2026-09-28 — three production rows that disagree with dev, found by the library refresh (PR #303). Dev holds the
 * right values; production's broke their builds, and the frosted Ivory Leather reducer got a product page of its own.
 *
 *   GBCylSwrl9RollWht        cap style "Dot Cap" → "Roll-On" (no white dotted 17-415 cap exists)
 *   GBCylSwrl9MtlRollWht     cap style "Dot Cap" → "Roll-On"; applicator "Plastic Roller Ball" → "Metal Roller Ball"
 *   GBCrclFrst50RdcrIvyLthr  neck "18-400" → "18-415"; cap colour "Ivory" → "Ivory Leather"; its 18-400 dropper list
 *                            replaced by its Black Leather sibling's 18-415 list; moved from the stray page
 *                            circle-50ml-frosted-18-400-reducer back to circle-50ml-frosted-18-415-reducer
 *
 * Every write is guarded (a field changes only while it still holds the value below) and logged in catalogChangeLog.
 * On dev every step reports "already correct".
 *
 *   node scripts/catalog-corrections/2026-09-28-prod-catalogue-drift.mjs            # dry run, dev
 *   node scripts/catalog-corrections/2026-09-28-prod-catalogue-drift.mjs --prod     # dry run, production
 *   node scripts/catalog-corrections/2026-09-28-prod-catalogue-drift.mjs --prod --apply
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, "");
}
const PROD_URL = "https://precise-raccoon-123.convex.cloud";
const prod = process.argv.includes("--prod");
const apply = process.argv.includes("--apply");
const url = prod ? PROD_URL : process.env.NEXT_PUBLIC_CONVEX_URL;
const writeToken = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
if (!url || !writeToken) { console.error("NEXT_PUBLIC_CONVEX_URL and BEST_BOTTLES_CONVEX_WRITE_TOKEN must be set in .env.local"); process.exit(1); }
if (!prod && url === PROD_URL) { console.error(".env.local points at prod; pass --prod explicitly"); process.exit(1); }

const REASON = "2026-09-28 production rows that disagreed with dev (library refresh, PR #303; Jordan)";
const IVORY = "GBCrclFrst50RdcrIvyLthr";
const FIELDS = [
    { websiteSku: "GBCylSwrl9RollWht", expect: { capStyle: "Dot Cap" }, patch: { capStyle: "Roll-On" } },
    { websiteSku: "GBCylSwrl9MtlRollWht", expect: { capStyle: "Dot Cap", applicator: "Plastic Roller Ball" }, patch: { capStyle: "Roll-On", applicator: "Metal Roller Ball" } },
    { websiteSku: IVORY, expect: { neckThreadSize: "18-400", capColor: "Ivory" }, patch: { neckThreadSize: "18-415", capColor: "Ivory Leather" } },
];
const COMPONENTS = {
    websiteSku: IVORY,
    copyFromWebsiteSku: "GBCrclFrst50RdcrBlkLthr",
    expectComponentSkus: ["CMP-DRP-WHT-18400-66", "CMP-DRP-BKSL-18400-66", "CMP-DRP-WTGD-18400-66", "CMP-DRP-BKGD-18400-66", "CMP-DRP-WTSL-18400-66", "CMP-CAP-BLK-18-400", "CMP-DRP-BLK-18400-90MM", "CMP-APP-BLK-18-400"],
};
const GROUP = "circle-50ml-frosted-18-415-reducer";

const client = new ConvexHttpClient(url);
console.log(`${prod ? "PROD" : "dev"} ${apply ? "APPLY" : "dry run"}`);
let problems = 0;

const fields = await client.mutation("catalogCorrections:correctProductFields", { writeToken, dryRun: !apply, entries: FIELDS, reason: REASON });
for (const w of fields.written) console.log(`  ${apply ? "wrote" : "would write"} ${w.websiteSku}.${w.field}: ${w.before} → ${w.after}`);
if (fields.alreadyCorrect.length) console.log(`  already correct: ${fields.alreadyCorrect.join(", ")}`);
if (fields.changedSince.length) console.log(`  changed since, left alone: ${fields.changedSince.map(c => `${c.websiteSku}.${c.field}=${c.now}`).join(", ")}`);
if (fields.notFound.length) console.log(`  not found: ${fields.notFound.join(", ")}`);
problems += fields.changedSince.length + fields.notFound.length;

const components = await client.mutation("catalogCorrections:correctProductComponents", { writeToken, dryRun: !apply, reason: REASON, ...COMPONENTS });
console.log(`  ${IVORY} components: ${components.outcome} (${components.before.length} listed → ${components.after.length} from ${COMPONENTS.copyFromWebsiteSku})`);
if (components.outcome === "changed-since" || components.outcome === "not-found") problems++;

const target = await client.query(anyApi.products.getProductGroup, { slug: GROUP });
const inTarget = Boolean(target?.variants?.some(variant => variant.websiteSku === IVORY));
if (!target) { console.log(`  group ${GROUP} does not exist here`); problems++; }
else if (inTarget) console.log(`  ${IVORY} already on ${GROUP}`);
else if (!apply) console.log(`  would move ${IVORY} to ${GROUP} (${target.variants.length} siblings there)`);
else {
    const moved = await client.mutation("products:moveProductToGroup", { writeToken, websiteSku: IVORY, groupSlug: GROUP });
    console.log(`  move: ${moved.moved ? "moved" : "not moved"} (${moved.detail}) ${moved.from ?? "?"} → ${moved.to}`);
    if (!moved.moved && moved.detail !== "already in this group") problems++;
}
if (problems) process.exitCode = 1;
