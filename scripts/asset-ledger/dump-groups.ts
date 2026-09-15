/** Dump productGroups (plate projection) from a deployment. Read-only. */
import { readFileSync, writeFileSync } from "node:fs"; import path from "node:path";
import { ConvexHttpClient } from "convex/browser"; import { api } from "../../convex/_generated/api";
for (const line of readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
async function main() {
    const env = process.argv[2] === "prod" ? "prod" : "dev";
    const c = new ConvexHttpClient(env === "prod" ? "https://precise-raccoon-123.convex.cloud" : process.env.NEXT_PUBLIC_CONVEX_URL!);
    const groups: any[] = await c.query(api.products.getAllGroupsForPlates, {});
    writeFileSync(`data/asset-ledger/${env}-groups-dump.json`, JSON.stringify(groups));
    console.log(env, "groups", groups.length, "keys:", Object.keys(groups[0]).join(","));
}
main().catch(e => { console.error(e); process.exit(1); });
