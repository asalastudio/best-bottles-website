#!/usr/bin/env node
/** Read-only SKU-level coverage of the images a product page can actually layer.
 * node scripts/audit-pdp-layer-coverage.mjs --url https://...convex.cloud --out /tmp/pdp-layer-audit
 * A flat product photo is deliberately reported as fallback, not coverage.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const arg = (flag) => {
  const index = process.argv.indexOf(flag);
  return index < 0 ? null : process.argv[index + 1];
};
const url = arg("--url") ?? process.env.NEXT_PUBLIC_CONVEX_URL;
const out = resolve(arg("--out") ?? "/tmp/best-bottles-pdp-layer-audit");
if (!url) throw Error("Pass --url with the public Convex endpoint");
const client = new ConvexHttpClient(url);
const chunk = (rows, size) => Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size));
const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const fields = ["graceSku", "websiteSku", "category", "family", "capacityMl", "color", "neckThreadSize", "applicator", "capColor", "coverage", "registerReason", "missingLayers", "imageUrl", "productUrl"];

let cursor = null;
const products = [];
do {
  const page = await client.action(api.products.getProductExportPage, { cursor, numItems: 500 });
  products.push(...page.page);
  if (page.isDone) break;
  if (cursor === page.continueCursor) throw Error("Product pagination stalled");
  cursor = page.continueCursor;
} while (true);

const bottle = (row) => /bottle|vial|atomizer|jar/i.test(row.category ?? "") &&
  !String(row.websiteSku ?? "").includes("__RETIRED__") &&
  Boolean(row.graceSku) && Boolean(row.productGroupId) &&
  row.shopifySellable !== false && !/out of stock|discontinued/i.test(row.stockStatus ?? "");
const variants = products.filter(bottle);
const results = [];
for (const batch of chunk(variants, 50)) {
  const skus = batch.map((row) => row.graceSku);
  const register = await client.query(api.registerStage.forSkus, { graceSkus: skus });
  const legacy = await client.query(api.productKits.forSkus, {
    pairs: batch.map((row) => ({ graceSku: row.graceSku, websiteSku: row.websiteSku ?? null })),
  });
  for (const row of batch) {
    const assembly = register.assemblies[row.graceSku];
    const kit = legacy[row.websiteSku || row.graceSku] ?? null;
    const missingLayers = [];
    const expectsSidecar = row.category === "Glass Bottle" && /^(Fine Mist Sprayer|Metal Roller Ball|Plastic Roller Ball)$/.test(row.applicator ?? "");
    if (assembly?.renderable) {
      const plate = register.plates[assembly.plateKey];
      if (!plate?.url) missingLayers.push("body image");
      for (const part of assembly.parts) {
        const component = register.components[part.componentId];
        if (!component?.layers?.some((layer) => layer.url)) missingLayers.push(`${part.role}:${part.componentId}`);
      }
      if (expectsSidecar && !assembly.parts.some((part) => register.components[part.componentId]?.layers?.some((layer) =>
        (layer.slot === "cap" || layer.slot === "overcap") && layer.url))) missingLayers.push("removable cap/overcap");
    } else if (kit) {
      if (!kit.parts?.some((part) => part.slot === "body" && part.image?.url)) missingLayers.push("body image");
      if (!kit.parts?.some((part) => part.slot !== "body" && part.image?.url)) missingLayers.push("component image");
      if (expectsSidecar && !kit.parts?.some((part) => (part.slot === "cap" || part.slot === "overcap") && part.image?.url)) missingLayers.push("removable cap/overcap");
    }
    const coverage = assembly?.renderable && missingLayers.length === 0 ? "register kit"
      : kit && missingLayers.length === 0 ? "legacy kit"
      : kit || assembly?.renderable ? "incomplete kit" : "flat-image fallback";
    results.push({ ...Object.fromEntries(fields.map((field) => [field, row[field] ?? ""])),
      coverage, registerReason: assembly?.reason ?? (assembly ? "" : "no register assembly"),
      missingLayers: missingLayers.join("; "), imageUrl: row.imageUrl ?? "" });
  }
}
results.sort((a, b) => String(a.family).localeCompare(String(b.family)) || Number(a.capacityMl) - Number(b.capacityMl) || String(a.websiteSku).localeCompare(String(b.websiteSku)));
const counts = Object.fromEntries([...new Set(results.map((row) => row.coverage))].map((status) => [status, results.filter((row) => row.coverage === status).length]));
await mkdir(out, { recursive: true });
await writeFile(resolve(out, "coverage.csv"), fields.join(",") + "\n" + results.map((row) => fields.map((field) => csvCell(row[field])).join(",")).join("\n") + "\n");
await writeFile(resolve(out, "flat-image-fallbacks.csv"), fields.join(",") + "\n" + results.filter((row) => row.coverage === "flat-image fallback").map((row) => fields.map((field) => csvCell(row[field])).join(",")).join("\n") + "\n");
await writeFile(resolve(out, "layer-issues.csv"), fields.join(",") + "\n" + results.filter((row) => row.coverage === "flat-image fallback" || row.coverage === "incomplete kit").map((row) => fields.map((field) => csvCell(row[field])).join(",")).join("\n") + "\n");
await writeFile(resolve(out, "summary.json"), JSON.stringify({ checkedAt: new Date().toISOString(), endpoint: url, exportedProducts: products.length, auditedVariants: results.length, counts, knownFrostedElegant: results.find((row) => row.websiteSku === "GBElgFrst15SpryGlMatt") ?? null }, null, 2) + "\n");
console.log(JSON.stringify({ auditedVariants: results.length, counts, out, knownFrostedElegant: results.find((row) => row.websiteSku === "GBElgFrst15SpryGlMatt") ?? null }, null, 2));
