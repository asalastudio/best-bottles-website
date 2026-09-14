/**
 * Generate exact assembly→component joins for bottles whose finish label
 * cannot pick a component, from evidence only:
 *   - the bottle's own legacy bestbottles.com description (the closure phrase
 *     after "glass bottle"/"vial"), falling back to its catalogue name;
 *   - the catalogue names of the components the bottle already lists.
 * A join is emitted only when exactly one listed component of the right kind
 * carries every finish/colour word the bottle names. Nothing is inferred from
 * SKU strings, and no component is invented or made eligible.
 *
 *   npx tsx scripts/asset-ledger/build-exact-component-matches.ts
 *
 * Writes src/lib/bottle-builder/component-matches.generated.json and the
 * review file data/asset-ledger/exact-component-matches-2026-09-14.json.
 */
import { readFileSync, writeFileSync } from "node:fs";
const S = JSON.parse(readFileSync("data/asset-ledger/builder-catalog-snapshot.json", "utf8")).rows as any[];
const D = JSON.parse(readFileSync("data/asset-ledger/finish-component-diag.json", "utf8")).rows as any[];
const P = JSON.parse(readFileSync("data/asset-ledger/dev-products-dump.json", "utf8")) as any[];
const L = JSON.parse(readFileSync("data/legacy/legacy-catalog.json", "utf8")).rows as any[];
const bySku = new Map(S.map(r => [r.sku, r]));
const SRC = JSON.parse(readFileSync("src/lib/bottle-builder/source-component-links.json", "utf8"));
const sourceLinked = new Set(((Array.isArray(SRC) ? SRC : SRC.links ?? Object.values(SRC)) as any[]).map(l => l.assemblySku));
const PP = JSON.parse(readFileSync("data/asset-ledger/prod-products-dump.json", "utf8")) as any[];
const prodName = new Map(PP.filter(p => p.websiteSku).map(p => [p.websiteSku, p.itemName ?? ""]));
// dev twins of retired components carry generic names ("Sprayer Thread 18-415");
// the storefront (prod) name is the descriptive catalogue name for the same SKU.
const descriptive = (sku: string, name: string) => /gold|silver|black|white|copper|red|pink|blue|lavender|ivory|turquoise|brown|natural/i.test(name) ? name : (prodName.get(sku) ?? name);
const nameOf = new Map(P.filter(p => p.websiteSku).map(p => [p.websiteSku, descriptive(p.websiteSku, p.itemName ?? "")]));
for (const [sku, name] of prodName) if (!nameOf.has(sku)) nameOf.set(sku, name);
const legacy = new Map(L.map(r => [r.sku, (r.description ?? "").replace(/^Item Description:\s*/i, "")]));

const COLOURS = ["gold", "silver", "black", "white", "copper", "red", "pink", "blue", "lavender", "ivory", "turquoise", "brown", "natural"];
const norm = (s: string) => s.toLowerCase().replace(/\bmatt\b/g, "matte").replace(/\bgld\b/g, "gold").replace(/over the cap|over-cap|over cap/g, "overcap").replace(/\bwith dots\b|\bdotted\b/g, "dots").replace(/\btrim cap\b|\btrim\b|\bcollar cap\b|\bfittings\b/g, "collar");
function features(text: string) {
    const t = norm(text);
    const colours = new Set(COLOURS.filter(c => new RegExp(`\\b${c}\\b`).test(t)));
    const finish = /\bshiny\b/.test(t) ? "shiny" : /\bmatte\b/.test(t) ? "matte" : null;
    const mods = new Set(["tall", "short", "dots", "overcap", "collar", "tassel", "leather", "ribbed"].filter(m => new RegExp(`\\b${m}\\b`).test(t)));
    return { colours, finish, mods };
}
/** The closure phrase: what follows the bottle noun, up to the sentence end. */
function closurePhrase(text: string) {
    const m = text.match(/(?:glass\s+(?:bottle|vial)|\bbottle\b|\bvial\b)\s*(.*?)(?:\.\s|$)/i);
    return m ? m[1] : text;
}
const KIND_WORD: Record<string, RegExp> = { Dropper: /dropper/i, "Lotion Pump": /pump/i, Sprayer: /spray/i, "Roll-On Cap": /roll/i, Cap: /cap|lid|closure/i };

const out: Record<string, any> = {}; const review: any[] = []; const skipped: any[] = []; const listingGaps: any[] = [];
for (const d of D) {
    // rows the finish-label rule cannot decide: no listed component carries the
    // label, two components share it, or the listed cap SKUs miss the CP prefix
    if (!/no listed .* with finish|^unexplained$|do not match the Cap pattern/.test(d.reason)) { skipped.push({ sku: d.sku, why: d.reason }); continue; }
    const row = bySku.get(d.sku); if (!row) continue;
    if (sourceLinked.has(d.sku)) { skipped.push({ sku: d.sku, why: "already joined by a reviewed source-component link" }); continue; }
    const desc = legacy.get(d.sku) || row.itemName || "";
    const phrase = closurePhrase(desc);
    const want = features(phrase);
    if (!want.colours.size) { skipped.push({ sku: d.sku, why: "description names no closure colour", phrase }); continue; }
    const listed = ((row.components[d.kind] ?? []) as any[])
        .map(c => ({ sku: String(c.websiteSku).split("__RETIRED__")[0], retired: /__RETIRED__/.test(c.websiteSku) }))
        .filter(c => c.sku.includes(d.neck) && nameOf.has(c.sku));
    const scored = listed.map(c => ({ ...c, name: nameOf.get(c.sku)!, f: features(nameOf.get(c.sku)!) }))
        .filter(c => KIND_WORD[d.kind]?.test(c.name));
    // tall/short only count when the listed components actually differ on them
    const distinguishes = (m: string) => scored.some(c => c.f.mods.has(m)) && scored.some(c => !c.f.mods.has(m));
    const cands = scored.filter(c => {
        if ([...want.colours].some(x => !c.f.colours.has(x)) || [...c.f.colours].some(x => !want.colours.has(x))) return false;
        if (want.finish && c.f.finish && want.finish !== c.f.finish) return false;
        for (const m of ["dots", "overcap", "tassel", "leather"]) if (want.mods.has(m) !== c.f.mods.has(m)) return false;
        // a named collar/trim must be present; a component's plain collar mention alone never disqualifies
        if (d.kind === "Dropper" && want.mods.has("collar") && !c.f.mods.has("collar")) return false;
        for (const m of ["tall", "short"]) if (distinguishes(m) && want.mods.has(m) !== c.f.mods.has(m)) return false;
        return true;
    });
    const catalogue = [...nameOf].filter(([sku, name]) => sku.includes(d.neck) && KIND_WORD[d.kind]?.test(name) && !/__RETIRED__/.test(sku)
        && (P.some(p => p.websiteSku === sku && /component/i.test(p.category ?? "")) || PP.some(p => p.websiteSku === sku && /component/i.test(p.category ?? ""))))
        .map(([sku, name]) => ({ sku, name, f: features(name) }));
    const sameColour = (c: { f: ReturnType<typeof features> }) => [...want.colours].every(x => c.f.colours.has(x)) && [...c.f.colours].every(x => want.colours.has(x));
    // the bottle names a height or finish the fitting listed component does not: if
    // the catalogue holds a same-colour component that does name it, that one is
    // meant, and the bottle simply fails to list it
    const stated = ["short", "tall"].filter(m => want.mods.has(m));
    const better = catalogue.filter(c => sameColour(c) && !cands.some(x => x.sku === c.sku)
        && (stated.some(m => c.f.mods.has(m) && !cands.every(x => x.f.mods.has(m))) || (want.finish && c.f.finish === want.finish && cands.length > 0 && cands.every(x => !x.f.finish))));
    if (cands.length === 1 && better.length) { cands.length = 0; }
    if (cands.length === 0) {
        const pool = [...nameOf].filter(([sku, name]) => sku.includes(d.neck) && KIND_WORD[d.kind]?.test(name) && !/__RETIRED__/.test(sku)
            && (P.some(p => p.websiteSku === sku && /component/i.test(p.category ?? "")) || PP.some(p => p.websiteSku === sku && /component/i.test(p.category ?? ""))))
            .map(([sku, name]) => ({ sku, name, f: features(name) }))
            .filter(c => [...want.colours].every(x => c.f.colours.has(x)) && [...c.f.colours].every(x => want.colours.has(x))
                && !(want.finish && c.f.finish && want.finish !== c.f.finish)
                && ["dots", "overcap", "tassel", "leather"].every(m => want.mods.has(m) === c.f.mods.has(m))
                && (d.kind !== "Dropper" || !want.mods.has("collar") || c.f.mods.has("collar"))
                // outside a listed set there is no sibling context: a tall/short
                // component only fits a bottle that names the same height
                && ["tall", "short"].every(m => want.mods.has(m) === c.f.mods.has(m)));
        if (pool.length === 1) listingGaps.push({ sku: d.sku, kind: d.kind, neck: d.neck, componentSku: pool[0].sku, onDev: P.some(p => p.websiteSku === pool[0].sku), evidence: `bottle: "${phrase.trim()}"; component ${pool[0].sku}: "${pool[0].name}" exists but is not listed on the bottle` });
    }
    if (cands.length !== 1) { skipped.push({ sku: d.sku, why: cands.length ? "more than one listed component fits" : "no listed component carries the named finish", phrase, candidates: cands.map(c => c.sku), listed: scored.map(c => c.sku) }); continue; }
    const c = cands[0];
    const entry = { family: row.family, capacityMl: row.capacityMl, color: row.color, neck: row.neck, applicator: row.applicator ?? null, componentSku: c.sku,
        evidence: `bottle: "${phrase.trim()}" (${legacy.has(d.sku) ? "legacy description" : "catalogue name"}); component ${c.sku}: "${c.name}"` };
    out[d.sku] = entry; review.push({ sku: d.sku, ...entry, listedRetired: c.retired });
}
const bodyOf = (sku: string) => { const r = bySku.get(sku); return `${r.family}|${r.capacityMl}|${r.color}|${r.neck}`; };
for (const list of [review, listingGaps]) {
    const seen = new Map<string, string[]>();
    for (const j of list) { const k = `${bodyOf(j.sku)}#${j.componentSku}`; seen.set(k, [...(seen.get(k) ?? []), j.sku]); }
    for (const [k, skus] of seen) if (skus.length > 1) {
        for (const sku of skus) { delete out[sku]; skipped.push({ sku, why: `duplicate pick: ${skus.length} rows of one body resolve to ${k.split("#")[1]}`, siblings: skus }); }
        for (let i = list.length - 1; i >= 0; i--) if (skus.includes(list[i].sku)) list.splice(i, 1);
    }
}
const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync("src/lib/bottle-builder/component-matches.generated.json", JSON.stringify(sorted, null, 1) + "\n");
writeFileSync("data/asset-ledger/exact-component-matches-2026-09-14.json", JSON.stringify({ generatedAt: new Date().toISOString(), method: "legacy description closure phrase ∩ listed component catalogue names; unique fit only", joins: review, listingGaps, skipped }, null, 1) + "\n");
console.log(`joins ${review.length} | listing gaps ${listingGaps.length} | skipped ${skipped.length}`);
const lg: Record<string, number> = {}; for (const g of listingGaps) lg[`${g.componentSku}${g.onDev ? "" : " (prod only)"}`] = (lg[`${g.componentSku}${g.onDev ? "" : " (prod only)"}`] ?? 0) + 1; console.log("listing gaps by component:", lg);
const byKind: Record<string, number> = {}; for (const r of review) byKind[(D.find(d => d.sku === r.sku)?.kind)] = (byKind[(D.find(d => d.sku === r.sku)?.kind)] ?? 0) + 1; console.log("joins by kind:", byKind);
const why: Record<string, number> = {}; for (const s of skipped) why[s.why] = (why[s.why] ?? 0) + 1; console.log("skipped why:", why);
console.log("\nsample joins:"); for (const r of review.slice(0, 6)) console.log(`  ${r.sku} -> ${r.componentSku}\n     ${r.evidence}`);
console.log("\nunique-fit failures (first 25):"); for (const s of skipped.filter(x => /listed component/.test(x.why)).slice(0, 25)) console.log(`  ${s.sku.padEnd(30)} ${s.why.padEnd(48)} "${(s.phrase ?? "").slice(0, 60)}" cands=${(s.candidates ?? []).join("/")}`);
