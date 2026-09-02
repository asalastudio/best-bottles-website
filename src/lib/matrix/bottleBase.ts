/**
 * The normalization layer: SKUs in, configurable bottles out.
 *
 * THE CUSTOMER CONFIGURES A BOTTLE; THE CATALOGUE STORES COMBINATIONS. A row in
 * `products` is glass + closure type + closure finish already fused together,
 * so one piece of glass appears once per closure it can wear. Measured across
 * 12 of 38 families: 1,101 SKU rows describe 120 actual bottles — 9.2 rows per
 * bottle. Circle 50 ml Clear 18-415 alone is 48 rows, every one of them named
 * "Circle design 50 ml, 1.7oz clear glass bottle".
 *
 * This file inverts that. It reads the SKUs the catalogue already has and
 * regroups them into:
 *
 *   BottleBase      family + size + glass colour + neck   (what is configured)
 *     Configuration BottleBase + closure type + finish    (what is chosen)
 *       SellableSku the existing orderable SKU            (what is ordered)
 *
 * SELLABILITY IS FREE HERE, AND THAT IS THE POINT. Compatibility and
 * sellability are different questions: `products.components` answers "what
 * physically fits" (and is 17.7% ghost references catalogue-wide), while the
 * SKU list answers "what we can actually invoice". Deriving configurations from
 * SKUs means every option offered is by construction one we can fulfil — no
 * resolver, no lookup that can miss.
 *
 * A CONFIGURATION IS A SKU, NOT A DESCRIPTION OF ONE. The obvious design is to
 * offer a finish name and resolve it to a SKU afterwards. That is unsafe here:
 * on Circle 50 ml Clear, three (type, style, finish) keys each match TWO real
 * SKUs, because the finish data is wrong on them —
 *   GB-CIR-CLR-50ML-ASP-01/-02 both record capColor "Clear" while their names
 *   and websiteSkus say Matte Silver and Red (and both are tassel variants);
 *   …ASP-IVSL and …ASP-IVGD are both "Ivory" where one is Ivory Silver and the
 *   other Ivory Gold.
 * Resolving by name would have to guess between two orderable products. So each
 * option carries its SKU from the start, and disambiguate() only makes the
 * LABEL distinct — it never decides which SKU is meant.
 */

export type SkuRow = {
    graceSku?: string | null;
    websiteSku?: string | null;
    itemName?: string | null;
    family?: string | null;
    capacity?: string | null;
    capacityMl?: number | null;
    color?: string | null;
    neckThreadSize?: string | null;
    applicator?: string | null;
    capStyle?: string | null;
    capColor?: string | null;
    imageUrl?: string | null;
    stockStatus?: string | null;
    caseQuantity?: number | null;
    webPrice1pc?: number | null;
    webPrice10pc?: number | null;
    webPrice12pc?: number | null;
};

/** One orderable combination. `sku` is the real catalogue SKU, always. */
export type Configuration = {
    sku: string;
    websiteSku: string | null;
    closureType: string;
    closureStyle: string | null;
    finish: string | null;
    /** what the picker shows — unique within its closure type */
    label: string;
    imageUrl: string | null;
    inStock: boolean;
    price1: number | null;
    price12: number | null;
    /** true when the label had to be widened because another SKU collided */
    disambiguated: boolean;
    /** true when the catalogue left applicator blank and the type was deduced */
    closureInferred: boolean;
};

export type ClosureGroup = {
    type: string;
    options: Configuration[];
    fromPrice: number | null;
};

export type BottleBase = {
    /** stable identity: family + size + glass + neck */
    key: string;
    family: string;
    capacity: string;
    capacityMl: number | null;
    color: string;
    neck: string;
    /** borrowed from a configuration — a BottleBase has no photo of its own */
    imageUrl: string | null;
    skuCount: number;
    closureTypes: ClosureGroup[];
    /** lowest unit price across every configuration; the row shows "From $x" */
    fromPrice: number | null;
    anyInStock: boolean;
};

import { toClosureType, closureRank } from "@/lib/products/closureTypes";

const s = (v: unknown) => (v == null ? "" : String(v).trim());

/** A BottleBase is the glass alone. Anything closure-shaped is deliberately absent. */
export function bottleBaseKey(r: SkuRow): string {
    return [s(r.family), s(r.capacity), s(r.color), s(r.neckThreadSize)].join("|");
}

/**
 * Make every label in a group distinct, WITHOUT choosing between SKUs.
 *
 * Widens in the least surprising order: finish, then finish + style, then
 * finish + the SKU itself. The SKU is an ugly label and it is meant to be —
 * it means the catalogue does not yet distinguish these two products, and a
 * buyer should see that rather than pick blind between identical twins.
 */
function disambiguate(configs: Configuration[]): void {
    /* Widen every colliding label by one attribute, then look again. Widening
       by style alone is NOT enough: on Circle 50 ml Clear the Reducer group has
       three SKUs labelled "Matte Silver" — two Screw Cap and one Tall — so a
       single style pass leaves the two Screw Caps identical, and the buyer is
       choosing blind between two real products. The second pass appends the SKU
       to whatever still collides. */
    const widen = (extra: (c: Configuration) => string | null) => {
        const byLabel = new Map<string, Configuration[]>();
        for (const c of configs) {
            const xs = byLabel.get(c.label);
            if (xs) xs.push(c); else byLabel.set(c.label, [c]);
        }
        for (const [, xs] of byLabel) {
            if (xs.length < 2) continue;
            for (const c of xs) {
                const more = extra(c);
                if (!more) continue;
                c.label = `${c.label} · ${more}`;
                c.disambiguated = true;
            }
        }
    };
    widen((c) => c.closureStyle);   // the meaningful distinction, when there is one
    widen((c) => c.sku);            // otherwise the catalogue offers no distinction at all
}

function toConfiguration(r: SkuRow): Configuration | null {
    const sku = s(r.graceSku);
    if (!sku) return null;                       // unorderable; never offer it
    const finish = s(r.capColor) || null;
    /* applicator is blank on 99 SKUs whose names still describe a closure, so
       fall back rather than inventing an "Other" or "None" group */
    const closure = toClosureType(r.applicator, {
        capStyle: r.capStyle, itemName: r.itemName,
    });
    return {
        sku,
        websiteSku: s(r.websiteSku) || null,
        closureType: closure.label,
        closureInferred: closure.inferred,
        closureStyle: s(r.capStyle) || null,
        finish,
        label: finish ?? s(r.capStyle) ?? sku,
        imageUrl: s(r.imageUrl) || null,
        inStock: !s(r.stockStatus).toLowerCase().includes("out"),
        price1: typeof r.webPrice1pc === "number" ? r.webPrice1pc : null,
        price12: typeof r.webPrice12pc === "number" ? r.webPrice12pc : null,
        disambiguated: false,
    };
}

const cheapest = (xs: (number | null)[]) => {
    const ps = xs.filter((p): p is number => typeof p === "number");
    return ps.length ? Math.min(...ps) : null;
};

/** Group raw SKU rows into configurable bottles. */
export function toBottleBases(rows: SkuRow[]): BottleBase[] {
    const grouped = new Map<string, SkuRow[]>();
    for (const r of rows) {
        // a row with no glass identity cannot be a BottleBase
        if (!s(r.family) || !s(r.capacity)) continue;
        const k = bottleBaseKey(r);
        const xs = grouped.get(k);
        if (xs) xs.push(r); else grouped.set(k, [r]);
    }

    const bases: BottleBase[] = [];
    for (const [key, xs] of grouped) {
        const byType = new Map<string, Configuration[]>();
        for (const r of xs) {
            const c = toConfiguration(r);
            if (!c) continue;
            const ys = byType.get(c.closureType);
            if (ys) ys.push(c); else byType.set(c.closureType, [c]);
        }
        for (const [, ys] of byType) disambiguate(ys);

        const closureTypes: ClosureGroup[] = [...byType.entries()]
            .map(([type, options]) => ({
                type,
                options: options.sort((a, b) => a.label.localeCompare(b.label)),
                fromPrice: cheapest(options.map((o) => o.price1)),
            }))
            // plain closures before decorated ones, per the shared ordering
            .sort((a, b) => closureRank(a.type) - closureRank(b.type)
                         || a.type.localeCompare(b.type));

        const all = closureTypes.flatMap((g) => g.options);
        const first = xs[0];
        bases.push({
            key,
            family: s(first.family),
            capacity: s(first.capacity),
            capacityMl: typeof first.capacityMl === "number" ? first.capacityMl : null,
            color: s(first.color),
            neck: s(first.neckThreadSize),
            imageUrl: all.find((c) => c.imageUrl)?.imageUrl ?? null,
            skuCount: all.length,
            closureTypes,
            fromPrice: cheapest(all.map((c) => c.price1)),
            anyInStock: all.some((c) => c.inStock),
        });
    }

    // ascending by size, then neck, then colour — the order a buyer scans
    return bases.sort((a, b) =>
        (a.capacityMl ?? Number.MAX_SAFE_INTEGER) - (b.capacityMl ?? Number.MAX_SAFE_INTEGER)
        || a.neck.localeCompare(b.neck)
        || a.color.localeCompare(b.color));
}

/** Look up one configuration by SKU. Exact, because options carry their SKU. */
export function findConfiguration(base: BottleBase, sku: string): Configuration | null {
    for (const g of base.closureTypes) {
        const hit = g.options.find((o) => o.sku === sku);
        if (hit) return hit;
    }
    return null;
}
