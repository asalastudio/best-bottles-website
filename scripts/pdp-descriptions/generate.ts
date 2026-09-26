/**
 * Generate the PDP item descriptions, one per SKU, from three sources:
 *   - data/descriptions/pdp/catalog-facts.json   (Convex export: fields per SKU)
 *   - data/legacy/legacy-catalog.json             (legacy bestbottles.com page text + URL)
 *   - docs/reviews/audit-2026-08-06/live-site-full-scrape.json (legacy "Item type" per SKU)
 *
 * The prose itself comes from src/lib/products/item-description/compose.ts,
 * the same module the product page uses at request time for SKUs this file
 * does not cover, so the two never disagree on voice.
 *
 *   npx tsx scripts/pdp-descriptions/generate.ts            # writes the JSON + report
 *   npx tsx scripts/pdp-descriptions/generate.ts --sku GBCylBlu9MtlRollBlkDot
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { composeItemDescription, type ComposeInput, type FamilyProfile } from "@/lib/products/item-description/compose";
import { resolveItemType } from "@/lib/products/item-description/item-type";
import { parseLegacyDescription } from "@/lib/products/item-description/legacy-facts";

const root = process.cwd();
const read = (path: string) => JSON.parse(readFileSync(resolve(root, path), "utf8"));

type FactRow = {
    websiteSku: string; graceSku: string; groupSlug: string; category: string; family: string | null; color: string | null;
    capacity: string | null; capacityMl: number | null; capacityOz: number | null; applicator: string | null; ballMaterial: string | null;
    capColor: string | null; capStyle: string | null; capHeight: string | null; trimColor: string | null;
    neckThreadSize: string | null; heightWithCap: string | null; heightWithoutCap: string | null; diameter: string | null;
    bottleWeightG: number | null; caseQuantity: number | null; webPrice1pc: number | null; itemName: string; itemDescription: string | null;
    productUrl: string | null;
};
type GroupRow = { slug: string; family: string; category: string; capacityMl: number | null; neckThreadSize: string | null };

const facts = read("data/descriptions/pdp/catalog-facts.json") as { exportedAt: string; deployment: string; groups: GroupRow[]; products: FactRow[] };
const legacyRows = (read("data/legacy/legacy-catalog.json") as { rows: Array<{ sku: string | null; url: string; description: string | null; status: string }> }).rows;
const live = read("docs/reviews/audit-2026-08-06/live-site-full-scrape.json") as Array<{ siteSku: string | null; itemType: string | null }>;
const aliases = (read("data/legacy/legacy-aliases.json") as { aliases: Record<string, { prodSku: string }> }).aliases;

const legacyBySku = new Map<string, { url: string; description: string | null }>();
for (const row of legacyRows) {
    if (!row.sku || row.status !== "ok") continue;
    legacyBySku.set(row.sku, { url: row.url, description: row.description });
}
for (const [legacySku, alias] of Object.entries(aliases)) {
    const row = legacyBySku.get(legacySku);
    if (row && !legacyBySku.has(alias.prodSku)) legacyBySku.set(alias.prodSku, row);
}
const itemTypeBySku = new Map<string, string>();
for (const row of live) if (row.siteSku && row.itemType) itemTypeBySku.set(row.siteSku, row.itemType);

// ── family profiles ────────────────────────────────────────────────────────
const BOTTLE_CATEGORIES = new Set(["Glass Bottle", "Plastic Bottle", "Aluminum Bottle", "Glass Jar", "Metal Atomizer"]);
const capacitiesByFamily = new Map<string, Set<number>>();
for (const g of facts.groups) {
    if (!BOTTLE_CATEGORIES.has(g.category) || !g.capacityMl) continue;
    const key = `${g.family}|${g.category}`;
    if (!capacitiesByFamily.has(key)) capacitiesByFamily.set(key, new Set());
    capacitiesByFamily.get(key)!.add(g.capacityMl);
}
const fitmentsByNeck = new Map<string, Set<string>>();
const rollerPricesByGroup = new Map<string, { metal: number | null; plastic: number | null }>();
for (const p of facts.products) {
    if (!BOTTLE_CATEGORIES.has(p.category)) continue;
    const key = `${p.family}|${p.capacityMl}|${p.neckThreadSize}`;
    if (p.applicator && !["Cap/Closure", "N/A"].includes(p.applicator)) {
        if (!fitmentsByNeck.has(key)) fitmentsByNeck.set(key, new Set());
        fitmentsByNeck.get(key)!.add(p.applicator);
    }
    if (p.applicator === "Metal Roller Ball" || p.applicator === "Plastic Roller Ball") {
        const entry = rollerPricesByGroup.get(p.groupSlug) ?? { metal: null, plastic: null };
        const slot = p.applicator === "Metal Roller Ball" ? "metal" : "plastic";
        if (p.webPrice1pc != null) entry[slot] = entry[slot] == null ? p.webPrice1pc : Math.min(entry[slot]!, p.webPrice1pc);
        rollerPricesByGroup.set(p.groupSlug, entry);
    }
}
function profileFor(p: FactRow): FamilyProfile {
    const caps = Array.from(capacitiesByFamily.get(`${p.family}|${p.category}`) ?? []).sort((a, b) => a - b);
    const fitments = Array.from(fitmentsByNeck.get(`${p.family}|${p.capacityMl}|${p.neckThreadSize}`) ?? []);
    const prices = rollerPricesByGroup.get(p.groupSlug);
    const plasticCheaperThanMetal = prices && prices.metal != null && prices.plastic != null ? prices.plastic < prices.metal : null;
    return { capacitiesMl: caps, fitmentsAtNeck: fitments, plasticCheaperThanMetal };
}
const familyProfiles: Record<string, FamilyProfile> = {};

function describes(text: string | null): boolean {
    return Boolean(text && !/^\s*Item\s+(?:Name|Capacity)\s*:/i.test(text));
}
function pickRicher(a: string | null, b: string | null): string | null {
    if (describes(a) && !describes(b)) return a;
    if (describes(b) && !describes(a)) return b;
    return (a?.length ?? 0) >= (b?.length ?? 0) ? a : b;
}

// ── generate ───────────────────────────────────────────────────────────────
const only = process.argv.includes("--sku") ? process.argv[process.argv.indexOf("--sku") + 1] : null;
type Entry = { websiteSku: string; graceSku: string; groupSlug: string; family: string | null; applicator: string | null; itemType: string; description: string; words: number; sources: string[]; legacyUrl: string | null; legacyTruncated: boolean };
const entries: Record<string, Entry> = {};
const graceToWebsite: Record<string, string> = {};
const stats = { total: 0, described: 0, noLegacy: 0, legacyTruncated: 0, fallbackItemType: 0, byFamily: {} as Record<string, number>, words: [] as number[] };

for (const p of facts.products) {
    if (only && p.websiteSku !== only) continue;
    stats.total += 1;
    const legacy = legacyBySku.get(p.websiteSku) ?? null;
    // Some legacy pages carried only an "Item Name:" line; the Convex import kept the fuller text.
    const legacyDescription = pickRicher(legacy?.description ?? null, p.itemDescription ?? null);
    if (!legacy) stats.noLegacy += 1;
    const parsed = parseLegacyDescription(legacyDescription);
    if (parsed?.truncated) stats.legacyTruncated += 1;
    const profile = profileFor(p);
    familyProfiles[`${p.family}|${p.category}|${p.capacityMl}|${p.neckThreadSize}|${p.groupSlug}`] = profile;
    const input: ComposeInput = {
        websiteSku: p.websiteSku, graceSku: p.graceSku, family: p.family, category: p.category,
        capacity: p.capacity, capacityMl: p.capacityMl, capacityOz: p.capacityOz, color: p.color,
        applicator: p.applicator, ballMaterial: p.ballMaterial, capColor: p.capColor, capStyle: p.capStyle, capHeight: p.capHeight, trimColor: p.trimColor,
        itemName: p.itemName, neckThreadSize: p.neckThreadSize, heightWithCap: p.heightWithCap, heightWithoutCap: p.heightWithoutCap, diameter: p.diameter,
        bottleWeightG: p.bottleWeightG, caseQuantity: p.caseQuantity, legacyDescription, familyProfile: profile,
    };
    const composed = composeItemDescription(input);
    if (!composed) continue;
    const legacyItemType = itemTypeBySku.get(p.websiteSku) ?? null;
    if (!legacyItemType) stats.fallbackItemType += 1;
    const itemType = resolveItemType({ category: p.category, family: p.family, applicator: p.applicator, legacyItemType });
    entries[p.websiteSku] = {
        websiteSku: p.websiteSku, graceSku: p.graceSku, groupSlug: p.groupSlug, family: p.family, applicator: p.applicator,
        itemType, description: composed.text, words: composed.words, sources: composed.sources,
        legacyUrl: legacy?.url ?? null, legacyTruncated: Boolean(parsed?.truncated),
    };
    if (p.graceSku) graceToWebsite[p.graceSku] = p.websiteSku;
    stats.described += 1;
    stats.byFamily[p.family ?? "(none)"] = (stats.byFamily[p.family ?? "(none)"] ?? 0) + 1;
    stats.words.push(composed.words);
    if (only) console.log(JSON.stringify({ input, composed, itemType }, null, 2));
}

if (!only) {
    const out = { generatedAt: new Date().toISOString(), deployment: facts.deployment, exportedAt: facts.exportedAt, count: stats.described, byWebsiteSku: entries, graceToWebsite };
    writeFileSync(resolve(root, "data/descriptions/pdp/item-descriptions.json"), JSON.stringify(out, null, 1));
    // Family profiles keyed the way the runtime resolver looks them up.
    const profilesOut: Record<string, FamilyProfile> = {};
    for (const [key, profile] of Object.entries(familyProfiles)) {
        const [family, category, capacityMl, neck] = key.split("|");
        profilesOut[`${family}|${category}|${capacityMl}|${neck}`] = profile;
    }
    writeFileSync(resolve(root, "data/descriptions/pdp/family-profiles.json"), JSON.stringify({ generatedAt: out.generatedAt, profiles: profilesOut }, null, 1));
    const words = stats.words.sort((a, b) => a - b);
    const pct = (q: number) => words[Math.min(words.length - 1, Math.floor(words.length * q))];
    const lines = [
        `# PDP item descriptions report`, ``, `Generated ${out.generatedAt} from ${facts.deployment} (export ${facts.exportedAt}).`, ``,
        `- SKUs seen: ${stats.total}`, `- Described: ${stats.described}`, `- Without a legacy page: ${stats.noLegacy}`, `- Legacy text truncated by the old site: ${stats.legacyTruncated}`,
        `- Item type from a fallback (no legacy category): ${stats.fallbackItemType}`, `- Words: min ${words[0]}, p50 ${pct(0.5)}, p90 ${pct(0.9)}, max ${words[words.length - 1]}`, ``,
        `## By family`, ``, ...Object.entries(stats.byFamily).sort((a, b) => b[1] - a[1]).map(([f, n]) => `- ${f}: ${n}`), ``,
        `## One sample per family and fitment`, ``,
    ];
    const seen = new Set<string>();
    for (const e of Object.values(entries)) {
        const key = `${e.family}|${e.applicator}`;
        if (seen.has(key)) continue;
        seen.add(key);
        lines.push(`### ${e.family} · ${e.applicator ?? "cap only"} · ${e.websiteSku}`, ``, `Item type: ${e.itemType}`, ``, e.description, ``);
    }
    writeFileSync(resolve(root, "data/descriptions/pdp/report.md"), lines.join("\n"));
    console.log(`described ${stats.described}/${stats.total}; no legacy ${stats.noLegacy}; truncated ${stats.legacyTruncated}; words p50 ${pct(0.5)} p90 ${pct(0.9)} max ${words[words.length - 1]}`);
}
