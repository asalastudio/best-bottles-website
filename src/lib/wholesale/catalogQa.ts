/**
 * Catalog QA — the completeness rules, in ONE place.
 *
 * Same discipline as compatibility.ts: the Catalog QA screen, the Convex
 * aggregation, and Grace all consume THIS module. If QA logic gets
 * reimplemented per-consumer we get the four-way drift we just finished
 * removing from compatibility, except now it is drift about what "broken"
 * means — and Grace would confidently report a different answer than the
 * screen.
 *
 * A check is only worth having if it is ACTIONABLE. Every finding names the
 * field to fix and who it hurts, so the QA view can sort by real impact
 * rather than showing 2,330 rows of undifferentiated red.
 */

export type QaSeverity =
    /** a customer can hit this today: wrong data, failed order, dead page */
    | "blocking"
    /** degrades the experience but sells: no image, thin copy */
    | "degraded"
    /** internal-only tidiness: unlinked group, absent optional metadata */
    | "advisory";

export interface QaFinding {
    code: string;
    field: string;
    severity: QaSeverity;
    message: string;
}

/** Only the fields QA actually reads — keeps this callable from anywhere. */
export interface QaProductRow {
    graceSku: string;
    websiteSku: string;
    itemName: string;
    family: string | null;
    color: string | null;
    capacity: string | null;
    capacityMl: number | null;
    neckThreadSize: string | null;
    heightWithCap: string | null;
    diameter: string | null;
    caseQuantity: number | null;
    webPrice1pc: number | null;
    priceTiers?: Array<{ minQty: number; unitPrice: number; totalPrice?: number }> | null;
    stockStatus: string | null;
    imageUrl?: string | null;
    imageUrlCapOff?: string | null;
    components: unknown;
    category?: string | null;
    /** catalog's own kind marker: "component" | "complete-set" | "2-part" | "3-part" */
    assemblyType?: string | null;
    productGroupId?: string | null;
    shopifySellable?: boolean | null;
    shopifyVariantId?: string | null;
}

function blank(v: string | null | undefined): boolean {
    return v == null || v.trim() === "";
}

function componentCount(components: unknown): number {
    return Array.isArray(components) ? components.length : 0;
}

/**
 * Families with a live 3D configurator, mirrored from
 * src/lib/configurator/families.ts. Not used by checkProduct (see the 3D
 * note there) — exported so a future family-level 3D report can ask
 * "which families ship a configurator" without re-deriving it.
 */
export const CONFIGURATOR_3D_FAMILIES = new Set<string>([
    "Cylinder", "Elegant", "Circle", "Round",
]);

/**
 * Which rows are configurable bottles that need a component list.
 * "component" rows are the closures themselves; "complete-set" rows
 * (metal atomizers) have their closure integrated and offer no choice.
 */
export function expectsComponents(row: QaProductRow): boolean {
    const kind = (row.assemblyType ?? "").trim().toLowerCase();
    if (kind === "component" || kind === "complete-set") return false;
    if (kind === "2-part" || kind === "3-part") return true;
    // unmarked: fall back to the category, and stay silent when unsure
    const cat = (row.category ?? "").trim().toLowerCase();
    return cat.includes("bottle") && !cat.includes("atomizer");
}

/**
 * Which rows have a neck at all. Packaging (gift bags, cartons, resealable
 * bags) and accessories (funnels) are sold alongside bottles but attach to
 * nothing — production data flagged 51 of them for "missing fitment", which
 * is not a data gap, it is a category error in the check.
 */
export function expectsFitment(row: QaProductRow): boolean {
    const kind = (row.assemblyType ?? "").trim().toLowerCase();
    if (kind === "accessory") return false;
    const cat = (row.category ?? "").trim().toLowerCase();
    if (cat === "packaging" || cat === "accessory") return false;
    return true;
}

export function checkProduct(row: QaProductRow): QaFinding[] {
    const out: QaFinding[] = [];
    const add = (code: string, field: string, severity: QaSeverity, message: string) =>
        out.push({ code, field, severity, message });

    // ---- identity -------------------------------------------------------
    if (blank(row.graceSku)) add("missing_grace_sku", "graceSku", "blocking", "No Grace SKU.");
    if (blank(row.websiteSku)) add("missing_website_sku", "websiteSku", "blocking", "No website SKU.");
    if (blank(row.itemName)) add("missing_name", "itemName", "blocking", "No product name.");

    // ---- the attributes the matrix configures on ------------------------
    if (row.capacityMl == null && blank(row.capacity))
        add("missing_capacity", "capacityMl", "blocking", "No capacity — cannot appear under a size.");
    if (blank(row.color))
        add("missing_color", "color", "degraded", "No colour/finish — cannot appear under a finish.");
    if (blank(row.family))
        add("missing_family", "family", "blocking", "No family — the row cannot be grouped.");

    // ---- fitment + compatibility ---------------------------------------
    if (expectsFitment(row) && blank(row.neckThreadSize))
        add("missing_fitment", "neckThreadSize", "blocking",
            "No neck/fitment — compatibility cannot be resolved.");
    // Only a CONFIGURABLE bottle needs a component list. The catalog marks
    // its own kinds, and validating against production showed why this
    // matters: a naive check flagged every Dropper, Roll-On Cap, Sprayer and
    // Cap as "missing components" — they ARE components — plus every Metal
    // Atomizer, whose closure is integrated (PRD §38: not every fitment is a
    // threaded neck). That is 35 false positives out of 59, and a validator
    // that cries wolf is one nobody reads.
    if (expectsComponents(row) && componentCount(row.components) === 0)
        add("missing_components", "components", "blocking",
            "No compatible components mapped — the picker would be empty.");

    // ---- commerce -------------------------------------------------------
    if (row.webPrice1pc == null)
        add("missing_price", "webPrice1pc", "blocking", "No price — cannot be ordered.");
    if (row.caseQuantity == null)
        add("missing_case_quantity", "caseQuantity", "advisory",
            "No case quantity — pack size is unknown to the customer.");
    if (row.shopifySellable === false)
        add("not_sellable", "shopifySellable", "blocking",
            "Shopify will not sell this variant — it must not be offered.");
    if (blank(row.shopifyVariantId))
        add("missing_shopify_variant", "shopifyVariantId", "blocking",
            "Not linked to Shopify — checkout cannot resolve it.");

    // ---- presentation ---------------------------------------------------
    if (blank(row.imageUrl) && blank(row.imageUrlCapOff))
        add("missing_image", "imageUrl", "degraded", "No product image.");
    if (blank(row.heightWithCap) && blank(row.diameter))
        add("missing_dimensions", "heightWithCap", "advisory", "No dimensions recorded.");

    // ---- relationships --------------------------------------------------
    if (blank(row.productGroupId))
        add("orphaned", "productGroupId", "advisory",
            "Not linked to a product group — orphaned from the catalog tree.");

    // ---- 3D: deliberately NOT checked here ------------------------------
    // PRD §34 asks for a missing-3D-asset check, but products.paperDollBodyUrl
    // (and every sibling paperDoll* field) is populated on 0 of 400 rows
    // sampled across the configurator families. 3D coverage actually lives in
    // code — src/lib/configurator/families.ts — not in this column. Checking
    // the column would flag 100% of every family forever, which trains people
    // to ignore the validator. Track 3D from the family registry instead.

    return out;
}

export interface RowVerdict {
    graceSku: string;
    family: string | null;
    findings: QaFinding[];
    blocking: number;
    degraded: number;
    advisory: number;
    /** complete = nothing blocking and nothing degraded */
    status: "complete" | "degraded" | "incomplete";
}

export function verdictFor(row: QaProductRow): RowVerdict {
    const findings = checkProduct(row);
    const blocking = findings.filter((f) => f.severity === "blocking").length;
    const degraded = findings.filter((f) => f.severity === "degraded").length;
    const advisory = findings.filter((f) => f.severity === "advisory").length;
    return {
        graceSku: row.graceSku,
        family: row.family,
        findings,
        blocking,
        degraded,
        advisory,
        status: blocking > 0 ? "incomplete" : degraded > 0 ? "degraded" : "complete",
    };
}

export interface FamilyHealth {
    family: string;
    total: number;
    complete: number;
    degraded: number;
    incomplete: number;
    completionPct: number;
    /** finding code -> how many rows carry it, worst first */
    topIssues: Array<{ code: string; count: number; severity: QaSeverity }>;
}

export function summarizeFamily(family: string, verdicts: RowVerdict[]): FamilyHealth {
    const counts = new Map<string, { count: number; severity: QaSeverity }>();
    let complete = 0, degraded = 0, incomplete = 0;

    for (const v of verdicts) {
        if (v.status === "complete") complete++;
        else if (v.status === "degraded") degraded++;
        else incomplete++;
        for (const f of v.findings) {
            const e = counts.get(f.code) ?? { count: 0, severity: f.severity };
            e.count += 1;
            counts.set(f.code, e);
        }
    }

    const rank: Record<QaSeverity, number> = { blocking: 0, degraded: 1, advisory: 2 };
    return {
        family,
        total: verdicts.length,
        complete,
        degraded,
        incomplete,
        completionPct: verdicts.length ? Math.round((complete / verdicts.length) * 100) : 0,
        topIssues: [...counts.entries()]
            .map(([code, e]) => ({ code, count: e.count, severity: e.severity }))
            .sort((a, b) => rank[a.severity] - rank[b.severity] || b.count - a.count),
    };
}

/** Cross-row check — duplicates only exist in aggregate. */
export function findDuplicateSkus(rows: Array<{ graceSku: string }>): string[] {
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const r of rows) {
        if (!r.graceSku) continue;
        if (seen.has(r.graceSku)) dupes.add(r.graceSku);
        seen.add(r.graceSku);
    }
    return [...dupes].sort();
}
