/** Trace the finish-component decision for named bottle SKUs against the live matrix rows. Read-only. */
import { readFileSync } from "node:fs"; import path from "node:path";
import { ConvexHttpClient } from "convex/browser"; import { api } from "../../convex/_generated/api";
import { compatibleFinishComponent, type CatalogRow } from "../../src/lib/bottle-builder/model";
import { resolveListedComponents } from "../../src/lib/bottle-builder/components";
import { getFinishFromWebsiteSku } from "../../src/lib/paper-doll/tokens.generated";
for (const line of readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
async function main() {
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const want = process.argv.slice(2); const families = new Set<string>();
    const all: CatalogRow[] = [];
    for (const f of (await convex.query(api.matrix.listFamilies, {})).map((x: any) => x.family)) {
        const data = await convex.query(api.matrix.getFamilyRows, { family: f });
        const hit = (data.rows as CatalogRow[]).filter(r => want.includes(r.websiteSku ?? ""));
        if (hit.length) { families.add(f); all.push(...data.rows); }
    }
    const cache = new Map<string, unknown>();
    const resolved = await resolveListedComponents(all, async (sku: string) => { if (!cache.has(sku)) cache.set(sku, (await convex.query(api.products.lookupSku, { sku }))?.product ?? null); return cache.get(sku) as never; });
    for (const row of resolved.filter(r => want.includes(r.websiteSku ?? ""))) {
        const finish = getFinishFromWebsiteSku(row.websiteSku)?.label ?? row.capColor?.trim();
        console.log(`\n== ${row.websiteSku} applicator=${row.applicator} capColor=${row.capColor} finishLabel=${getFinishFromWebsiteSku(row.websiteSku)?.label ?? "null"} -> using '${finish}' resolution=${row.resolution}`);
        console.log("   compatibleFinishComponent:", JSON.stringify(compatibleFinishComponent(row)));
        for (const [kind, parts] of Object.entries(row.components)) {
            console.log(`   ${kind}:`);
            for (const p of parts) console.log(`      ${String(p.websiteSku).padEnd(60)} label=${String(getFinishFromWebsiteSku(p.websiteSku)?.label ?? "null").padEnd(22)} stock=${p.stockStatus} variant=${p.shopifyVariantId ? "y" : "n"}`);
        }
    }
}
main().catch(e => { console.error(e); process.exit(1); });
