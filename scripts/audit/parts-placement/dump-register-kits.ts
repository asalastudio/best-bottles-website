/** Read-only: the register kits the storefront draws for SKUs with no approved kit (loadRegisterKits, the same path the
 * product page and Build Your Bottle use), keyed by website SKU, for analyse.py and seated-dip-tubes.py.
 *   CONVEX_URL=<deployment> npx tsx --tsconfig scripts/audit/size-consistency/tsconfig.json \
 *     scripts/audit/parts-placement/dump-register-kits.ts <assemblies.jsonl> <out.json> [bodyId ...]
 * assemblies.jsonl: `npx convex data registerAssemblies --limit 10000 --format jsonLines` (read-only). */
import { readFileSync, writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { loadRegisterKits } from "../../../src/lib/register/load";

const [, , assembliesPath, out, ...bodies] = process.argv;
const url = process.env.CONVEX_URL;
if (!url || !assembliesPath || !out) throw new Error("usage: CONVEX_URL=... dump-register-kits.ts <assemblies.jsonl> <out.json> [bodyId ...]");
const wanted = new Set(bodies);
const rows = readFileSync(assembliesPath, "utf8").trim().split("\n").map(line => JSON.parse(line) as { graceSku: string; bodyId: string });
const graceSkus = rows.filter(row => !wanted.size || wanted.has(row.bodyId)).map(row => row.graceSku);
void (async () => {
    const kits = await loadRegisterKits(new ConvexHttpClient(url), graceSkus, { strict: true });
    const bySku = Object.fromEntries(Object.values(kits).map(kit => [kit.sku, kit]));
    writeFileSync(out, JSON.stringify({ rows: bySku }));
    console.log(`${graceSkus.length} assemblies, ${Object.keys(bySku).length} register kits`);
})();
