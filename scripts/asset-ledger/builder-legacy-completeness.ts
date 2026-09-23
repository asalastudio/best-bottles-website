/**
 * "Every bottle has all its components" measured against the legacy site.
 * A legacy product page lists its sibling assemblies down the side (the same
 * glass with every other closure). For each such cluster, count how many of
 * those assemblies the builder can offer as a configuration today.
 *
 *   npx tsx scripts/asset-ledger/builder-legacy-completeness.ts
 *
 * Reads data/asset-ledger/builder-funnel.json (configurationSkus) and
 * data/legacy/legacy-sibling-graph.json. Writes data/asset-ledger/builder-legacy-completeness.json.
 */
import { readFileSync, writeFileSync } from "node:fs";
const funnel = JSON.parse(readFileSync("data/asset-ledger/builder-funnel.json", "utf8"));
const offered = new Set<string>((funnel.report as any[]).flatMap(r => r.configurationSkus ?? []));
const graph = JSON.parse(readFileSync("data/legacy/legacy-sibling-graph.json", "utf8"));
const snapshot = new Map((JSON.parse(readFileSync("data/asset-ledger/builder-catalog-snapshot.json", "utf8")).rows as any[]).map(r => [r.sku, r]));
const dev = new Set((JSON.parse(readFileSync("data/asset-ledger/dev-products-dump.json", "utf8")) as any[]).map(p => p.websiteSku));
const drops: Record<string, string> = {};
for (const fam of Object.values(funnel.drops as Record<string, Record<string, string[]>>)) for (const [reason, skus] of Object.entries(fam)) for (const s of skus) drops[s] = reason;
const clusters: any[] = [];
for (const members of graph.clusters as string[][]) {
    const bottles = members.filter(s => /bottle|vial/i.test(snapshot.get(s)?.category ?? "") || !snapshot.has(s));
    if (bottles.length < 2) continue;
    const have = bottles.filter(s => offered.has(s));
    const reasons: Record<string, number> = {};
    for (const s of bottles) if (!offered.has(s)) { const r = !dev.has(s) ? "not on dev" : drops[s] ?? "not in a builder family"; reasons[r] = (reasons[r] ?? 0) + 1; }
    const head = snapshot.get(bottles.find(s => snapshot.has(s)) ?? "") ?? {};
    clusters.push({ body: `${head.family ?? "?"}|${head.capacityMl ?? "?"}|${head.color ?? "?"}|${head.neck ?? "?"}`, members: bottles.length, offered: have.length,
        complete: have.length === bottles.length, reasons, missing: bottles.filter(s => !offered.has(s)) });
}
clusters.sort((a, b) => (b.offered / b.members) - (a.offered / a.members) || b.members - a.members);
const totals = { clusters: clusters.length, complete: clusters.filter(c => c.complete).length, partial: clusters.filter(c => c.offered && !c.complete).length, none: clusters.filter(c => !c.offered).length,
    assemblies: clusters.reduce((n, c) => n + c.members, 0), offered: clusters.reduce((n, c) => n + c.offered, 0) };
const reasonTotals: Record<string, number> = {}; for (const c of clusters) for (const [r, n] of Object.entries(c.reasons)) reasonTotals[r] = (reasonTotals[r] ?? 0) + (n as number);
writeFileSync("data/asset-ledger/builder-legacy-completeness.json", JSON.stringify({ generatedAt: new Date().toISOString(), funnelGeneratedAt: funnel.generatedAt, totals, reasonTotals, clusters }, null, 1) + "\n");
console.log(totals); console.log("why assemblies are not offered:"); for (const [r, n] of Object.entries(reasonTotals).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${r}`);
console.log("\nclusters (offered/members):"); for (const c of clusters.slice(0, 40)) console.log(`  ${String(c.offered).padStart(3)}/${String(c.members).padEnd(3)} ${c.body}`);
