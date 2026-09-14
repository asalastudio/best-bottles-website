/** Count productKits rows on the deployment via the paginated integrity query. Read-only. */
import { readFileSync } from "node:fs"; import path from "node:path";
import { ConvexHttpClient } from "convex/browser"; import { api } from "../../convex/_generated/api";
for (const line of readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
async function main() {
    const prod = process.argv.includes("--prod");
    const c = new ConvexHttpClient(prod ? "https://precise-raccoon-123.convex.cloud" : process.env.NEXT_PUBLIC_CONVEX_URL!);
    let cursor: string | null = null, checked = 0; const issues: any[] = [];
    for (;;) { const r: any = await c.query(api.productKits.integrity, { cursor, pageSize: 500 }); checked += r.checked; issues.push(...r.issues); if (r.isDone) break; cursor = r.continueCursor; }
    const h: Record<string, number> = {}; for (const i of issues) h[i.issue] = (h[i.issue] ?? 0) + 1;
    console.log(prod ? "prod" : "dev", "kits:", checked, "issues:", h); for (const i of issues) console.log(`  ${i.issue} ${i.sku} ${i.detail}`);
}
main().catch(e => { console.error(e); process.exit(1); });
