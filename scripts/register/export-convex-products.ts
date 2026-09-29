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
// Production's catalogue: NEXT_PUBLIC_CONVEX_URL=<PROD_URL> npx tsx scripts/register/export-convex-products.ts <out.json>
// (read-only; dotenv never overrides a variable already set). The register is built from production's rows since 2026-09-28.
const PROD_URL = "https://precise-raccoon-123.convex.cloud";
const out = process.argv[2];
const url = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!out || !url) { console.error("usage: export-convex-products.ts <out.json>  (needs NEXT_PUBLIC_CONVEX_URL)"); process.exit(1); }

async function main() {
    const client = new ConvexHttpClient(url!);
    const rows: Record<string, unknown>[] = [];
    let cursor: string | null = null;
    for (;;) {
        const page: { page: Record<string, unknown>[]; isDone: boolean; continueCursor: string } =
            await client.action(api.products.getProductExportPage, { cursor, numItems: 500 });
        rows.push(...page.page);
        if (page.isDone) break;
        cursor = page.continueCursor;
    }
    // The export action carries each row's productGroupId only; the register splits a body by its product pages
    // where they disagree (the Footed and Tall Rectangle 10 mL), so every row gets its page slug here.
    const groups = await client.query(api.products.getAllCatalogGroups, {}) as { _id: string; slug: string }[];
    const slugOf = new Map(groups.map((group) => [String(group._id), group.slug]));
    for (const row of rows) {
        const slug = row.productGroupId ? slugOf.get(String(row.productGroupId)) : undefined;
        if (slug && !row.productGroupSlug) row.productGroupSlug = slug;
    }
    const deployment = new URL(url!).hostname.split(".")[0];
    const kind = url === PROD_URL ? "prod" : "dev";
    writeFileSync(out!, JSON.stringify({ collectedAt: new Date().toISOString(), source: url, deployment: `${kind}:${deployment}`, rows }));
    console.log(`exported ${rows.length} rows from ${deployment} → ${out}`);
}
main().catch(error => { console.error(error); process.exit(1); });
