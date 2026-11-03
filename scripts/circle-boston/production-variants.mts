/**
 * Read-only: every Circle and Boston Round bottle variant in production Convex (paginated
 * products.getAllForPlates), for the master audit. Usage: npx tsx scripts/circle-boston/production-variants.mts <out.json>
 */
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { writeFileSync } from "node:fs";

const client = new ConvexHttpClient("https://precise-raccoon-123.convex.cloud");
const out: any[] = [];
let cursor: string | null = null;
for (;;) {
    const page = await client.query(anyApi.products.getAllForPlates, { limit: 1000, cursor }) as any;
    for (const p of page.page) if (["Circle", "Boston Round"].includes(p.family) && p.category !== "Component") out.push(p);
    if (page.isDone) break;
    cursor = page.continueCursor;
}
writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log(out.length, "variants");
