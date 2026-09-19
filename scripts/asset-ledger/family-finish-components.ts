/** Map every row of a family to its joined finish component, applicator, colour and builder-candidate flag.
 *   npx tsx scripts/asset-ledger/family-finish-components.ts Elegant Circle …   → data/asset-ledger/<family>-finish-components.json */
import { readFileSync, writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { isBuilderCandidate, compatibleFinishComponent, type CatalogRow } from "../../src/lib/bottle-builder/model";
import { resolveListedComponents } from "../../src/lib/bottle-builder/components";
for (const line of readFileSync(".env.local", "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
async function main() {
  for (const family of process.argv.slice(2)) {
    const data = await convex.query(api.matrix.getFamilyRows, { family });
    const cache = new Map<string, unknown>();
    const rows = await resolveListedComponents(data.rows as CatalogRow[], async (sku: string) => { if (!cache.has(sku)) cache.set(sku, (await convex.query(api.products.lookupSku, { sku }))?.product ?? null); return cache.get(sku) as never; });
    const out: Record<string, unknown> = {};
    for (const r of rows) out[r.websiteSku!] = { finish: compatibleFinishComponent(r)?.websiteSku ?? null, applicator: r.applicator ?? null, color: r.color, capacityMl: r.capacityMl, neck: r.neckThreadSize, candidate: isBuilderCandidate(r), graceSku: r.graceSku };
    writeFileSync(`data/asset-ledger/${family.toLowerCase()}-finish-components.json`, JSON.stringify(out, null, 1));
    const c = Object.values(out).filter((x: any) => x.candidate); console.log(family, "rows", rows.length, "candidates", c.length);
  }
}
main();
