/**
 * Component + fitment snapshot for the data audit. Separate from
 * convex-snapshot.json because it carries the compatibility edges, which the
 * plate pipeline never needs.
 *
 *   npx tsx scripts/paperdoll/export-component-snapshot.ts -> data/paper-doll/component-snapshot.json
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
    type Page = FunctionReturnType<typeof api.products.getComponentsForAudit>;
    const products: Page["page"] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 100; page++) {
        const result: Page = await convex.query(api.products.getComponentsForAudit, { limit: 400, cursor });
        products.push(...result.page);
        if (result.isDone) break;
        cursor = result.continueCursor;
    }
    const fitments = await convex.query(api.products.getFitmentsForAudit, {});
    const edges = products.reduce((n, p) => n + p.componentSkus.length, 0);
    const out = { generatedAt: new Date().toISOString(), deployment: url, counts: { products: products.length, componentEdges: edges, fitmentRules: fitments.length }, fitments, products };
    const target = resolve(process.cwd(), "data/paper-doll/component-snapshot.json");
    writeFileSync(target, JSON.stringify(out, null, 0).replace(/},{"websiteSku"/g, '},\n{"websiteSku"'));
    console.log(`products ${products.length}, component edges ${edges}, fitment rules ${fitments.length}`);
    console.log(`wrote ${target}`);
}

main().catch((error) => { console.error(error); process.exit(1); });
