#!/usr/bin/env node
// Read-only. What can this token do, which sales channels exist, how is a WORKING product published,
// and what are the draft products? Writes nothing.
import { readFileSync } from "fs"; import { resolve, dirname } from "path"; import { fileURLToPath } from "url";
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
for (const line of readFileSync(resolve(REPO, ".env.local"), "utf-8").split("\n")) { const t = line.trim(); if (!t || t.startsWith("#") || !t.includes("=")) continue; const i = t.indexOf("="); const k = t.slice(0, i).trim(); let v = t.slice(i + 1).trim(); if (v.includes("#")) v = v.slice(0, v.indexOf("#")).trim(); if (!process.env[k]) process.env[k] = v; }
const domain = (process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/$/, ""); const token = process.env.SHOPIFY_ADMIN_TOKEN;
const gql = async (query, variables) => { const r = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, { method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token }, body: JSON.stringify({ query, variables }) }); const j = await r.json(); if (j.errors) return { errors: j.errors.map(e => e.message) }; return j.data; };
const scopes = await gql(`{ currentAppInstallation { accessScopes { handle } } }`);
console.log("scopes:", scopes.errors ?? scopes.currentAppInstallation.accessScopes.map(s => s.handle).filter(h => /product|publication/.test(h)).join(", "));
const pubs = await gql(`{ publications(first: 20) { nodes { id name } } }`);
console.log("publications:", pubs.errors ?? pubs.publications.nodes.map(p => p.name).join(" | "));
const audit = JSON.parse(readFileSync(resolve(REPO, "data/audits/launch-readiness-2026-07-29/shopify-draft-audit-2026-09-20.json"), "utf-8"));
const drafts = new Map(); for (const r of audit) { const p = r.shopify.product; const e = drafts.get(p.id) ?? { title: p.title, skus: 0, image: Boolean(p.featuredImage), variants: p.variantsCount?.count }; e.skus++; drafts.set(p.id, e); }
const active = await gql(`{ products(first: 3, query: "status:active") { nodes { title status resourcePublicationsV2(first: 20) { nodes { isPublished publication { name } } } } } }`);
console.log("a working product is published to:", active.errors ?? active.products.nodes.map(p => `${p.title.slice(0, 40)} -> ${p.resourcePublicationsV2.nodes.filter(n => n.isPublished).map(n => n.publication.name).join(" + ")}`).join("\n   "));
console.log(`\n${drafts.size} draft products:`);
for (const [, d] of [...drafts].sort((a, b) => b[1].skus - a[1].skus)) console.log(`  ${String(d.skus).padStart(3)} blocked SKUs / ${String(d.variants).padStart(3)} variants  ${d.image ? "      " : "NO IMG"}  ${d.title}`);
