/** Cross-check: every family × capacity × colour × neck the catalogue sells vs
 *  what the builder can show (plates, bare body, offered configurations). Read-only. */
import { readFileSync, writeFileSync } from "node:fs";
const rows = JSON.parse(readFileSync("data/asset-ledger/builder-catalog-snapshot.json", "utf8")).rows as any[];
const ledger = JSON.parse(readFileSync("src/lib/asset-ledger/ledger.json", "utf8")).platePlan.rows as any[];
const bodies = JSON.parse(readFileSync("src/lib/bottle-builder/bodies.generated.json", "utf8"));
const funnel = JSON.parse(readFileSync("data/asset-ledger/builder-funnel.json", "utf8"));
const offered = new Set<string>((funnel.report as any[]).flatMap(r => r.configurationSkus ?? []));
const stage = new Map(ledger.map(r => [r.sku, r.stage]));
const keys = new Map<string, any>();
for (const r of rows) {
    if (!/bottle|vial/i.test(r.category ?? "") || !r.neck || !r.capacityMl || /__RETIRED__/.test(r.sku)) continue;
    const slug = r.productGroupSlug ?? ""; const marker = `-${r.capacityMl}ml-`; const profile = slug.includes(marker) ? slug.split(marker)[0] : null;
    const k = `${r.family}|${r.capacityMl}|${r.color}|${r.neck}`;
    const e = keys.get(k) ?? { family: r.family, capacityMl: r.capacityMl, color: r.color, neck: r.neck, profiles: new Set<string>(), rows: 0, sellable: 0, plates: 0, offered: 0, skus: [] as string[] };
    e.rows++; if (r.shopifyVariantId && r.shopifySellable !== false && !/out of stock|discontinued/i.test(r.stockStatus ?? "")) e.sellable++;
    if (stage.get(r.sku) === "complete") e.plates++; if (offered.has(r.sku)) e.offered++; if (profile) e.profiles.add(profile); e.skus.push(r.sku);
    keys.set(k, e);
}
const out = [...keys.values()].map(e => ({ ...e, profiles: [...e.profiles], body: Boolean(bodies[`${e.family}|${e.capacityMl}|${e.color}|${e.neck}`] || [...e.profiles].some((p: string) => bodies[`${p}|${e.capacityMl}|${e.color}|${e.neck}`])) }))
    .sort((a, b) => a.family.localeCompare(b.family) || a.capacityMl - b.capacityMl || a.color.localeCompare(b.color));
writeFileSync("data/asset-ledger/builder-body-coverage.json", JSON.stringify({ generatedAt: new Date().toISOString(), keys: out }, null, 1));
const fam = process.argv[2];
console.log("family            cap  colour        neck     rows sell plates body offered");
for (const e of out) if (!fam || e.family === fam) console.log(`${e.family.padEnd(17)} ${String(e.capacityMl).padStart(4)}  ${e.color.padEnd(13)} ${e.neck.padEnd(8)} ${String(e.rows).padStart(4)} ${String(e.sellable).padStart(4)} ${String(e.plates).padStart(6)}  ${e.body ? "yes " : "NO  "} ${String(e.offered).padStart(4)}${e.profiles.length > 1 ? "  profiles: " + e.profiles.join(",") : ""}`);
const gaps = out.filter(e => e.sellable > 0 && (!e.body || e.offered === 0));
console.log(`\n${gaps.length} sellable body keys the builder cannot show; by family:`);
const byFam: Record<string, string[]> = {}; for (const g of gaps) (byFam[g.family] ??= []).push(`${g.capacityMl} ${g.color} ${g.neck} (${g.sellable} sellable, ${g.plates} plates${g.body ? ", body" : ", no body"})`);
for (const [f, l] of Object.entries(byFam)) console.log(`  ${f}: ${l.join(" · ")}`);
