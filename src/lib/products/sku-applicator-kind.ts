/**
 * The applicator a bottle SKU actually is, read from website-SKU / Grace-SKU
 * tokens first. Catalogue `applicator` is often null on screw-cap rows and
 * can be wrong when spray or roll-on SKUs leak into a Cap product group.
 *
 * Token order is longest / most specific first so MtlRoll wins over Roll and
 * AnSpTsl wins over AnSp. Finish suffixes (Gl, Sl, CuMatt, BlkSht) are not
 * applicator kinds.
 */

export const APPLICATOR_KINDS = [
    "cap",
    "rollon",
    "sprayer",
    "pump",
    "dropper",
    "reducer",
    "antique",
    "antiqueTassel",
] as const;

export type ApplicatorKind = (typeof APPLICATOR_KINDS)[number];

export type SkuApplicatorSignals = {
    websiteSku?: string | null;
    graceSku?: string | null;
    applicator?: string | null;
    itemName?: string | null;
};

const WEBSITE_KIND: Array<[RegExp, ApplicatorKind]> = [
    [/AnSpTsl/i, "antiqueTassel"],
    [/AnSp/i, "antique"],
    [/MtlRoll|Roll/i, "rollon"],
    [/Spry/i, "sprayer"],
    [/Ltn/i, "pump"],
    [/Drp/i, "dropper"],
    [/Rdcr/i, "reducer"],
];

const GRACE_KIND: Array<[RegExp, ApplicatorKind]> = [
    [/-(?:AST)-/, "antiqueTassel"],
    [/-(?:ASP)-/, "antique"],
    [/-(?:MRL|ROL|RON)-/, "rollon"],
    [/-(?:SPR)-/, "sprayer"],
    [/-(?:LPM)-/, "pump"],
    [/-(?:DRP)-/, "dropper"],
    [/-(?:RDC|RDCR)-/, "reducer"],
];

function kindFromCatalogApplicator(applicator: string | null | undefined, itemName: string | null | undefined): ApplicatorKind | null {
    const text = `${applicator ?? ""} ${itemName ?? ""}`.toLowerCase();
    if (!text.trim()) return null;
    if (/tassel/.test(text) && /(vintage|antique|bulb)/.test(text)) return "antiqueTassel";
    if (/(vintage|antique|bulb).*(spray|sprayer)/.test(text)) return "antique";
    if (/roller|roll-on|roll on/.test(text)) return "rollon";
    if (/lotion/.test(text)) return "pump";
    if (/dropper/.test(text)) return "dropper";
    if (/reducer/.test(text)) return "reducer";
    if (/fine mist|perfume spray|atomizer|\bspray/.test(text)) return "sprayer";
    if (applicator?.toLowerCase() === "cap/closure") return "cap";
    return null;
}

/** The merchandising applicator this SKU belongs to. Defaults to screw-cap. */
export function inferSkuApplicatorKind(signals: SkuApplicatorSignals): ApplicatorKind {
    const website = signals.websiteSku?.trim() ?? "";
    for (const [pattern, kind] of WEBSITE_KIND) {
        if (pattern.test(website)) return kind;
    }
    const grace = (signals.graceSku ?? "").toUpperCase();
    for (const [pattern, kind] of GRACE_KIND) {
        if (pattern.test(grace)) return kind;
    }
    return kindFromCatalogApplicator(signals.applicator, signals.itemName) ?? "cap";
}

/** True when the SKU is a plain screw-cap bottle (no spray / roll-on / pump / etc.). */
export function isPlainScrewCapSku(signals: SkuApplicatorSignals): boolean {
    return inferSkuApplicatorKind(signals) === "cap";
}
