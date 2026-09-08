/** Read-only. Resolves ONLY components already listed for Cylinder/Circle bottles.
 * npx tsx scripts/audit_builder_component_reconciliation.ts [--url public-convex-url] [--out directory]
 * No publication, alias migration, kit mutation or Shopify writes. */
import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { listedReplacementSku } from "../src/lib/bottle-builder/components";

async function main() {
    config({ path: ".env.local", quiet: true });
    const argument = (key: string) => { const i = process.argv.indexOf(key); return i < 0 ? undefined : process.argv[i + 1]; };
    const url = argument("--url") ?? process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) throw Error("A Convex URL is required");
    const client = new ConvexHttpClient(url);
    const references = new Map<string, { sku: string; neck: string | null; kind: string; listedGraceSkus: Set<string>; bottles: Set<string> }>();
    for (const family of ["Cylinder", "Circle"]) {
        const data = await client.query(api.matrix.getFamilyRows, { family });
        if (data.truncated) throw Error(`Truncated ${family} catalog`);
        for (const row of data.rows) for (const [kind, parts] of Object.entries(row.components)) for (const part of parts) {
            const sku = listedReplacementSku(part) ?? part.websiteSku;
            if (!sku) continue;
            const key = JSON.stringify([sku, row.neckThreadSize, kind]);
            const ref = references.get(key) ?? { sku, neck: row.neckThreadSize, kind, listedGraceSkus: new Set<string>(), bottles: new Set<string>() };
            ref.listedGraceSkus.add(part.graceSku); if (row.websiteSku) ref.bottles.add(row.websiteSku); references.set(key, ref);
        }
    }
    const skus = [...new Set([...references.values()].map(r => r.sku))];
    type Product = NonNullable<Awaited<ReturnType<typeof client.query<typeof api.products.lookupSku>>>>["product"];
    const products = new Map<string, Product | null>(); let cursor = 0;
    await Promise.all(Array.from({ length: 8 }, async () => {
        while (cursor < skus.length) { const sku = skus[cursor++]; products.set(sku, (await client.query(api.products.lookupSku, { sku }))?.product ?? null); }
    }));
    const records = [...references.values()].map(ref => {
        const p = products.get(ref.sku);
        const exactIdentity = Boolean(p && p.websiteSku === ref.sku && p.neckThreadSize === ref.neck && !/__RETIRED__/i.test(p.websiteSku ?? ""));
        const issue = !p ? "record_missing" : !exactIdentity ? "identity_or_neck_mismatch"
            : p.shopifySellable === false ? "publication_or_commerce_block"
            : !p.shopifyVariantId ? "missing_checkout_variant"
            : /out of stock|unavailable|discontinued/i.test(p.stockStatus ?? "") ? "stock_unavailable" : "resolved_record";
        return { websiteSku: ref.sku, bottleNeck: ref.neck, componentKind: ref.kind, listedGraceSkus: [...ref.listedGraceSkus].sort(),
            resolvedGraceSku: p?.graceSku ?? null, resolvedNeck: p?.neckThreadSize ?? null, issue,
            shopifySellable: p?.shopifySellable ?? null, sellableReason: p?.shopifySellableReason ?? null,
            sellableCheckedAt: p?.shopifySellableCheckedAt ?? null, stockStatus: p?.stockStatus ?? null,
            sourceUrl: p?.productUrl ?? null, affectedBottleSkus: [...ref.bottles].sort() };
    }).sort((a, b) => a.websiteSku.localeCompare(b.websiteSku));
    const directory = path.resolve(argument("--out") ?? "data/audits/builder-component-reconciliation"); fs.mkdirSync(directory, { recursive: true });
    const totals = records.reduce<Record<string, number>>((counts, r) => ({ ...counts, [r.issue]: (counts[r.issue] ?? 0) + 1 }), {});
    fs.writeFileSync(path.join(directory, "component-reconciliation.json"), JSON.stringify({ checkedAt: new Date().toISOString(), mode: "read-only", totals, records }, null, 2) + "\n");
    console.log(JSON.stringify({ directory, uniqueWebsiteSkus: skus.length, totals }, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Audit failed"); process.exitCode = 1; });
