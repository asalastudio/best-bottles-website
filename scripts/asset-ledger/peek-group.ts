/** Print full productGroup records by slug. Usage: npx tsx scripts/asset-ledger/peek-group.ts [--prod] slug... */
import { readFileSync } from "node:fs"; import path from "node:path";
import { ConvexHttpClient } from "convex/browser"; import { api } from "../../convex/_generated/api";
for (const line of readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
async function main() {
    const args = process.argv.slice(2); const prod = args.includes("--prod");
    const c = new ConvexHttpClient(prod ? "https://precise-raccoon-123.convex.cloud" : process.env.NEXT_PUBLIC_CONVEX_URL!);
    const groups: any[] = await c.query(api.products.getAllCatalogGroups, {});
    console.log(prod ? "prod" : "dev", "groups", groups.length, "keys:", Object.keys(groups[0]).join(","));
    for (const slug of args.filter(a => !a.startsWith("--"))) { const g = groups.find(x => x.slug === slug); console.log(slug, "=>", g ? JSON.stringify(g) : "MISSING"); }
}
main().catch(e => { console.error(e); process.exit(1); });
