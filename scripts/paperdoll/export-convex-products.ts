/**
 * Snapshot the catalogue for the cross-reference: every product's identity
 * fields and every product group's family fields, from the deployment that
 * NEXT_PUBLIC_CONVEX_URL names. Paginated (the products table is past the
 * 16 MB single-read limit for getAllForAudit; this query is lean).
 *
 *   npx tsx scripts/paperdoll/export-convex-products.ts   -> data/paper-doll/convex-snapshot.json
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";

async function main() {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
    const convex = new ConvexHttpClient(url);
    type ProductsPage = FunctionReturnType<typeof api.products.getAllForPlates>;
    const products: ProductsPage["page"] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 100; page++) {
        const result: ProductsPage = await convex.query(api.products.getAllForPlates, { limit: 1000, cursor });
        products.push(...result.page);
        if (result.isDone) break;
        cursor = result.continueCursor;
    }
    const groups = await convex.query(api.products.getAllGroupsForPlates, {});

    const byWebsiteSku = new Map<string, number>();
    for (const p of products) {
        const sku = typeof p.websiteSku === "string" ? p.websiteSku.trim() : "";
        if (sku) byWebsiteSku.set(sku, (byWebsiteSku.get(sku) ?? 0) + 1);
    }
    const duplicates = [...byWebsiteSku.entries()].filter(([, n]) => n > 1).map(([sku, n]) => ({ websiteSku: sku, count: n })).sort((a, b) => a.websiteSku.localeCompare(b.websiteSku));

    const out = {
        generatedAt: new Date().toISOString(),
        deployment: url,
        counts: { products: products.length, groups: groups.length, withWebsiteSku: byWebsiteSku.size, duplicateWebsiteSkus: duplicates.length },
        duplicates,
        products,
        groups,
    };
    const target = resolve(process.cwd(), "data/paper-doll/convex-snapshot.json");
    writeFileSync(target, JSON.stringify(out, null, 0).replace(/},{"_id"/g, "},\n{\"_id\""));
    console.log(`products ${products.length}, groups ${groups.length}, distinct website SKUs ${byWebsiteSku.size}, duplicated ${duplicates.length}`);
    console.log(`wrote ${target}`);
}

main().catch((error) => { console.error(error); process.exit(1); });
