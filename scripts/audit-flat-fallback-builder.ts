/** Read-only join of the PDP flat-image queue to Build Your Bottle eligibility.
 * npx tsx scripts/audit-flat-fallback-builder.ts --url PUBLIC_CONVEX_URL --out /tmp/flat-builder.csv
 * Missing source evidence is reported; this script never makes a SKU eligible.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { resolveListedComponents } from "../src/lib/bottle-builder/components";
import { isBuilderCandidate, reviewedBodyImage } from "../src/lib/bottle-builder/model";

async function main() {
const arg = (name: string) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1]; };
const url = arg("--url") ?? process.env.NEXT_PUBLIC_CONVEX_URL;
if (!url) throw Error("Pass --url with the public Convex endpoint");
const out = arg("--out") ?? "/tmp/best-bottles-flat-builder.csv";
const source = arg("--csv") ?? "docs/audits/pdp-layer-coverage-2026-09-26/flat-image-fallbacks.csv";
const lines = readFileSync(source, "utf8").trim().split(/\r?\n/);
const headers = lines.shift()!.split(",");
const values = (line: string) => [...line.matchAll(/"((?:[^"]|"")*)"|([^,]+)/g)]
    .map(match => (match[1] ?? match[2] ?? "").replaceAll('""', '"'));
const queue = lines.map(line => Object.fromEntries(headers.map((key, index) => [key, values(line)[index] ?? ""])));
const rowSku = (row: Record<string, string>) => row.websiteSku || row.graceSku;
const targetSkus = new Set(queue.map(rowSku).filter(Boolean));
const convex = new ConvexHttpClient(url);
let cursor: string | null = null;
const products: Array<{ websiteSku?: string | null; graceSku?: string | null }> = [];
do {
    const page: { page: typeof products; isDone: boolean; continueCursor: string } =
        await convex.action(api.products.getProductExportPage, { cursor, numItems: 500 });
    products.push(...page.page);
    if (page.isDone) break;
    if (page.continueCursor === cursor) throw Error("Product pagination stalled");
    cursor = page.continueCursor;
} while (true);
const bySku = new Map<string, typeof products>();
for (const product of products) for (const sku of new Set([product.websiteSku, product.graceSku])) {
    if (sku) bySku.set(sku, [...(bySku.get(sku) ?? []), product]);
}
const findings = new Map<string, { candidate: boolean; reviewedBody: boolean; reason: string }>();
for (const family of [...new Set(queue.map(row => row.family))].filter(Boolean)) {
    const data = await convex.query(api.matrix.getFamilyRows, { family });
    if (data.truncated) throw Error(`Matrix truncated: ${family}`);
    const raw = data.rows.filter(row => targetSkus.has(row.websiteSku || row.graceSku || ""));
    const rows = await resolveListedComponents(raw, async sku => {
        const found = bySku.get(sku) ?? [];
        return found.length === 1 ? found[0] as never : null;
    });
    for (const row of rows) findings.set(row.websiteSku || row.graceSku || "", {
        candidate: isBuilderCandidate(row),
        reviewedBody: Boolean(reviewedBodyImage(row)),
        reason: row.resolution,
    });
}
const columns = ["graceSku", "websiteSku", "category", "family", "builderCandidate", "matchingReviewedTransparentBody", "matrixResolution", "queueReason"];
const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
writeFileSync(out, columns.join(",") + "\n" + queue.map(row => {
    const finding = findings.get(rowSku(row));
    const values = [row.graceSku, row.websiteSku, row.category, row.family,
        finding?.candidate ?? false, finding?.reviewedBody ?? false, finding?.reason ?? "not in matrix", row.registerReason];
    return values.map(csv).join(",");
}).join("\n") + "\n");
console.log(JSON.stringify({ total: queue.length, matchedMatrix: findings.size,
    builderCandidates: [...findings.values()].filter(row => row.candidate).length,
    candidatesWithReviewedBody: [...findings.values()].filter(row => row.candidate && row.reviewedBody).length,
    out }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
