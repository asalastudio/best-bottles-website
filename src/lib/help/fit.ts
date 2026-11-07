/**
 * Bottle–closure fit, read from the component register's committed snapshot
 * (src/lib/help/fit-index.generated.json, built by scripts/help/build-fit-index.mjs).
 *
 * Physical fit and formula suitability are different questions. This module
 * answers only the first, and only from catalog evidence: it never infers a
 * fit from a matching thread. Formula suitability is always "unknown" until
 * test evidence exists.
 */
import fitIndex from "./fit-index.generated.json";

export type FitStatus = "listed" | "not-confirmed" | "conflicting";

export const FIT_STATUS_LABEL: Record<FitStatus, string> = {
    listed: "Listed fit",
    "not-confirmed": "Not confirmed",
    conflicting: "Conflicting",
};

export const FIT_STATUS_MEANING: Record<FitStatus, string> = {
    listed: "Our catalog lists this part for this bottle, on the same neck finish. It is a catalog listing, not a physical test.",
    "not-confirmed": "Same neck finish, but no product we sell pairs them. A matching thread does not prove a fit: liners, roller seating and dip tubes differ.",
    conflicting: "Our records disagree about this part. Don't rely on it until our team resolves it.",
};

export type FitComponent = { name: string; type: string; neck: string | null; color: string | null; applicator: string | null };
export type FitBody = {
    id: string;
    family: string;
    shape: string;
    capacityMl: number | null;
    neck: string | null;
    category: string;
    compatibilityClass: string;
    interchangeable: boolean;
    glass: string[];
    fitmentTypes: string[];
    heightMm: number | null;
    diameterMm: number | null;
    dimsSource: string | null;
    listed: string[];
    sameThread: string[];
    conflicting: Array<{ componentId: string; reason: string }>;
};

type FitIndex = {
    source: string;
    snapshot: string;
    snapshotDate: string;
    note: string;
    bodies: FitBody[];
    components: Record<string, FitComponent>;
};

const INDEX = fitIndex as FitIndex;

export const FIT_SNAPSHOT = { source: INDEX.source, snapshot: INDEX.snapshot, date: INDEX.snapshotDate, note: INDEX.note } as const;

export const COMPONENT_TYPE_LABEL: Record<string, string> = {
    cap: "Caps",
    "roll-on-cap": "Roll-on caps",
    "fine-mist-sprayer": "Fine mist sprayers",
    dropper: "Droppers",
    "vintage-bulb-sprayer": "Vintage bulb sprayers",
    "tassel-bulb-sprayer": "Tassel bulb sprayers",
    "lotion-pump": "Lotion pumps",
    "roller-insert": "Roller inserts",
    "faux-leather-cap": "Faux leather caps",
    "plug-applicator": "Plug applicators",
    reducer: "Reducers",
};

export function allBodies(): readonly FitBody[] {
    return INDEX.bodies;
}

export function bodyById(id: string): FitBody | null {
    return INDEX.bodies.find((body) => body.id === id) ?? null;
}

export function componentById(id: string): FitComponent | null {
    return INDEX.components[id] ?? null;
}

export function bodyLabel(body: Pick<FitBody, "family" | "capacityMl" | "category">): string {
    const size = body.capacityMl != null ? ` ${formatMl(body.capacityMl)}` : "";
    const kind = body.category && body.category !== "Glass Bottle" ? ` ${body.category.toLowerCase()}` : "";
    return `${body.family}${size}${kind}`;
}

export function formatMl(ml: number): string {
    return `${Number.isInteger(ml) ? ml : ml.toFixed(1).replace(/\.0$/, "")} ml`;
}

export type FitRow = { componentId: string; status: FitStatus; reason?: string } & FitComponent;
export type FitGroup = { type: string; label: string; rows: FitRow[] };

function groupRows(rows: FitRow[]): FitGroup[] {
    const groups = new Map<string, FitRow[]>();
    for (const row of rows) groups.set(row.type, [...(groups.get(row.type) ?? []), row]);
    return [...groups.entries()]
        .map(([type, items]) => ({ type, label: COMPONENT_TYPE_LABEL[type] ?? type, rows: items.sort((a, b) => a.name.localeCompare(b.name)) }))
        .sort((a, b) => b.rows.length - a.rows.length || a.label.localeCompare(b.label));
}

function rowsFor(ids: string[], status: FitStatus, reasons?: Map<string, string>): FitRow[] {
    return ids.flatMap((componentId) => {
        const component = componentById(componentId);
        return component ? [{ componentId, status, reason: reasons?.get(componentId), ...component }] : [];
    });
}

export type FitReport = {
    body: FitBody;
    listed: FitGroup[];
    notConfirmed: FitGroup[];
    conflicting: FitGroup[];
    counts: Record<FitStatus, number>;
    /** Always unknown: the register holds no formula or material test data. */
    formulaSuitability: "unknown";
};

export function fitReport(bodyId: string): FitReport | null {
    const body = bodyById(bodyId);
    if (!body) return null;
    const reasons = new Map(body.conflicting.map((c) => [c.componentId, c.reason]));
    const listed = rowsFor(body.listed, "listed");
    const notConfirmed = rowsFor(body.sameThread, "not-confirmed");
    const conflicting = rowsFor(body.conflicting.map((c) => c.componentId), "conflicting", reasons);
    return {
        body,
        listed: groupRows(listed),
        notConfirmed: groupRows(notConfirmed),
        conflicting: groupRows(conflicting),
        counts: { listed: listed.length, "not-confirmed": notConfirmed.length, conflicting: conflicting.length },
        formulaSuitability: "unknown",
    };
}

/** Bottles that list a component, for "which bottles does this sprayer fit?". */
export function bodiesListing(componentId: string): FitBody[] {
    return INDEX.bodies.filter((body) => body.listed.includes(componentId));
}

/** Bottle choices for the finder, grouped by family. */
export function bodiesByFamily(): Array<{ family: string; bodies: FitBody[] }> {
    const groups = new Map<string, FitBody[]>();
    for (const body of INDEX.bodies) groups.set(body.family, [...(groups.get(body.family) ?? []), body]);
    return [...groups.entries()].map(([family, bodies]) => ({ family, bodies })).sort((a, b) => a.family.localeCompare(b.family));
}
