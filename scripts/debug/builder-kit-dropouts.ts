// Read-only: for every builder candidate that HAS a published kit, say whether
// the builder accepts it, and if not, which of configurationFromRow's checks
// turned it away. Mirrors those checks in order; keep in step with model.ts.
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { configurationFromRow, groupBuilderBodies, resolveBuilderConfigurations, isBuilderCandidate, type BuilderKit, type CatalogRow } from "../../src/lib/bottle-builder/model";

const convex = new ConvexHttpClient(process.env.PROBE_CONVEX_URL ?? "https://precise-raccoon-123.convex.cloud");
const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const isClosure = (slot: string) => ["cap", "overcap"].includes(slot);

function why(row: CatalogRow, kit: BuilderKit): string {
    if (kit.conflicts.length) return "kit has conflicting index rows";
    if (kit.sku !== row.websiteSku && kit.sku !== row.graceSku) return "kit sku is not this row's sku";
    const app = row.applicator?.trim();
    const capOnly = app === "Cap/Closure" || ((!app || app === "N/A") && /\bcap\b/i.test(row.itemName ?? ""));
    if (kit.completeness !== "full" && !(capOnly && kit.completeness === "capSplit")) return `completeness '${kit.completeness}' on a ${app ?? "?"} (needs 'full', or a full sibling to borrow from)`;
    const body = kit.parts.find(p => p.slot === "body");
    if (!body || !kit.parts.some(p => p.slot !== "body")) return "no body, or body only";
    if (!["psd-layer", "madison", "background-matte"].includes(body.derivation)) return `body derivation '${body.derivation}'`;
    const suffix = `-${slug(row.color!)}-${slug(row.neckThreadSize!)}`;
    if (!kit.familyId.endsWith(suffix) || !kit.familyId.includes(`-${row.capacityMl}ml-`)) return `familyId '${kit.familyId}' does not match catalogue ${row.capacityMl}ml${suffix}`;
    if (!app || app === "N/A") { if (!capOnly) return "no applicator on the catalogue row"; }
    const mechanism = kit.parts.filter(p => p.slot !== "body" && !isClosure(p.slot));
    if (!capOnly && mechanism.length === 0) return `a ${app} kit with no mechanism part (slots: ${kit.parts.map(p => p.slot).join("+")})`;
    return "other (anchors, canvas or url check)";
}

async function main() {
    const families = process.argv.slice(2).length ? process.argv.slice(2) : ["Flair", "Rectangle", "Royal", "Diamond", "Sleek", "Square", "Tulip"];
    for (const family of families) {
        const data = await convex.query(api.matrix.getFamilyRows, { family });
        const candidates = data.rows.filter(isBuilderCandidate);
        const kits: (BuilderKit | null)[] = [];
        for (let i = 0; i < candidates.length; i += 24) kits.push(...await Promise.all(candidates.slice(i, i + 24).map(row =>
            convex.query(api.productKits.forSku, { websiteSku: row.websiteSku!, graceSku: row.graceSku! }))));
        const reasons = new Map<string, string[]>();
        let accepted = 0;
        candidates.forEach((row, i) => {
            const kit = kits[i]; if (!kit) return;
            if (configurationFromRow(row, kit)) { accepted++; return; }
            const r = why(row, kit); reasons.set(r, [...(reasons.get(r) ?? []), row.websiteSku!]);
        });
        const resolved = resolveBuilderConfigurations(candidates, kits, []).filter((c): c is NonNullable<typeof c> => c !== null);
        const grouped = groupBuilderBodies(resolved).reduce((n, b) => n + b.configurations.length, 0);
        console.log(`\n${family}: ${kits.filter(Boolean).length} published kits · ${accepted} accepted on their own · ${resolved.filter(c => c.kit).length} after borrowing · ${grouped} survive grouping`);
        for (const [r, skus] of [...reasons].sort((a, b) => b[1].length - a[1].length)) console.log(`   ${String(skus.length).padStart(3)}  ${r}\n        e.g. ${skus.slice(0, 3).join(", ")}`);
    }
}
main().catch(e => { console.error(e); process.exit(1); });
