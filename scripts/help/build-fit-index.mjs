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
const componentById = new Map(components.map((c) => [c.componentId, c]));
const sharedGlassNeck = (body) => body.compatibilityClass.startsWith("glass-") && body.neckStatus === "thread" && body.neck !== "";

const used = new Set();
const out = [];
for (const body of bodies) {
    if (body.status !== "current") continue;
    const own = assemblies.filter((a) => a.bodyId === body.bodyId && a.status !== "retired");
    const listed = new Set();
    const conflicting = new Map();
    for (const a of own) {
        if (a.status === "verified") for (const id of list(a.resolvedComponents)) listed.add(id);
        if (a.status === "quarantine") {
            for (const id of [...list(a.resolvedComponents), ...list(a.unresolvedComponents)]) {
                if (componentById.has(id)) conflicting.set(id, a.statusReason || "quarantined in the register");
            }
        }
    }
    const sameThread = [];
    if (sharedGlassNeck(body)) {
        for (const c of components) {
            if (c.neck !== body.neck || NOT_A_PART.has(c.type)) continue;
            if (c.status === "quarantine") { conflicting.set(c.componentId, c.typeEvidence ? `quarantined: ${c.typeEvidence}` : "quarantined in the register"); continue; }
            if (c.status === "current" && c.sellable === "True" && !listed.has(c.componentId)) sameThread.push(c.componentId);
        }
    }
    for (const id of listed) conflicting.delete(id);
    const listedIds = [...listed].filter((id) => componentById.has(id)).sort();
    for (const id of [...listedIds, ...sameThread, ...conflicting.keys()]) used.add(id);
    out.push({
        id: body.bodyId,
        family: body.family,
        shape: body.shape,
        capacityMl: num(body.capacityMl),
        neck: body.neck || null,
        category: body.category,
        compatibilityClass: body.compatibilityClass,
        interchangeable: sharedGlassNeck(body),
        glass: list(body.glassVariants),
        fitmentTypes: list(body.fitmentTypes).filter((t) => t !== "N/A"),
        heightMm: num(body.dimsHeightBareMm || body.heightWithoutCapMm),
        diameterMm: num(body.dimsDiameterMm || body.diameterMm || body.widthMm),
        listed: listedIds,
        sameThread: sameThread.sort(),
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
    snapshotDate: rules.generatedAt,
    note: "Listed fit = the catalog record lists the part and it resolves on the same neck. It is not a physical test. Formula and material suitability are not recorded here.",
    bodies: out.sort((a, b) => a.family.localeCompare(b.family) || (a.capacityMl ?? 0) - (b.capacityMl ?? 0) || a.id.localeCompare(b.id)),
    components: componentOut,
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
