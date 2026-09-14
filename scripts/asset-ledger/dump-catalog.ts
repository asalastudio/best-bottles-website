/** Dump products (audit projection) and fitments from a deployment to data/asset-ledger/<env>-*.json. Read-only. */
import { readFileSync, writeFileSync } from "node:fs"; import path from "node:path";
import { ConvexHttpClient } from "convex/browser"; import { api } from "../../convex/_generated/api";
const root = process.cwd();
for (const line of readFileSync(path.join(root, ".env.local"), "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
async function main() {
    const env = process.argv[2] === "prod" ? "prod" : "dev";
    const url = env === "prod" ? "https://precise-raccoon-123.convex.cloud" : process.env.NEXT_PUBLIC_CONVEX_URL!;
    const convex = new ConvexHttpClient(url);
    const products: any[] = []; let cursor: string | null = null;
    for (;;) { const r: any = await convex.query(api.products.getAllForAudit, { limit: 500, cursor }); products.push(...r.page); if (r.isDone) break; cursor = r.continueCursor; }
    const fitments = await convex.query(api.fitments.listAll, {});
    console.log(env, url, "products", products.length, "fitments", fitments.length);
    console.log("product keys:", Object.keys(products[0]).join(","));
    writeFileSync(path.join(root, `data/asset-ledger/${env}-products-dump.json`), JSON.stringify(products));
    writeFileSync(path.join(root, `data/asset-ledger/${env}-fitments-dump.json`), JSON.stringify(fitments, null, 1));
}
main().catch(e => { console.error(e); process.exit(1); });
