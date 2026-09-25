/**
 * Shapes data/register/ CSVs into the row validators in convex/registerValidators.ts.
 * Pure functions, so tests/register-rows.test.ts can check every real row
 * before scripts/register/push-register.ts sends anything to Convex.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Infer } from "convex/values";
import type { assemblyRowV, bodyRowV, componentRowV } from "../../convex/registerValidators";

export type BodyRow = Infer<typeof bodyRowV>;
export type ComponentRow = Infer<typeof componentRowV>;
export type AssemblyRow = Infer<typeof assemblyRowV>;
export type CsvRecord = Record<string, string>;

export const COMPONENT_TYPES = [
    "cap", "roll-on-cap", "faux-leather-cap", "fine-mist-sprayer", "vintage-bulb-sprayer", "tassel-bulb-sprayer",
    "lotion-pump", "dropper", "plug-applicator", "roller-insert", "reducer", "wand", "cap-review", "sprayer-review", "review",
] as const;
export const SLOTS = [
    "body", "fitment", "roller", "cap", "overcap", "sprayer", "pump", "diptube", "collar", "bulb", "tassel", "reducer", "pipette",
] as const;
const ASSEMBLY_STATUSES = ["verified", "candidate", "exception", "quarantine", "retired"] as const;
const BUILD_STATUSES = ["resolved", "partial", "unresolved"] as const;
const ASSEMBLY_TYPES = ["2-part", "3-part", "complete-set", "component"] as const;
const CONFIDENCE = ["high", "medium", "low"] as const;
const PSD_MATCH = ["exact", "alias-map", "case-insensitive"] as const;

/** RFC 4180: quoted fields, doubled quotes, commas and newlines inside quotes. */
export function parseCsv(text: string): CsvRecord[] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
            else if (ch === '"') quoted = false;
            else field += ch;
            continue;
        }
        if (ch === '"') quoted = true;
        else if (ch === ",") { row.push(field); field = ""; }
        else if (ch === "\n" || ch === "\r") {
            if (ch === "\r" && text[i + 1] === "\n") i++;
            row.push(field); field = "";
            rows.push(row); row = [];
        } else field += ch;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    const [header, ...body] = rows.filter(r => r.length > 1 || r[0] !== "");
    return body.map(values => Object.fromEntries(header.map((key, i) => [key, values[i] ?? ""])));
}

function oneOf<T extends readonly string[]>(allowed: T, value: string, what: string): T[number] {
    if (!(allowed as readonly string[]).includes(value)) throw new Error(`${what}: '${value}' is not one of ${allowed.join(", ")}`);
    return value as T[number];
}
const text = (value: string | undefined): string | null => (value && value.trim() ? value : null);
const list = (value: string | undefined): string[] => (value ? value.split("; ").map(item => item.trim()).filter(Boolean) : []);
function num(value: string | undefined): number | null {
    if (!value || !value.trim()) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export type Stamp = { snapshot: string };

function registerStamp(record: CsvRecord, stamp: Stamp) {
    return { snapshot: stamp.snapshot, source: record.source, confidence: oneOf(CONFIDENCE, record.confidence, "confidence") };
}

export function shapeBody(record: CsvRecord, stamp: Stamp): BodyRow {
    const liveHeight = num(record.dimsHeightBareMm);
    return {
        bodyId: record.bodyId,
        builderBodyId: record.builderBodyId,
        family: record.family,
        shape: text(record.shape),
        capacityMl: num(record.capacityMl),
        neck: record.neck,
        category: record.category,
        compatibilityClass: record.compatibilityClass,
        classSource: record.classSource,
        glassVariants: list(record.glassVariants),
        fitmentTypes: list(record.fitmentTypes),
        dims: {
            heightBareMm: liveHeight ?? num(record.heightWithoutCapMm),
            diameterMm: num(record.dimsDiameterMm) ?? num(record.diameterMm),
            widthMm: num(record.widthMm),
            confidence: liveHeight !== null ? record.dimsConfidence : record.heightWithoutCapMm ? "convex-only" : "none",
            source: liveHeight !== null ? record.dimsSource : "convex export heightWithoutCap",
        },
        representative: { graceSku: record.representativeGraceSku, websiteSku: record.representativeWebsiteSku },
        status: oneOf(["current", "retired"] as const, record.status, `body ${record.bodyId} status`),
        register: registerStamp(record, stamp),
    };
}

function psdCanvas(value: string): { width: number; height: number } | null {
    const match = value.match(/^\[(\d+),\s*(\d+)\]$/);
    return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
}

export function shapeComponent(record: CsvRecord, stamp: Stamp): ComponentRow {
    const id = record.componentId;
    return {
        componentId: id,
        graceSku: text(record.graceSku),
        websiteSku: text(record.websiteSku),
        sellable: record.sellable === "True",
        type: oneOf(COMPONENT_TYPES, record.type, `component ${id} type`),
        neck: record.neck,
        finish: {
            capColor: text(record.capColor),
            capStyle: text(record.capStyle),
            color: text(record.color),
            trimColor: text(record.trimColor),
            dotted: record.dotted === "True",
            rollerMaterial: record.rollerMaterial ? oneOf(["metal", "plastic"] as const, record.rollerMaterial, `component ${id} rollerMaterial`) : null,
        },
        itemName: record.itemName,
        psd: record.psdStem
            ? {
                library: record.psdLibrary,
                path: record.psdPath,
                stem: record.psdStem,
                canvas: psdCanvas(record.psdCanvas),
                match: oneOf(PSD_MATCH, record.psdMatch, `component ${id} psdMatch`),
            }
            : null,
        status: oneOf(["current", "retired", "quarantine"] as const, record.status, `component ${id} status`),
        statusReason: text(record.typeEvidence),
        register: registerStamp(record, stamp),
    };
}

export function parseBuildParts(value: string, owner: string): AssemblyRow["build"]["parts"] {
    return list(value).map(entry => {
        const [role, componentId] = entry.split(":");
        if (!role || !componentId) throw new Error(`assembly ${owner}: build part '${entry}' is not role:componentId`);
        return { role: oneOf(SLOTS, role, `assembly ${owner} build role`), componentId };
    });
}

export function shapeAssembly(record: CsvRecord, stamp: Stamp, kitPlateSha256: string | null): AssemblyRow {
    const key = record.graceSku;
    return {
        graceSku: key,
        websiteSku: text(record.websiteSku),
        bodyId: record.bodyId,
        plateKey: `${record.bodyId}|${record.glass}`,
        neck: record.neck,
        glass: record.glass,
        compatibilityClass: record.compatibilityClass,
        fitmentType: text(record.fitmentType),
        capColor: text(record.capColor),
        capStyle: text(record.capStyle),
        assemblyType: record.assemblyType ? oneOf(ASSEMBLY_TYPES, record.assemblyType, `assembly ${key} assemblyType`) : null,
        compatible: list(record.resolvedComponents),
        unresolvedListed: list(record.unresolvedComponents),
        excludedByRule: list(record.excludedByRule),
        build: {
            parts: parseBuildParts(record.buildParts, key),
            status: oneOf(BUILD_STATUSES, record.buildStatus, `assembly ${key} buildStatus`),
            reason: text(record.buildReason),
        },
        status: oneOf(ASSEMBLY_STATUSES, record.status, `assembly ${key} status`),
        statusReason: record.statusReason,
        legacy: { kitPlateSha256, capOffPlateSha256: text(record.capOffPlateSha256) },
        register: registerStamp(record, stamp),
    };
}

export type RegisterFiles = { bodies: CsvRecord[]; components: CsvRecord[]; assemblies: CsvRecord[]; stamp: Stamp };

export function readRegister(dir: string): RegisterFiles {
    const read = (name: string) => parseCsv(readFileSync(join(dir, name), "utf8"));
    const rules = JSON.parse(readFileSync(join(dir, "rules.json"), "utf8")) as { snapshot?: string };
    if (!rules.snapshot) throw new Error("rules.json has no snapshot name; rebuild the register");
    return { bodies: read("bodies.csv"), components: read("components.csv"), assemblies: read("assemblies.csv"), stamp: { snapshot: rules.snapshot } };
}

export type ShapedRegister = { bodies: BodyRow[]; components: ComponentRow[]; assemblies: AssemblyRow[] };

/** Shape every row and check the cross-references Convex cannot. Throws on the first shaping error; returns integrity problems. */
export function shapeRegister(files: RegisterFiles, kitPlates: Map<string, string> = new Map()): { rows: ShapedRegister; problems: string[] } {
    const bodies = files.bodies.map(record => shapeBody(record, files.stamp));
    const components = files.components.map(record => shapeComponent(record, files.stamp));
    const assemblies = files.assemblies.map(record =>
        shapeAssembly(record, files.stamp, kitPlates.get(record.websiteSku) ?? kitPlates.get(record.graceSku) ?? null));
    const problems: string[] = [];
    const duplicates = (keys: string[], what: string) => {
        const seen = new Set<string>();
        for (const key of keys) {
            if (!key) problems.push(`${what}: empty key`);
            else if (seen.has(key)) problems.push(`${what}: duplicate key ${key}`);
            seen.add(key);
        }
    };
    duplicates(bodies.map(b => b.bodyId), "bodies");
    duplicates(components.map(c => c.componentId), "components");
    duplicates(assemblies.map(a => a.graceSku), "assemblies");
    const bodyIds = new Set(bodies.map(b => b.bodyId));
    const componentById = new Map(components.map(c => [c.componentId, c]));
    for (const assembly of assemblies) {
        if (!bodyIds.has(assembly.bodyId)) problems.push(`assembly ${assembly.graceSku}: unknown body ${assembly.bodyId}`);
        for (const id of assembly.compatible) {
            if (!componentById.has(id)) problems.push(`assembly ${assembly.graceSku}: compatible ${id} has no component row`);
        }
        for (const part of assembly.build.parts) {
            const component = componentById.get(part.componentId);
            if (!component) problems.push(`assembly ${assembly.graceSku}: build part ${part.componentId} has no component row`);
            else if (component.status !== "current") problems.push(`assembly ${assembly.graceSku}: build part ${part.componentId} is ${component.status}`);
            else if (component.neck !== assembly.neck) problems.push(`assembly ${assembly.graceSku}: build part ${part.componentId} is on ${component.neck}, not ${assembly.neck}`);
        }
        if (assembly.build.status === "resolved" && assembly.build.parts.length === 0) problems.push(`assembly ${assembly.graceSku}: resolved build with no parts`);
    }
    return { rows: { bodies, components, assemblies }, problems };
}
