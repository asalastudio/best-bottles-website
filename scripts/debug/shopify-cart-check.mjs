#!/usr/bin/env node
// Read-only: cart-permalink status + Shopify's own availability for given website SKUs.
import { readFileSync } from "fs"; import { resolve, dirname } from "path"; import { fileURLToPath } from "url";
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
for (const line of readFileSync(resolve(REPO, ".env.local"), "utf-8").split("\n")) { const t = line.trim(); if (!t || t.startsWith("#") || !t.includes("=")) continue; const i = t.indexOf("="); const k = t.slice(0, i).trim(); let v = t.slice(i + 1).trim(); if (v.includes("#")) v = v.slice(0, v.indexOf("#")).trim(); if (!process.env[k]) process.env[k] = v; }
const domain = (process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/$/, ""); const token = process.env.SHOPIFY_ADMIN_TOKEN;
for (const sku of process.argv.slice(2)) {
  const r = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, { method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token }, body: JSON.stringify({ query: `query($q:String!){ productVariants(first:1, query:$q){ nodes { id sku availableForSale inventoryQuantity inventoryPolicy product { status publishedAt } } } }`, variables: { q: `sku:${sku}` } }) });
  const n = (await r.json()).data.productVariants.nodes[0]; if (!n) { console.log(sku, "not found"); continue; }
  const cart = await fetch(`https://${domain}/cart/${n.id.split("/").pop()}:1`, { redirect: "manual" });
  console.log(sku.padEnd(24), "cart", cart.status, (cart.headers.get("location") || "").slice(0, 60).padEnd(60), n.product.status, "published", Boolean(n.product.publishedAt), "availableForSale", n.availableForSale, "qty", n.inventoryQuantity, n.inventoryPolicy);
}
