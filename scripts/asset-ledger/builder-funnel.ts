/**
 * Build Your Bottle funnel audit.
 *
 * Runs the builder's own eligibility logic against every matrix family, with
 * the real kit query, and records exactly where each catalog row drops out:
 *
 *   matrix row -> builder candidate (gate) -> kit -> configuration -> body
 *
 * The output is the ground truth for "which bottles can the builder offer and
 * why not the rest". Read-only: nothing is written to Convex.
 *
 *   npx tsx scripts/asset-ledger/builder-funnel.ts
 *
 * Writes data/asset-ledger/builder-funnel.json.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import {
    isBuilderCandidate, configurationFromRow, catalogConfigurationFromRow, resolveBuilderConfigurations,
    groupBuilderBodies, compatibleFinishComponent, reviewedBodyImage, type CatalogRow, type BuilderKit,
} from "../../src/lib/bottle-builder/model";
import { resolveListedComponents } from "../../src/lib/bottle-builder/components";

const root = process.cwd();
if (!process.env.NEXT_PUBLIC_CONVEX_URL && existsSync(path.join(root, ".env.local"))) {
    for (const line of readFileSync(path.join(root, ".env.local"), "utf8").split("\n")) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
}
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function gateReason(row: CatalogRow): string | null {
    if (row.resolution === "unknown") return "compatibility unresolved (no listed components)";
    if (/__RETIRED__/i.test(row.websiteSku ?? "")) return "retired duplicate";
    if (!compatibleFinishComponent(row)) return "no compatible finish component";
    if (!(row.graceSku && row.websiteSku && row.itemName && row.family && row.color && row.neckThreadSize)) return "identity fields missing";
    if (!/bottle|vial/i.test(row.category ?? "")) return "not a bottle row";
    if (!(row.capacityMl && row.capacityMl > 0)) return "no capacity";
    if (!row.shopifyVariantId) return "no Shopify variant";
    if (row.shopifySellable === false) return "Shopify unsellable";
    if (/out of stock|discontinued|unavailable/i.test(row.stockStatus ?? "")) return "out of stock";
    if (!(typeof row.webPrice1pc === "number" && Number.isFinite(row.webPrice1pc) && row.webPrice1pc > 0)) return "no price";
    return null;
}

function kitReason(row: CatalogRow, kit: BuilderKit | null): string | null {
    if (!kit) return "no kit indexed";
    if (kit.conflicts.length) return "kit has conflicts";
    if (kit.sku !== row.websiteSku && kit.sku !== row.graceSku) return "kit identity mismatch";
    const app = row.applicator?.trim();
    const capOnly = app === "Cap/Closure" || ((!app || app === "N/A") && /\bcap\b/i.test(row.itemName ?? ""));
    if (kit.completeness !== "full" && !(capOnly && kit.completeness === "capSplit")) return `kit completeness ${kit.completeness}`;
    const body = kit.parts.find(p => p.slot === "body");
    if (!body) return "kit has no body part";
    if (!kit.parts.some(p => p.slot !== "body")) return "kit has only a body";
    if (body.derivation !== "psd-layer" && body.derivation !== "madison") return `body derivation ${body.derivation}`;
    const suffix = `-${String(row.color).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${String(row.neckThreadSize).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    if (!kit.familyId.endsWith(suffix) || !kit.familyId.includes(`-${row.capacityMl}ml-`)) return "kit familyId disagrees with row";
    if (row.family === "Cylinder" && row.capacityMl === 5.5) return "Cylinder 5.5 ml excluded by rule";
    return null;
}

async function main() {
    const families = (await convex.query(api.matrix.listFamilies, {})).map((f: { family: string }) => f.family);
    const report: Record<string, unknown>[] = [];
    const drops: Record<string, Record<string, string[]>> = {};
    let i = 0;
    await Promise.all(Array.from({ length: 4 }, async () => {
        while (i < families.length) {
            const family = families[i++];
            const data = await convex.query(api.matrix.getFamilyRows, { family });
            const rows: CatalogRow[] = data.rows;
            const activeCache = new Map<string, unknown>();
            const resolved = await resolveListedComponents(rows, async (sku: string) => {
                if (!activeCache.has(sku)) activeCache.set(sku, (await convex.query(api.products.lookupSku, { sku }))?.product ?? null);
                return activeCache.get(sku) as never;
            });
            const gate = resolved.map(gateReason);
            const candidates = resolved.filter((_, k) => gate[k] === null);
            const kits: (BuilderKit | null)[] = new Array(candidates.length).fill(null);
            let j = 0;
            await Promise.all(Array.from({ length: 12 }, async () => {
                while (j < candidates.length) { const k = j++; const r = candidates[k];
                    kits[k] = await convex.query(api.productKits.forSku, { websiteSku: r.websiteSku!, graceSku: r.graceSku! }); }
            }));
            const plateUrls = new Array<string | null>(candidates.length).fill(null);
            for (let start = 0; start < candidates.length; start += 200) {
                const slice = candidates.slice(start, start + 200);
                const { plates } = await convex.query(api.productPlates.forSkus, { skus: slice.map(r => r.websiteSku!) });
                slice.forEach((r, i) => { plateUrls[start + i] = plates[r.websiteSku!]?.image ?? null; });
            }
            const configs = resolveBuilderConfigurations(candidates, kits, plateUrls);
            const bodies = groupBuilderBodies(configs.filter((c): c is NonNullable<typeof c> => c !== null));
            const fam: Record<string, string[]> = {};
            const bump = (reason: string, sku: string) => (fam[reason] ??= []).push(sku);
            resolved.forEach((r, k) => { if (gate[k]) bump(`gate: ${gate[k]}`, r.websiteSku ?? "?"); });
            candidates.forEach((r, k) => {
                if (configs[k]) return;
                const kr = kitReason(r, kits[k]);
                const fallback = !kits[k] ? (reviewedBodyImage(r) ? (plateUrls[k] ? "reviewed body + plate present; row refused" : "has reviewed body image but no plate") : (plateUrls[k] ? "plate present but no reviewed body image" : "no reviewed body image and no plate")) : null;
                bump(`no configuration: ${kr ?? "configurationFromRow refused"}${fallback ? ` (${fallback})` : ""}`, r.websiteSku ?? "?");
            });
            drops[family] = fam;
            const withKit = kits.filter(Boolean).length;
            report.push({ family, rows: rows.length, gateEligible: candidates.length, kitsFound: withKit,
                configurations: configs.filter(Boolean).length, bodies: bodies.length,
                configurationSkus: configs.filter((c): c is NonNullable<typeof c> => c !== null).map(c => c.id),
                bodyIds: bodies.map(b => `${b.profileLabel} ${b.capacityMl}ml ${b.neck} (${b.configurations.length})`) });
        }
    }));
    report.sort((a, b) => (b.bodies as number) - (a.bodies as number) || (b.rows as number) - (a.rows as number));
    writeFileSync(path.join(root, "data/asset-ledger/builder-funnel.json"),
        JSON.stringify({ generatedAt: new Date().toISOString(), deployment: process.env.NEXT_PUBLIC_CONVEX_URL, report, drops }, null, 1));
    console.log(`${"family".padEnd(18)}${"rows".padStart(6)}${"gate".padStart(6)}${"kits".padStart(6)}${"cfgs".padStart(6)}${"bodies".padStart(8)}`);
    for (const r of report) console.log(`${String(r.family).padEnd(18)}${String(r.rows).padStart(6)}${String(r.gateEligible).padStart(6)}${String(r.kitsFound).padStart(6)}${String(r.configurations).padStart(6)}${String(r.bodies).padStart(8)}`);
    const all: Record<string, number> = {};
    for (const fam of Object.values(drops)) for (const [reason, skus] of Object.entries(fam)) all[reason] = (all[reason] ?? 0) + skus.length;
    console.log("\nDROP REASONS (all families):");
    for (const [reason, n] of Object.entries(all).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${reason}`);
}
main().catch(e => { console.error(e); process.exit(1); });
