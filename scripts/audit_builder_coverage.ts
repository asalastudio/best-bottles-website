/** Read-only. Every catalog bottle body (family x capacity x neck x profile) against
 * the bodies a running builder actually serves, with the catalog reason each
 * missing body is held back. Nothing is written to Convex, Shopify or Blob.
 *   npx tsx scripts/audit_builder_coverage.ts http://localhost:3001 /tmp/builder-coverage.json
 * Start the server with VERCEL=1 to see what production draws (no local review kits). */
import fs from "node:fs";
import { config } from "dotenv";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { resolveListedComponents } from "../src/lib/bottle-builder/components";
import { builderBodyIdentity, compatibleFinishComponent, isBuilderCandidate, reviewedCylinderFiveMlRow, reviewedBodyImage, type CatalogRow } from "../src/lib/bottle-builder/model";
import { catalogIncludedAssembly } from "../convex/catalogIncludedAssemblies";
import { storefrontFamily } from "../src/lib/products/storefront-family";
config({ path: ".env.local", quiet: true });
const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const base = process.argv[2] ?? "http://localhost:3001";
function reasons(r: CatalogRow): string[] {
    const out: string[] = [];
    if (!(r.resolution !== "unknown" || catalogIncludedAssembly(r))) out.push("compat:resolution-unknown");
    if (/__RETIRED__/i.test(r.websiteSku ?? "")) out.push("retired");
    if (!compatibleFinishComponent(r)) out.push("compat:no-finish-component");
    for (const k of ["graceSku", "websiteSku", "itemName", "family", "color", "neckThreadSize"] as const) if (!r[k]) out.push(`data:missing-${k}`);
    if (!/bottle|vial/i.test(r.category ?? "")) out.push("category");
    if (!(r.capacityMl && r.capacityMl > 0)) out.push("data:no-capacity");
    if (!r.shopifyVariantId) out.push("shopify:no-variant-id");
    if (r.shopifySellable === false) out.push("shopify:not-sellable");
    if (/out of stock|discontinued|unavailable/i.test(r.stockStatus ?? "")) out.push(`stock:${r.stockStatus}`);
    if (!(typeof r.webPrice1pc === "number" && r.webPrice1pc > 0)) out.push("price:missing");
    return out;
}
async function main() {
const families = (await client.query(api.matrix.listFamilies, {})).map(f => f.family);
const storefront = [...new Set(families.map(storefrontFamily))];
const served = new Map<string, Set<string>>();
for (const fam of storefront) {
    const html = await (await fetch(`${base}/matrix?family=${encodeURIComponent(fam)}`)).text();
    const ids = new Set([...html.matchAll(/bodyId\\":\\"([^\\]+)/g)].map(m => m[1]).filter(id => id.includes("|")));
    // The page falls back to Cylinder when a family has nothing: only trust ids of this family.
    served.set(fam, ids);
}
const report: any[] = [];
for (const family of families) {
    const data = await client.query(api.matrix.getFamilyRows, { family });
    const bottles = data.rows.filter((r: CatalogRow) => /bottle|vial/i.test(r.category ?? "")).map(reviewedCylinderFiveMlRow);
    const rows = await resolveListedComponents(bottles, async sku => (await client.query(api.products.lookupSku, { sku }))?.product ?? null);
    const bodies = new Map<string, CatalogRow[]>();
    for (const r of rows) { const id = builderBodyIdentity(r).bodyId; bodies.set(id, [...(bodies.get(id) ?? []), r]); }
    const sf = storefrontFamily(family);
    for (const [bodyId, list] of bodies) {
        const inBuilder = served.get(sf)?.has(bodyId) ?? false;
        const counts: Record<string, number> = {};
        for (const r of list) for (const why of (reasons(r).length ? reasons(r) : ["candidate"])) counts[why] = (counts[why] ?? 0) + 1;
        const candidates = list.filter(isBuilderCandidate);
        report.push({ family, storefront: sf, bodyId, skus: list.length, candidates: candidates.length, inBuilder,
            hasReviewedBodyImage: list.some(r => reviewedBodyImage(r)), colors: [...new Set(list.map(r => r.color))].join("/"), counts,
            sample: list.slice(0, 3).map(r => r.websiteSku) });
    }
    console.error(`${family}: ${[...bodies.keys()].filter(id => served.get(sf)?.has(id)).length}/${bodies.size} bodies in builder`);
}
fs.writeFileSync(process.argv[3] ?? "builder-coverage.json", JSON.stringify(report, null, 2));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
