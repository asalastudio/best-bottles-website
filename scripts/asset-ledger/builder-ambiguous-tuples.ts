/**
 * Which builder configurations of a family are dropped because their selection
 * tuple (body, colour, fitment, closure) is shared by more than one SKU. Read-only.
 *   npx tsx scripts/asset-ledger/builder-ambiguous-tuples.ts "Boston Round"
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { isBuilderCandidate, resolveBuilderConfigurations, type CatalogRow, type BuilderKit } from "../../src/lib/bottle-builder/model";
import { resolveListedComponents } from "../../src/lib/bottle-builder/components";
const root = process.cwd();
for (const line of readFileSync(path.join(root, ".env.local"), "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
async function main() {
  const family = process.argv[2] ?? "Boston Round";
  const data = await convex.query(api.matrix.getFamilyRows, { family });
  const rows: CatalogRow[] = data.rows;
  const cache = new Map<string, unknown>();
  const resolved = await resolveListedComponents(rows, async (sku: string) => { if (!cache.has(sku)) cache.set(sku, (await convex.query(api.products.lookupSku, { sku }))?.product ?? null); return cache.get(sku) as never; });
  const cands = resolved.filter(isBuilderCandidate);
  const kits: (BuilderKit | null)[] = await Promise.all(cands.map(r => convex.query(api.productKits.forSku, { websiteSku: r.websiteSku!, graceSku: r.graceSku! })));
  const plates: (string | null)[] = [];
  for (let s = 0; s < cands.length; s += 200) { const slice = cands.slice(s, s + 200); const { plates: p } = await convex.query(api.productPlates.forSkus, { skus: slice.map(r => r.websiteSku!) }); for (const r of slice) plates.push(p[r.websiteSku!]?.image ?? null); }
  const configs = resolveBuilderConfigurations(cands, kits, plates).filter((c): c is NonNullable<typeof c> => !!c);
  const tuples = new Map<string, string[]>();
  for (const c of configs) { const k = `${c.bodyId} | ${c.color} | ${c.fitment} | ${c.closure}`; tuples.set(k, [...(tuples.get(k) ?? []), c.id]); }
  let amb = 0;
  for (const [k, ids] of [...tuples].sort()) { if (ids.length > 1) { amb += ids.length; console.log("AMBIGUOUS", k, "->", ids.join(", "));
    for (const id of ids) { const r = rows.find(r => r.websiteSku === id); const c = configs.find(c => c.id === id);
      console.log(`    ${id.padEnd(28)} app=${r?.applicator} capColor=${r?.capColor} capStyle=${r?.capStyle} finish=${c?.finishComponent?.websiteSku} "${c?.finishComponent?.name ?? ""}" | ${(r?.itemName ?? "").replace(/For use with.*$/, "").slice(0, 120)}`); } } }
  console.log(`${configs.length} configs, ${tuples.size} tuples, ${amb} configs dropped as ambiguous`);
  for (const id of ["GBBstnAmb15mlWhtDropper","GBBstnAmb15mlWhtDropperGlTrim","GBBstnAmb15mlWhtDropperSlTrim"]) { const r = rows.find(r => r.websiteSku === id); console.log(id, r?.itemName, "| capColor:", r?.capColor, "| applicator:", r?.applicator); }
}
main().catch(e => { console.error(e); process.exit(1); });
