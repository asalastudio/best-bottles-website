#!/usr/bin/env node
/**
 * 2026-09-30 — the 71 Cylinder 5 mL 13-415 SKUs (clear + cobalt) carried the legacy site's sizes: "53 ±1 mm" high
 * (five cobalt short caps "60 ±1 mm"), "17 ±0.5 mm" or "18 ±0.5 mm" across, and cap-on heights that disagree for
 * the same cap (55 and 80 mm for short caps). The product page spec line read e.g. "H 60 mm · Ø 18 mm · 26 g".
 * Jordan's caliper session of 2026-09-29 (Bottle Caliper Log, cylinder-5ml-13-415):
 *   heightWithoutCap  53.12 mm  (both glasses)
 *   diameter          17.69 mm  (the widest of three heights; the drawing's "Body" figure)
 *   heightWithCap     65.95 mm  every roll-on (the set measured with the ball in and the cap screwed tight)
 *                     58.8 mm   lined short caps  (53.12 + cap height 16.40 - inside depth 10.77; calipered 09-27)
 *                     55.4 mm   ribbed short caps (53.12 + cap height 9.49 - inside depth 7.17)
 * Sprayers (72) and the regular caps (65) already agree with the parts and are left alone; bottle weight (25.62 g)
 * waits for a weighing. The entries (expect = production's values on 2026-09-30) are in
 * data/register/blender-cyl5-13-415/spec-correction-2026-09-30.json.
 *
 * Needs catalogCorrections.correctProductFields with heightWithoutCap and diameter (added 2026-09-30): deploy first.
 *
 *   node scripts/catalog-corrections/2026-09-30-cylinder-5ml-sizes.mjs            # dry run, dev
 *   node scripts/catalog-corrections/2026-09-30-cylinder-5ml-sizes.mjs --apply    # write, dev
 *   node scripts/catalog-corrections/2026-09-30-cylinder-5ml-sizes.mjs --prod [--apply]
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
const url = prod ? PROD_URL : process.env.NEXT_PUBLIC_CONVEX_URL;
const writeToken = prod ? process.env.REGISTER_PROD_WRITE_TOKEN ?? process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN : process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
if (!url || !writeToken) { console.error("the Convex URL and write token must be set (.env.local; prod: REGISTER_PROD_WRITE_TOKEN)"); process.exit(1); }
if (!prod && url === PROD_URL) { console.error(".env.local points at prod; pass --prod explicitly"); process.exit(1); }

const REASON = "2026-09-30 Cylinder 5 mL sizes: Jordan's caliper session of 2026-09-29 replaces the legacy site's sizes";
const entries = JSON.parse(readFileSync(resolve(ROOT, "data/register/blender-cyl5-13-415/spec-correction-2026-09-30.json"), "utf8"));
const client = new ConvexHttpClient(url);
console.log(`${prod ? "PROD" : "dev"} ${apply ? "APPLY" : "dry run"}: ${entries.length} SKUs`);
let problems = 0, written = 0;
for (let i = 0; i < entries.length; i += 50) {
    const out = await client.mutation("catalogCorrections:correctProductFields", {
        writeToken, dryRun: !apply, reason: REASON,
        entries: entries.slice(i, i + 50).map(({ websiteSku, expect, patch }) => ({ websiteSku, expect, patch })),
    });
    for (const w of out.written) console.log(`  ${apply ? "wrote" : "would write"} ${w.websiteSku}.${w.field}: ${w.before} → ${w.after}`);
    written += out.written.length;
    if (out.alreadyCorrect.length) console.log(`  already correct: ${out.alreadyCorrect.length} field(s)`);
    if (out.changedSince.length) console.log(`  changed since, left alone: ${out.changedSince.map(c => `${c.websiteSku}.${c.field}=${c.now}`).join(", ")}`);
    if (out.notFound.length) console.log(`  not found: ${out.notFound.join(", ")}`);
    problems += out.changedSince.length + out.notFound.length;
}
console.log(`${apply ? "wrote" : "would write"} ${written} field(s); ${problems} problem(s)`);
if (problems) process.exitCode = 1;
