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
    listed: "This part fits this bottle: our catalog sells them together, or our team confirms every closure on this neck finish fits every bottle on it. It says nothing about your formula.",
    "not-confirmed": "Same neck finish, but no product we sell pairs them. A matching thread does not prove a fit: liners, roller seating and dip tubes differ.",
    conflicting: "Our records disagree about this part. Don't rely on it until our team resolves it.",
};

export type FitComponent = { name: string; type: string; style: string | null; neck: string | null; color: string | null; applicator: string | null; itemCode: string | null };
export type FitBody = {
    id: string;
    family: string;
    /** The catalog's name for the mould when it says more than the family (Tall Cylinder, Footed Rectangular). */
    name: string | null;
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
    listed: string[];
    sameThread: string[];
    /** Fits by the owner's ruling for this neck rather than a catalog product (a subset of listed). */
    teamConfirmed: string[];
    conflicting: string[];
};

type FitIndex = {
    source: string;
    snapshot: string;
    snapshotDate: string;
    note: string;
    bodies: FitBody[];
    components: Record<string, FitComponent>;
    neckRulings: Record<string, { date: string; statement: string }>;
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

/** The bottle's name without its size: the catalog's mould name, else the family. */
export function bodyName(body: Pick<FitBody, "family"> & { name?: string | null }): string {
    return body.name || body.family;
}

/** Closure groups in the order the neck-thread matrices draw them. Caps split by profile, as the matrices do. */
const CLOSURE_GROUPS: Array<{ key: string; label: string; test: (c: Pick<FitComponent, "type" | "style">) => boolean }> = [
    { key: "roll-on-cap", label: "Roll-on caps", test: (c) => c.type === "roll-on-cap" },
    { key: "roller-insert", label: "Roller inserts", test: (c) => c.type === "roller-insert" },
    { key: "fine-mist-sprayer", label: "Fine mist sprayers", test: (c) => c.type === "fine-mist-sprayer" },
    { key: "short-ribbed-cap", label: "Short ribbed caps", test: (c) => c.type === "cap" && c.style === "Short ribbed" },
    { key: "short-cap", label: "Short caps with liner", test: (c) => c.type === "cap" && c.style === "Short" },
    { key: "tall-cap", label: "Tall caps with liner", test: (c) => c.type === "cap" && c.style === "Tall" },
    { key: "liner-cap", label: "Caps with liner", test: (c) => c.type === "cap" && c.style === "Liner" },
];

export function closureGroup(component: Pick<FitComponent, "type" | "style">): { key: string; label: string; order: number } {
    const at = CLOSURE_GROUPS.findIndex((group) => group.test(component));
    if (at >= 0) return { key: CLOSURE_GROUPS[at].key, label: CLOSURE_GROUPS[at].label, order: at };
    return { key: component.type, label: COMPONENT_TYPE_LABEL[component.type] ?? component.type, order: CLOSURE_GROUPS.length };
}

/** A variant the id names before the family ("footed-rectangle-…" → "Footed"), so same-size siblings stay distinct. */
export function bodyVariant(body: Pick<FitBody, "family"> & { id?: string }): string {
    if (!body.id) return "";
    const slug = body.family.toLowerCase().replace(/\s+/g, "-");
    const at = body.id.toLowerCase().indexOf(`${slug}-`);
    if (at <= 0) return "";
    return body.id.slice(0, at - 1).split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

export function bodyLabel(body: Pick<FitBody, "family" | "capacityMl" | "category"> & { id?: string; name?: string | null }): string {
    // The catalog's mould name wins; the id prefix only separates same-size siblings the catalog does not name.
    const base = body.name || `${bodyVariant(body) ? `${bodyVariant(body)} ` : ""}${body.family}`;
    const size = body.capacityMl != null ? ` ${formatMl(body.capacityMl)}` : "";
    const kind = body.category && body.category !== "Glass Bottle" && !base.toLowerCase().includes(body.category.toLowerCase().split(" ")[0])
        ? ` ${body.category.toLowerCase()}` : "";
    return `${base}${size}${kind}`;
}

export function formatMl(ml: number): string {
    return `${Number.isInteger(ml) ? ml : ml.toFixed(1).replace(/\.0$/, "")} ml`;
}

export type FitRow = { componentId: string; status: FitStatus; basis: "catalog" | "team-confirmed" | null } & FitComponent;
export type FitGroup = { type: string; label: string; rows: FitRow[] };

function groupRows(rows: FitRow[]): FitGroup[] {
    const groups = new Map<string, { label: string; order: number; rows: FitRow[] }>();
    for (const row of rows) {
        const group = closureGroup(row);
        const entry = groups.get(group.key) ?? { label: group.label, order: group.order, rows: [] };
        entry.rows.push(row);
        groups.set(group.key, entry);
    }
    return [...groups.entries()]
        .map(([type, group]) => ({ type, label: group.label, order: group.order, rows: group.rows.sort((a, b) => a.name.localeCompare(b.name)) }))
        .sort((a, b) => a.order - b.order || b.rows.length - a.rows.length || a.label.localeCompare(b.label))
        .map(({ type, label, rows: items }) => ({ type, label, rows: items }));
}

function rowsFor(ids: string[], status: FitStatus, teamConfirmed: string[] = []): FitRow[] {
    return ids.flatMap((componentId) => {
        const component = componentById(componentId);
        const basis = status !== "listed" ? null : teamConfirmed.includes(componentId) ? "team-confirmed" : "catalog";
        return component ? [{ componentId, status, basis, ...component } as FitRow] : [];
    });
}

/** The owner's ruling for a neck finish, when every closure on it fits every bottle on it. */
export function neckRuling(neck: string | null): { date: string; statement: string } | null {
    return (neck && INDEX.neckRulings?.[neck]) || null;
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
    const listed = rowsFor(body.listed, "listed", body.teamConfirmed);
    const notConfirmed = rowsFor(body.sameThread, "not-confirmed");
    const conflicting = rowsFor(body.conflicting, "conflicting");
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

/** The finder page for one bottle. */
export function fitHref(body: Pick<FitBody, "id">): string {
    return `/help/fit/${encodeURIComponent(body.id)}`;
}

/** Catalog search for a part's item code: price, stock and the product page. */
export function itemCatalogHref(itemCode: string): string {
    return `/catalog?search=${encodeURIComponent(itemCode)}`;
}

/** Bottle choices for the finder, grouped by family. */
export function bodiesByFamily(): Array<{ family: string; bodies: FitBody[] }> {
    const groups = new Map<string, FitBody[]>();
    for (const body of INDEX.bodies) groups.set(body.family, [...(groups.get(body.family) ?? []), body]);
    return [...groups.entries()].map(([family, bodies]) => ({ family, bodies })).sort((a, b) => a.family.localeCompare(b.family));
}
