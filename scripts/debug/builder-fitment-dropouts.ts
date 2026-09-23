// Read-only probe: for one family and one applicator, say which gate keeps each catalogue row
// out of Build Your Bottle. Runs the builder's own model code against a deployment.
//   npx tsx scripts/debug/builder-fitment-dropouts.ts Empire Reducer
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { compatibleFinishComponent, configurationFromRow, isBuilderCandidate } from "../../src/lib/bottle-builder/model";

const [family, applicator] = process.argv.slice(2);
const convex = new ConvexHttpClient(process.env.PROBE_CONVEX_URL ?? "https://precise-raccoon-123.convex.cloud");
(async () => {
    const data = await convex.query(api.matrix.getFamilyRows, { family });
    const rows = data.rows.filter(row => (row.applicator ?? "").trim() === applicator);
    console.log(`${family} · ${applicator}: ${rows.length} catalogue rows`);
    for (const row of rows) {
        const why: string[] = [];
        if (row.resolution === "unknown") why.push("resolution unknown");
        if (!compatibleFinishComponent(row)) why.push("no compatible finish component");
        if (!row.shopifyVariantId) why.push("no Shopify variant");
        if (row.shopifySellable === false) why.push("not sellable on Shopify");
        if (/out of stock|discontinued|unavailable/i.test(row.stockStatus ?? "")) why.push(`stock: ${row.stockStatus}`);
        if (!(typeof row.webPrice1pc === "number" && row.webPrice1pc > 0)) why.push("no price");
        if (!/bottle|vial/i.test(row.category ?? "")) why.push(`category ${row.category}`);
        if (!why.length && !isBuilderCandidate(row)) why.push("isBuilderCandidate: other");
        if (!why.length) {
            const kit = await convex.query(api.productKits.forSku, { websiteSku: row.websiteSku!, graceSku: row.graceSku! });
            if (!kit) why.push("no kit served");
            else if (!configurationFromRow(row, kit)) why.push("configurationFromRow refuses the kit");
        }
        console.log(`  ${(row.websiteSku ?? "").padEnd(26)} ${String(row.capacityMl).padStart(3)} ml  ${why.length ? why.join("; ") : "OFFERED"}`);
    }
})();
