#!/usr/bin/env node
/**
 * 2026-09-28 — GBCyl5SpryBlkMatt is the one 5 mL clear Cylinder recorded as 5.5 mL (size audit, 27 Sep): capacity
 * "5.5 ml (1/6 oz)" and capacityMl 5.5, where its item name ("5 ml Clear Cylinder …"), its graceSku
 * (GB-CYL-CLR-5ML-SPR-MBLK) and its seven sprayer siblings say 5 ml (0.17 oz). Production already lists it on
 * cylinder-5ml-clear-13-415-finemist; dev gave it a page of its own (cylinder-5.5ml-clear-13-415-finemist), so on
 * dev it also moves to the 5 mL page. The legacy item descriptions ("Cylinder design 5.5ml, 1/6oz") are shared by
 * every sibling and are left alone.
 *
 * Needs catalogCorrections.correctProductFields with the capacity fields (added 2026-09-28): deploy that first.
 *
 *   node scripts/catalog-corrections/2026-09-28-cylinder-5ml-capacity.mjs            # dry run, dev
 *   node scripts/catalog-corrections/2026-09-28-cylinder-5ml-capacity.mjs --apply    # write, dev
 *   node scripts/catalog-corrections/2026-09-28-cylinder-5ml-capacity.mjs --prod [--apply]
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

const REASON = "2026-09-28 GBCyl5SpryBlkMatt recorded as 5.5 mL; its name, SKU and siblings say 5 mL (size audit; Jordan)";
const SKU = "GBCyl5SpryBlkMatt";
const PAGE = "cylinder-5ml-clear-13-415-finemist";

const client = new ConvexHttpClient(url);
console.log(`${prod ? "PROD" : "dev"} ${apply ? "APPLY" : "dry run"}`);
let problems = 0;

const fields = await client.mutation("catalogCorrections:correctProductFields", {
    writeToken, dryRun: !apply, reason: REASON,
    entries: [{ websiteSku: SKU, expect: { capacityMl: 5.5, capacity: "5.5 ml (1/6 oz)" }, patch: { capacityMl: 5, capacity: "5 ml (0.17 oz)" } }],
});
for (const w of fields.written) console.log(`  ${apply ? "wrote" : "would write"} ${w.websiteSku}.${w.field}: ${w.before} → ${w.after}`);
if (fields.alreadyCorrect.length) console.log(`  already correct: ${fields.alreadyCorrect.join(", ")}`);
if (fields.changedSince.length) console.log(`  changed since, left alone: ${fields.changedSince.map(c => `${c.websiteSku}.${c.field}=${c.now}`).join(", ")}`);
if (fields.notFound.length) console.log(`  not found: ${fields.notFound.join(", ")}`);
problems += fields.changedSince.length + fields.notFound.length;

const page = await client.query(anyApi.products.getProductGroup, { slug: PAGE });
if (!page) { console.log(`  ${PAGE} does not exist here`); process.exit(1); }
if (page.variants.some(variant => variant.websiteSku === SKU)) console.log(`  ${SKU} already on ${PAGE}`);
else if (!apply) console.log(`  would move ${SKU} to ${PAGE}`);
else {
    const moved = await client.mutation("products:moveProductToGroup", { writeToken, websiteSku: SKU, groupSlug: PAGE });
    console.log(`  move: ${moved.moved ? "moved" : "not moved"} (${moved.detail}) ${moved.from ?? "?"} → ${moved.to}`);
    if (!moved.moved && moved.detail !== "already in this group") problems++;
}
if (problems) process.exitCode = 1;
