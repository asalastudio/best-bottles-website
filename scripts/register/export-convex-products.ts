#!/usr/bin/env tsx
/**
 * Fresh Convex export for the register: the same paginated action the 23 Sep neck matrices used.
 *
 *   npx tsx scripts/register/export-convex-products.ts <out.json>
 *   python3 scripts/register/build_register.py --export <out.json>
 *
 * Reads the dev deployment named by NEXT_PUBLIC_CONVEX_URL in .env.local. Read-only.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

config({ path: resolve(__dirname, "..", "..", ".env.local"), quiet: true });
const out = process.argv[2];
const url = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!out || !url) { console.error("usage: export-convex-products.ts <out.json>  (needs NEXT_PUBLIC_CONVEX_URL)"); process.exit(1); }

async function main() {
    const client = new ConvexHttpClient(url!);
    const rows: Record<string, unknown>[] = [];
    let cursor: string | null = null;
    for (;;) {
        const page = await client.action(api.products.getProductExportPage, { cursor, numItems: 500 });
        rows.push(...page.page);
        if (page.isDone) break;
        cursor = page.continueCursor;
    }
    const deployment = new URL(url!).hostname.split(".")[0];
    writeFileSync(out!, JSON.stringify({ collectedAt: new Date().toISOString(), source: url, deployment: `dev:${deployment}`, rows }));
    console.log(`exported ${rows.length} rows from ${deployment} → ${out}`);
}
main().catch(error => { console.error(error); process.exit(1); });
