export type Kind = "hero" | "plate" | "kit";

export type ReviewDecision = {
    status: string;
    sha256?: string;
    collection: string;
    updatedAt?: string;
    notes?: string;
    targetHeight?: number;
};

export type LedgerRow = {
    sku: string;
    graceSku: string | null;
    family: string;
    category: string | null;
    capacityMl: number | null;
    color: string | null;
    groupSlug: string | null;
    productRecord: boolean;
    hero: { state: string; generation?: string; url?: string; sha256?: string | null; lock?: string; why?: string; review?: ReviewDecision; collections?: number };
    plate: { state: string; familyId?: string; sha256?: string | null; hold?: string; reason?: string; issues?: string[] };
    kit: { state: string; completeness?: string; parts?: number; reason?: string; review?: ReviewDecision; issues?: string[] };
};

export type FamilySummary = {
    family: string;
    skus: number;
    heroes: Record<string, number>;
    plates: Record<string, number>;
    kits: Record<string, number>;
};

export type Ledger = {
    generatedAt: string;
    deployment: string | null;
    sources: Array<Record<string, string | number>>;
    states: Record<Kind, Record<string, string>>;
    summary: { skus: number; productRecords: number; heroes: Record<string, number>; plates: Record<string, number>; kits: Record<string, number> };
    families: FamilySummary[];
    rows: LedgerRow[];
};

/** The states that count as "done" for the storefront: the asset is served today. */
export const DONE: Record<Kind, string[]> = {
    hero: ["indexed"],
    plate: ["plated", "plated-cap-on-only"],
    kit: ["live"],
};

/** Compact row for the client table: one line of detail per kind, no nested objects. */
export type CompactRow = {
    sku: string;
    family: string;
    category: string | null;
    groupSlug: string | null;
    productRecord: boolean;
    hero: string;
    heroDetail: string;
    plate: string;
    plateDetail: string;
    kit: string;
    kitDetail: string;
};

const when = (d?: ReviewDecision) => (d ? `${d.status} on ${d.collection}${d.updatedAt ? " " + d.updatedAt.slice(0, 10) : ""}${d.notes ? " — " + d.notes : ""}` : "");

export function compact(r: LedgerRow): CompactRow {
    const hero = r.hero.state === "indexed" || r.hero.state.startsWith("indexed-")
        ? `${r.hero.generation ?? ""}${r.hero.lock ? " · lock " + r.hero.lock : ""}${r.hero.url ? " · " + r.hero.url.split("/").pop() : ""}`
        : r.hero.review ? when(r.hero.review) : r.hero.why ?? (r.hero.collections ? `${r.hero.collections} card(s), no decision` : "");
    const plate = r.plate.familyId ? `${r.plate.familyId}${r.plate.sha256 ? " · " + r.plate.sha256.slice(0, 12) : ""}${r.plate.hold ? " · hold: " + r.plate.hold : ""}${r.plate.issues?.length ? " · " + r.plate.issues.join("; ") : ""}` : r.plate.reason ?? "";
    const kit = r.kit.state === "live" ? `${r.kit.completeness ?? ""}${r.kit.parts ? " · " + r.kit.parts + " parts" : ""}` : r.kit.review ? when(r.kit.review) : [r.kit.reason, r.kit.issues?.join("; ")].filter(Boolean).join(" · ");
    return { sku: r.sku, family: r.family, category: r.category, groupSlug: r.groupSlug, productRecord: r.productRecord, hero: r.hero.state, heroDetail: hero, plate: r.plate.state, plateDetail: plate, kit: r.kit.state, kitDetail: kit };
}
