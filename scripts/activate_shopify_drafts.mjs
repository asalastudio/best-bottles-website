#!/usr/bin/env node
/**
 * Make the DRAFT Shopify products behind blocked catalogue SKUs sellable.
 *
 * Jordan, 2026-09-20: "Everything needs to be sellable on Shopify." The 2026-07-29 launch audit left
 * this as his decision; 394 SKUs sit in 37 products that were imported as DRAFT and never activated,
 * so /cart/<variant>:<qty> returns HTTP 410 and the storefront hides them (no reducers in Build Your Bottle).
 *
 * For each product: status -> ACTIVE and published to the Online Store (REST `published: true`,
 * which the token's write_products scope allows; it has no publications scope). Nothing else is
 * touched — no price, title, inventory, image or variant. Every product's prior state is written to
 * a rollback file BEFORE it is changed, and the cart permalink is checked before and after.
 *
 *   node scripts/activate_shopify_drafts.mjs                         # dry run: lists what would change
 *   node scripts/activate_shopify_drafts.mjs --apply --only <gid>    # one product
 *   node scripts/activate_shopify_drafts.mjs --apply                 # all
 *   node scripts/activate_shopify_drafts.mjs --rollback <file>       # back to DRAFT / unpublished
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs"; import { resolve, dirname } from "path"; import { fileURLToPath } from "url";
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(resolve(REPO, ".env.local"), "utf-8").split("\n")) { const t = line.trim(); if (!t || t.startsWith("#") || !t.includes("=")) continue; const i = t.indexOf("="); const k = t.slice(0, i).trim(); let v = t.slice(i + 1).trim(); if (v.includes("#")) v = v.slice(0, v.indexOf("#")).trim(); if (!process.env[k]) process.env[k] = v; }
const domain = (process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/$/, ""); const token = process.env.SHOPIFY_ADMIN_TOKEN;
const args = process.argv.slice(2); const APPLY = args.includes("--apply"); const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const rollbackFile = args.includes("--rollback") ? args[args.indexOf("--rollback") + 1] : null;
const dir = resolve(REPO, "data/audits/shopify-activation-2026-09-20"); mkdirSync(dir, { recursive: true });
const rest = async (method, path, body) => { for (let a = 1; a <= 4; a++) { const r = await fetch(`https://${domain}/admin/api/2025-01/${path}`, { method, headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token }, body: body ? JSON.stringify(body) : undefined }); if (r.status === 429) { await new Promise(s => setTimeout(s, 1500 * a)); continue; } const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${JSON.stringify(j).slice(0, 300)}`); return j; } throw new Error("rate limited"); };
const permalink = async variantGid => (await fetch(`https://${domain}/cart/${variantGid.split("/").pop()}:1`, { redirect: "manual" })).status;

if (rollbackFile) {
  const prior = JSON.parse(readFileSync(resolve(REPO, rollbackFile), "utf-8"));
  for (const p of prior) { await rest("PUT", `products/${p.id}.json`, { product: { id: p.id, status: p.status.toLowerCase(), published: Boolean(p.published_at) } }); console.log("restored", p.id, p.status, p.title); }
  process.exit(0);
}
const audit = JSON.parse(readFileSync(resolve(REPO, "data/audits/launch-readiness-2026-07-29/shopify-draft-audit-2026-09-20.json"), "utf-8"));
const products = new Map(); for (const r of audit) { const p = r.shopify.product; const e = products.get(p.id) ?? { gid: p.id, title: p.title, variants: [] }; e.variants.push(r.shopify.id); products.set(p.id, e); }
const todo = [...products.values()].filter(p => !only || p.gid === only);
console.log(`${APPLY ? "APPLY" : "DRY RUN"}: ${todo.length} product(s)`);
const prior = [], results = [];
for (const p of todo) {
  const id = p.gid.split("/").pop();
  const { product: before } = await rest("GET", `products/${id}.json?fields=id,title,status,published_at,published_scope`);
  const beforeCart = await permalink(p.variants[0]);
  if (!APPLY) { console.log(`  would activate  ${before.status.padEnd(8)} published_at=${before.published_at}  cart ${beforeCart}  ${before.title}`); continue; }
  prior.push(before); writeFileSync(resolve(dir, `rollback-${only ? id : "all"}.json`), JSON.stringify(prior, null, 1));   // written BEFORE the change
  const { product: after } = await rest("PUT", `products/${id}.json`, { product: { id: before.id, status: "active", published: true } });
  await new Promise(s => setTimeout(s, 1200));
  const afterCart = await permalink(p.variants[0]);
  results.push({ id: before.id, title: before.title, before: { status: before.status, published_at: before.published_at, cart: beforeCart }, after: { status: after.status, published_at: after.published_at, cart: afterCart } });
  console.log(`  ${before.status} -> ${after.status}  published_at=${after.published_at}  cart ${beforeCart} -> ${afterCart}  ${before.title}`);
}
if (APPLY) writeFileSync(resolve(dir, `result-${only ? only.split("/").pop() : "all"}.json`), JSON.stringify(results, null, 1));
