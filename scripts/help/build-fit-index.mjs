#!/usr/bin/env node
/**
 * Builds the help center's fit index from the committed component register
 * (data/register). Read-only: nothing here touches Convex, Shopify or the site.
 *
 *   node scripts/help/build-fit-index.mjs          # write src/lib/help/fit-index.generated.json
 *   node scripts/help/build-fit-index.mjs --check  # fail if the committed index is stale
 *
 * What each label means (shown to customers, so keep it exact):
 *   listed       — a sellable assembly on this body is register-`verified` and lists
 *                  the component; every listed part resolves on the same neck.
 *                  A catalog listing, NOT a physical test.
 *   sameThread   — a current, sellable component on the same neck finish that no
 *                  verified assembly of this body lists. Thread match only.
 *   conflicting  — the register quarantines the component on this neck, or a
 *                  quarantined assembly of this body lists it.
 * Bodies whose compatibility class is not a shared glass neck (plastic bottles,
 * atomizers, aluminium bottles, jars — Jordan's rulings in rules.json) get no
 * same-thread list: their parts are sold as sets.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const REGISTER = join(ROOT, "data", "register");
const OUT = join(ROOT, "src", "lib", "help", "fit-index.generated.json");

function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
            else if (ch === '"') quoted = false;
            else field += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ",") { row.push(field); field = ""; }
        else if (ch === "\n" || ch === "\r") {
            if (ch === "\r" && text[i + 1] === "\n") i += 1;
            row.push(field); field = "";
            if (row.length > 1 || row[0] !== "") rows.push(row);
            row = [];
        } else field += ch;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    const [header, ...body] = rows;
    return body.map((cells) => Object.fromEntries(header.map((key, i) => [key, cells[i] ?? ""])));
}

const read = (name) => parseCsv(readFileSync(join(REGISTER, name), "utf8"));
const list = (value) => value.split(";").map((part) => part.trim()).filter(Boolean);
const num = (value) => (value === "" || value == null ? null : Number(value));

const bodies = read("bodies.csv");
const components = read("components.csv");
const assemblies = read("assemblies.csv");
const rules = JSON.parse(readFileSync(join(REGISTER, "rules.json"), "utf8"));

const NOT_A_PART = new Set(["review", "cap-review"]);
// Reviewed duplicate listings (data/register/component-corrections.json) never reach customers: the listing they
// duplicate is shown instead.
const corrections = JSON.parse(readFileSync(join(REGISTER, "component-corrections.json"), "utf8")).corrections;
const duplicateSkus = new Set(Object.entries(corrections).filter(([, fix]) => fix.duplicateOf).map(([sku]) => sku));
const isDuplicate = (c) => duplicateSkus.has(c.websiteSku);
// Owner rulings: every current, sellable part on the neck fits every interchangeable bottle on it (13-415, Jordan
// 2026-11-07). Those pairs are fits, kept apart under teamConfirmed so the basis stays visible.
const pairExclusions = JSON.parse(readFileSync(join(REGISTER, "component-corrections.json"), "utf8")).pairExclusions?.pairs ?? [];
const neckRulings = Object.fromEntries(Object.entries(JSON.parse(readFileSync(join(REGISTER, "component-corrections.json"), "utf8")).neckRulings ?? {})
    .filter(([neck]) => !neck.startsWith("_")));

// The catalog's own name for a mould when it says more than the family does ("Tall cylinder design 9ml…" on a
// Cylinder body, "Footed rectangular design 10ml…" on a Rectangle body). Read from the committed export snapshot.
const exportRows = (() => {
    const raw = JSON.parse(gunzipSync(readFileSync(join(REGISTER, "source", rules.snapshot))).toString("utf8"));
    return Array.isArray(raw) ? raw : raw.products ?? raw.rows ?? [];
})();
const itemNameBySku = new Map(exportRows.map((r) => [r.websiteSku, r.itemName ?? ""]));
const GLASS_WORDS = new Set(["black", "white", "clear", "amber", "blue", "cobalt", "green", "red", "pink", "purple", "frosted", "gold", "silver", "glass"]);
const titleCase = (text) => text.toLowerCase().replace(/\b[a-z]/g, (ch) => ch.toUpperCase());
function catalogName(body) {
    const match = /^(.*?)\s+(?:design|shaped|style)\b/i.exec(itemNameBySku.get(body.representativeWebsiteSku) ?? "");
    if (!match) return null;
    // Colour and material words describe one finish, not the mould ("Black Atomizer", "Blue Glass Rectangular").
    const words = match[1].trim().split(/\s+/).filter((w) => !GLASS_WORDS.has(w.toLowerCase()));
    const stem = body.family.toLowerCase().slice(0, 6);
    return words.length > 1 && words[words.length - 1].toLowerCase().startsWith(stem) ? titleCase(words.join(" ")) : null;
}
const componentById = new Map(components.map((c) => [c.componentId, c]));
const sharedGlassNeck = (body) => body.compatibilityClass.startsWith("glass-") && body.neckStatus === "thread" && body.neck !== "";

// Some sellable products carry no applicator in the export (the Pillar 9 ml roll-ons: GBPillar9MtlRollBlkdot,
// GBPillar9RollBlkDot). Their own item codes still say what they are, so a verified assembly with no fitment type
// contributes the type its code names. This reads what the product is; it never infers a closure fit.
function fitmentFromSku(sku) {
    if (/MtlRoll/i.test(sku)) return "Metal Roller Ball";
    if (/Roll/i.test(sku)) return "Plastic Roller Ball";
    if (/Spry/i.test(sku)) return "Fine Mist Sprayer";
    return null;
}

const used = new Set();
const out = [];
for (const body of bodies) {
    if (body.status !== "current") continue;
    const own = assemblies.filter((a) => a.bodyId === body.bodyId && a.status !== "retired");
    const listed = new Set();
    const conflicting = new Map();
    for (const a of own) {
        if (a.status === "verified") for (const id of list(a.resolvedComponents)) if (!isDuplicate(componentById.get(id) ?? {})) listed.add(id);
        if (a.status === "quarantine") {
            for (const id of [...list(a.resolvedComponents), ...list(a.unresolvedComponents)]) {
                if (componentById.has(id)) conflicting.set(id, a.statusReason || "quarantined in the register");
            }
        }
    }
    const sameThread = [];
    const teamConfirmed = [];
    const ruled = sharedGlassNeck(body) && Boolean(neckRulings[body.neck]);
    if (sharedGlassNeck(body)) {
        for (const c of components) {
            if (c.neck !== body.neck || NOT_A_PART.has(c.type) || isDuplicate(c)) continue;
            if (c.status === "quarantine") { conflicting.set(c.componentId, c.typeEvidence ? `quarantined: ${c.typeEvidence}` : "quarantined in the register"); continue; }
            if (c.status !== "current" || c.sellable !== "True" || listed.has(c.componentId)) continue;
            if (ruled) { listed.add(c.componentId); teamConfirmed.push(c.componentId); } else sameThread.push(c.componentId);
        }
    }
    // Reviewed pair exclusions (component-corrections.json): listed by the catalog, doubted by a review.
    for (const pair of pairExclusions.filter((x) => x.bodyId === body.bodyId)) {
        for (const id of [...listed]) {
            if (pair.partTypes.includes(componentById.get(id)?.type)) { listed.delete(id); conflicting.set(id, pair.evidence); }
        }
    }
    for (const id of listed) conflicting.delete(id);
    const listedIds = [...listed].filter((id) => componentById.has(id)).sort();
    for (const id of [...listedIds, ...sameThread, ...conflicting.keys()]) used.add(id);
    out.push({
        id: body.bodyId,
        family: body.family,
        // The catalog's name for this mould when it differs from the family (Tall Cylinder, Footed Rectangular).
        name: catalogName(body),
        shape: body.shape,
        capacityMl: num(body.capacityMl),
        neck: body.neck || null,
        category: body.category,
        compatibilityClass: body.compatibilityClass,
        interchangeable: sharedGlassNeck(body),
        glass: list(body.glassVariants),
        fitmentTypes: [...new Set([
            ...list(body.fitmentTypes).filter((t) => t !== "N/A"),
            ...own.filter((a) => a.status === "verified" && (!a.fitmentType || a.fitmentType === "N/A"))
                .map((a) => fitmentFromSku(a.websiteSku)).filter(Boolean),
        ])].sort(),
        heightMm: num(body.dimsHeightBareMm || body.heightWithoutCapMm),
        diameterMm: num(body.dimsDiameterMm || body.diameterMm || body.widthMm),
        listed: listedIds,
        sameThread: sameThread.sort(),
        // Listed on the owner's ruling for this neck rather than by a catalog product (see neckRulings).
        teamConfirmed: teamConfirmed.sort(),
        // Sellable products on this body and the parts each is built from, so a chosen bottle + applicator +
        // closure can open Build Your Bottle on the exact product when one exists.
        products: sharedGlassNeck(body) ? own
            .filter((a) => a.status === "verified" && a.buildStatus === "resolved" && a.buildParts)
            .map((a) => ({ sku: a.websiteSku, glass: a.glass, parts: list(a.buildParts).map((part) => part.split(":")[1]).filter(Boolean).sort() }))
            .sort((a, b) => a.sku.localeCompare(b.sku)) : [],
        // Register reasons are staff working notes ("classify before composing"), so only the ids leave the register.
        conflicting: [...conflicting.keys()].sort(),
    });
}

const componentOut = {};
for (const id of [...used].sort()) {
    const c = componentById.get(id);
    componentOut[id] = {
        name: c.itemName,
        type: c.type,
        // Cap profile where the register records one (Short ribbed, Short, Tall, Liner, Roll-On…).
        style: c.capStyle || null,
        neck: c.neck || null,
        color: c.capColor || c.color || c.finish || null,
        applicator: c.applicator || null,
        // The code customers order and search by. REF- codes are register placeholders, not real item codes.
        itemCode: c.websiteSku && !c.websiteSku.startsWith("REF-") ? c.websiteSku : null,
    };
}

const index = {
    source: "data/register",
    snapshot: rules.snapshot,
    // The date of the catalog export the register was built from, not the day the register was rebuilt.
    snapshotDate: /(\d{4}-\d{2}-\d{2})/.exec(rules.snapshot)?.[1] ?? rules.generatedAt,
    note: "Listed fit = the catalog record lists the part and it resolves on the same neck. It is not a physical test. Formula and material suitability are not recorded here.",
    bodies: out.sort((a, b) => a.family.localeCompare(b.family) || (a.capacityMl ?? 0) - (b.capacityMl ?? 0) || a.id.localeCompare(b.id)),
    components: componentOut,
    neckRulings: Object.fromEntries(Object.entries(neckRulings).map(([neck, r]) => [neck, { date: r.date, statement: r.statement }])),
};

const json = `${JSON.stringify(index, null, 1)}\n`;
if (process.argv.includes("--check")) {
    const current = readFileSync(OUT, "utf8");
    if (current !== json) { console.error("fit-index.generated.json is stale: run node scripts/help/build-fit-index.mjs"); process.exit(1); }
    console.log("fit index is current");
} else {
    writeFileSync(OUT, json);
    console.log(`wrote ${out.length} bodies, ${Object.keys(componentOut).length} components → ${OUT}`);
}
