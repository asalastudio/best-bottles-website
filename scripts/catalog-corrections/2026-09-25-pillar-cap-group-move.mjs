#!/usr/bin/env node
/**
 * Move the Pillar 9 mL black-cap bottle (GBPillar9BlkShSht) out of the corrupt production group
 * "pillar-9ml-clear-Size: GBPillar9BlkSht Nemat In" into pillar-9ml-clear-13-415, where the Pillar
 * roll-on SKUs already live. The batch-6 hero release verifies the production holder of every hero it
 * publishes, so the held Pillar cap hero can only be released once this move has happened.
 *
 *   node scripts/catalog-corrections/2026-09-25-pillar-cap-group-move.mjs [--prod] [--apply]
 *
 * Without --apply it only reports the bottle's current group and the target group's members.
 * products:moveProductToGroup refuses a duplicated SKU or a missing target slug, and is a no-op
 * when the bottle is already there, so re-running is safe.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, "");
}
const PROD_URL = "https://precise-raccoon-123.convex.cloud";
const prod = process.argv.includes("--prod");
const apply = process.argv.includes("--apply");
const url = prod ? PROD_URL : process.env.NEXT_PUBLIC_CONVEX_URL;
const writeToken = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
if (!url || !writeToken) { console.error("NEXT_PUBLIC_CONVEX_URL and BEST_BOTTLES_CONVEX_WRITE_TOKEN must be set in .env.local"); process.exit(1); }
if (!prod && url === PROD_URL) { console.error(".env.local points at prod; pass --prod explicitly"); process.exit(1); }

const SKU = "GBPillar9BlkShSht";
const TARGET = "pillar-9ml-clear-13-415";

const client = new ConvexHttpClient(url);
console.log(`${prod ? "PROD" : "dev"} ${apply ? "APPLY" : "dry run"} — ${SKU} → ${TARGET}`);

/** Group slugs that currently hold the SKU, read the way the hero release scripts verify a holder. */
async function holders() {
    const result = await client.query(anyApi.products.searchCatalog, {
        filters: { search: SKU }, sort: "relevance", view: "grid", limit: 24,
    });
    const byId = new Map(result.items.map(item => [item._id, item]));
    return result.variantPreviewRows
        .filter(row => row.variants.some(variant => variant.websiteSku === SKU))
        .map(row => byId.get(row.groupId)?.slug ?? `(group ${row.groupId} not in items)`);
}

const before = await holders();
console.log(`  current group: ${before.length ? before.join(", ") : "(not found by catalogue search)"}`);
const target = await client.query(anyApi.products.getProductGroup, { slug: TARGET });
if (!target) { console.error(`  target group ${TARGET} does not exist on this deployment`); process.exit(1); }
console.log(`  target group holds: ${target.variants.map(variant => variant.websiteSku).join(", ")}`);
if (before.length === 1 && before[0] === TARGET) { console.log("  already in the target group — nothing to do"); process.exit(0); }
if (!apply) { console.log("  would move (pass --apply)"); process.exit(0); }

const result = await client.mutation(anyApi.products.moveProductToGroup, { writeToken, websiteSku: SKU, groupSlug: TARGET });
console.log(`  ${result.moved ? "moved" : "NOT moved"}: ${result.detail} (${result.from ?? "?"} → ${result.to}${result.color ? `, colour ${result.color}` : ""})`);
if (!result.moved && result.detail !== "already in this group") process.exitCode = 1;
console.log(`  group now: ${(await holders()).join(", ") || "(none)"}`);
