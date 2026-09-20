#!/usr/bin/env node
/**
 * Undo what the Shopify products/update webhook wrote into the PRODUCTION catalogue when 37 draft
 * products were activated on 2026-09-20 (394 SKUs renamed and marked Out of Stock, one price, 36
 * groups' hero / description / primary SKU, 98 shell rows). See convex/shopifySync.ts for the cause.
 *
 * Where the true values come from
 *   stockStatus, webPrice1pc   the snapshot taken BEFORE the activation
 *                              (data/audits/launch-readiness-2026-07-29/shopify-draft-audit-2026-09-20.json)
 *   group heroImageUrl         NOT dev. Prod keeps it empty (measured on untouched groups at run time); a
 *                              cdn.shopify.com hero — the webhook's signature — goes back to empty.
 *   itemName, other group      the DEV deployment, which mirrors prod's catalogue and received no webhook.
 *   fields
 *                              A name is taken from dev only if prod's current name has the webhook's
 *                              shape ("<Shopify title> — <variant title>") and dev's does not.
 *   shell rows                 data/audits/shopify-activation-2026-09-20/rows-inserted-by-webhook.json
 *
 * Every write goes through convex/catalogRestore.ts: a field is written only while it still holds the
 * value seen here, so anything corrected since is reported and left alone, and a re-run is a no-op.
 *
 *   node scripts/restore_shopify_activation.mjs                  # plan only; reads, writes nothing
 *   node scripts/restore_shopify_activation.mjs --server-dry-run # also asks prod what it WOULD write
 *   node scripts/restore_shopify_activation.mjs --apply          # writes (needs BEST_BOTTLES_CONVEX_WRITE_TOKEN)
 *   add --skip-heroes to leave productGroups.heroImageUrl alone
 *
 * Deploy convex/ to production first: the restore mutations and the fixed webhook handler ship together.
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs"; import { resolve, dirname } from "path"; import { fileURLToPath } from "url";
import { ConvexHttpClient } from "convex/browser"; import { anyApi } from "convex/server";
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
try { for (const line of readFileSync(resolve(REPO, ".env.local"), "utf-8").split("\n")) { const t = line.trim(); if (!t || t.startsWith("#") || !t.includes("=")) continue; const i = t.indexOf("="); const k = t.slice(0, i).trim(); let v = t.slice(i + 1).trim(); if (v.includes("#")) v = v.slice(0, v.indexOf("#")).trim(); if (!process.env[k]) process.env[k] = v; } } catch {}
const args = process.argv.slice(2); const APPLY = args.includes("--apply"); const SERVER = APPLY || args.includes("--server-dry-run"); const HEROES = !args.includes("--skip-heroes");
const PROD = "https://precise-raccoon-123.convex.cloud", DEV = "https://helpful-elephant-638.convex.cloud";
const writeToken = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
if (SERVER && !writeToken) { console.error("Missing BEST_BOTTLES_CONVEX_WRITE_TOKEN"); process.exit(1); }
const dir = resolve(REPO, "data/audits/shopify-activation-2026-09-20"); mkdirSync(dir, { recursive: true });
const before = JSON.parse(readFileSync(resolve(REPO, "data/audits/launch-readiness-2026-07-29/shopify-draft-audit-2026-09-20.json"), "utf-8"));
const shells = JSON.parse(readFileSync(resolve(dir, "rows-inserted-by-webhook.json"), "utf-8"));
const P = new ConvexHttpClient(PROD), D = new ConvexHttpClient(DEV);
const products = async c => { const m = new Map(); let cursor = null; for (;;) { const r = await c.action(anyApi.products.getProductExportPage, { cursor, numItems: 500 }); for (const p of r.page) m.set(p.graceSku, p); cursor = r.continueCursor; if (r.isDone) break; } return m; };
const group = async (c, slug) => { const r = await c.query(anyApi.products.getProductGroup, { slug }); return r?.group ?? r; };
const webhookName = (name, sku) => typeof name === "string" && / — /.test(name) && (name.endsWith(` — ${sku}`) || /^\d+ ml .+ — .+$/.test(name) || / — [A-Z]{2,3}-[A-Z0-9-]+$/.test(name));

console.error(`[restore] mode=${APPLY ? "APPLY" : SERVER ? "SERVER DRY RUN" : "PLAN ONLY"}  heroes=${HEROES}`);
const prod = await products(P), dev = await products(D);

// ── products ────────────────────────────────────────────────────────────────
const productEntries = [], noName = [];
for (const b of before) {
  const now = prod.get(b.graceSku); if (!now) continue;
  const d = dev.get(b.graceSku); const expect = {}, patch = {};
  if (now.stockStatus !== b.stockStatus) { expect.stockStatus = now.stockStatus ?? null; patch.stockStatus = b.stockStatus ?? null; }
  if (now.webPrice1pc !== b.webPrice1pc) { expect.webPrice1pc = now.webPrice1pc ?? null; patch.webPrice1pc = b.webPrice1pc ?? null; }
  if (webhookName(now.itemName, b.graceSku)) {
    if (d?.itemName && !webhookName(d.itemName, b.graceSku)) { expect.itemName = now.itemName; patch.itemName = d.itemName; } else noName.push(b.graceSku);
  }
  if (Object.keys(patch).length) productEntries.push({ graceSku: b.graceSku, expect, patch });
}

// ── groups ──────────────────────────────────────────────────────────────────
const slugOf = new Map((await P.query(anyApi.products.getAllGroupsForPlates, {})).map(g => [g._id, g.slug]));
const touched = [...new Set(before.map(b => slugOf.get(prod.get(b.graceSku)?.productGroupId)).filter(Boolean))];
// Heroes do NOT come from dev (measured 2026-09-20: 2 of 52 untouched groups agree — prod draws group
// heroes from the registry and plates, and keeps productGroups.heroImageUrl empty). The webhook wrote
// `images[0].src`, a cdn.shopify.com URL. So: measure what untouched PROD groups hold, and only if
// they are (almost) all empty, put a touched group's Shopify-CDN hero back to empty.
const untouched = [...new Set([...slugOf.values()])].filter(s => !touched.includes(s)).sort().filter((_, i) => i % 5 === 0).slice(0, 60);
let heroEmpty = 0, heroCompared = 0;
for (const slug of untouched) { const p = await group(P, slug); if (!p) continue; heroCompared++; if (!p.heroImageUrl) heroEmpty++; }
const heroAgreement = heroCompared ? heroEmpty / heroCompared : 0;
const groupFields = ["displayName", "groupDescription", "primaryGraceSku", "primaryWebsiteSku", "variantCount"];
const groupEntries = [], groupsNotOnDev = [];
for (const slug of touched) {
  const [p, d] = [await group(P, slug), await group(D, slug)];
  const expect = {}, patch = {};
  if (d) for (const f of groupFields) { const a = p?.[f] ?? null, b = d?.[f] ?? null; if (a === b) continue; if (f === "displayName" && !b) continue; if (f === "variantCount" && typeof b !== "number") continue; expect[f] = a; patch[f] = b; }
  else groupsNotOnDev.push(slug);
  if (HEROES && heroAgreement >= 0.95 && /^https:\/\/cdn\.shopify\.com\//.test(p?.heroImageUrl ?? "")) { expect.heroImageUrl = p.heroImageUrl; patch.heroImageUrl = null; }
  if (Object.keys(patch).length) groupEntries.push({ slug, expect, patch });
}

// ── shell rows ──────────────────────────────────────────────────────────────
const shellRows = shells.map(s => ({ id: s._id, graceSku: s.graceSku }));

const count = (entries, f) => entries.filter(e => f in e.patch).length;
const plan = { generatedAt: new Date().toISOString(), products: productEntries, groups: groupEntries, shellRows, notes: { namesWithNoCleanSource: noName, groupsNotOnDev, untouchedProdGroupsWithNoHero: `${heroEmpty}/${heroCompared}` } };
writeFileSync(resolve(dir, "restore-plan.json"), JSON.stringify(plan, null, 1));
console.log(JSON.stringify({
  products: { rows: productEntries.length, itemName: count(productEntries, "itemName"), stockStatus: count(productEntries, "stockStatus"), webPrice1pc: count(productEntries, "webPrice1pc"), namesWithNoCleanSource: noName.length },
  groups: { rows: groupEntries.length, ...Object.fromEntries([...groupFields, "heroImageUrl"].map(f => [f, count(groupEntries, f)])), notOnDev: groupsNotOnDev.length },
  heroCheck: `${heroEmpty}/${heroCompared} untouched PROD groups hold no hero (${(100 * heroAgreement).toFixed(0)} %) — ${!HEROES ? "heroes skipped" : heroAgreement >= 0.95 ? "so a Shopify-CDN hero the webhook wrote goes back to empty" : "below 95 %: heroes left alone"}`,
  shellRows: shellRows.length, planFile: "data/audits/shopify-activation-2026-09-20/restore-plan.json",
}, null, 1));
if (!SERVER) { console.log("\nPLAN ONLY — nothing was sent to Convex. --server-dry-run asks prod what it would write; --apply writes."); process.exit(0); }

// ── server ──────────────────────────────────────────────────────────────────
const dryRun = !APPLY; const totals = {};
const add = (k, r) => { const t = totals[k] ??= {}; for (const [f, v] of Object.entries(r)) t[f] = typeof v === "number" ? (t[f] ?? 0) + v : Array.isArray(v) ? [...(t[f] ?? []), ...v] : v; };
try {
  for (let i = 0; i < productEntries.length; i += 100) add("products", await P.mutation(anyApi.catalogRestore.restoreProductFields, { writeToken, dryRun, entries: productEntries.slice(i, i + 100) }));
  for (let i = 0; i < groupEntries.length; i += 50) add("groups", await P.mutation(anyApi.catalogRestore.restoreGroupFields, { writeToken, dryRun, entries: groupEntries.slice(i, i + 50) }));
  for (let i = 0; i < shellRows.length; i += 100) add("shellRows", await P.mutation(anyApi.catalogRestore.removeWebhookShellRows, { writeToken, dryRun, rows: shellRows.slice(i, i + 100) }));
} catch (e) {
  // A production deployment redacts every error to "Server Error", so a missing function and a real
  // fault look identical from here. Say the likely cause and how to tell them apart; write nothing.
  if (/Could not find public function|catalogRestore|Server Error/.test(String(e))) {
    console.error(`\nProduction refused the restore call (${String(e.message ?? e).slice(0, 80)}).`);
    console.error("Most likely convex/catalogRestore.ts is not deployed there yet: merge the webhook-fix PR, deploy convex/ to prod, then re-run.");
    console.error("If it IS deployed, the real message is in the Convex dashboard logs for that Request ID. Nothing was written.");
    process.exit(2);
  }
  throw e;
}
writeFileSync(resolve(dir, `restore-result-${APPLY ? "apply" : "server-dry-run"}.json`), JSON.stringify(totals, null, 1));
for (const [k, t] of Object.entries(totals)) console.log(k, JSON.stringify({ ...t, changedSince: t.changedSince?.length, notFound: t.notFound?.length, refused: t.refused?.length }));
console.log(APPLY ? "\nAPPLIED." : "\nSERVER DRY RUN — prod reported what it would write; nothing was written.");
