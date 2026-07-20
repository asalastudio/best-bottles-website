export type CustomerFacingNameConfidence = "high" | "medium" | "fallback";

export type CustomerFacingNameGroupInput = {
    displayName?: string | null;
    family?: string | null;
    capacity?: string | null;
    capacityMl?: number | null;
    color?: string | null;
    category?: string | null;
    applicatorTypes?: string[] | null;
};

export type CustomerFacingNameVariantInput = {
    itemName?: string | null;
    graceSku?: string | null;
    websiteSku?: string | null;
    family?: string | null;
    capacity?: string | null;
    capacityMl?: number | null;
    color?: string | null;
    category?: string | null;
    applicator?: string | null;
    componentGroup?: string | null;
    capColor?: string | null;
    trimColor?: string | null;
    capStyle?: string | null;
    capHeight?: string | null;
    ballMaterial?: string | null;
};

export type CustomerFacingProductName = {
    displayName: string;
    shortName: string;
    variantLabel: string | null;
    seoName: string;
    altText: string;
    confidence: CustomerFacingNameConfidence;
    sourceReason: string;
};

type CustomerFacingNameArgs = {
    group?: CustomerFacingNameGroupInput | null;
    variant?: CustomerFacingNameVariantInput | null;
    fallbackName?: string | null;
};

const GENERIC_FINISHES = new Set([
    "",
    "clear",
    "standard",
    "default",
    "none",
    "n/a",
    "spray",
    "sprayer",
    "perfume spray",
    "fine mist sprayer",
    "lotion pump",
    "dropper",
    "reducer",
    "roll-on",
    "roller",
    "cap",
    "cap/closure",
]);

const GRACE_SKU_FINISHES: Record<string, string> = {
    SBLK: "Shiny Black",
    MBLK: "Matte Black",
    BLK: "Black",
    SSLV: "Shiny Silver",
    MSLV: "Matte Silver",
    SLV: "Silver",
    SGLD: "Shiny Gold",
    MGLD: "Matte Gold",
    GLD: "Gold",
    CPR: "Copper",
    SCPR: "Copper",
    MCPR: "Matte Copper",
    WHT: "White",
    PNK: "Pink",
    PKDT: "Pink with Dots",
    BKDT: "Black with Dots",
    SLDT: "Silver with Dots",
    RED: "Red",
    GRN: "Green",
    BLU: "Blue",
    TRQ: "Turquoise",
    LVN: "Lavender",
};

const WEBSITE_SKU_FINISH_PATTERNS: Array<[RegExp, string]> = [
    // Dotted caps first — "BlkDot" must not fall through to the plain /Blk/ match.
    [/BlkDot|BlkDt/i, "Black with Dots"],
    [/SlDot|SlvDot/i, "Silver with Dots"],
    [/PnkDot|PinkDot/i, "Pink with Dots"],
    [/ShnBlk/i, "Shiny Black"],
    [/MtBlk/i, "Matte Black"],
    [/Blk/i, "Black"],
    [/ShnSl|ShnSlv|SSlv/i, "Shiny Silver"],
    [/MtSl|MtSlv|MSlv/i, "Matte Silver"],
    [/ShnGl|SGl?d/i, "Shiny Gold"],
    [/MtGl|MGl?d/i, "Matte Gold"],
    [/BrwnLthr/i, "Brown Leather"],
    [/LBrwnLthr/i, "Light Brown Leather"],
    [/PnkLthr/i, "Pink Leather"],
    [/BlkLthr/i, "Black Leather"],
    [/IvyLthr/i, "Ivory Leather"],
    [/Lvn/i, "Lavender"],
    [/Wht/i, "White"],
    [/Red/i, "Red"],
    [/Trq/i, "Turquoise"],
    [/Cu|Cpr/i, "Copper"],
    [/Gl|Gld/i, "Gold"],
    [/Sl|Slv/i, "Silver"],
];

function clean(value: string | null | undefined): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.replace(/\s+/g, " ").trim();
    return trimmed.length ? trimmed : null;
}

function key(value: string | null | undefined): string {
    return clean(value)?.toLowerCase() ?? "";
}

function titleCase(value: string): string {
    return value
        .toLowerCase()
        .replace(/\b([a-z])/g, (char) => char.toUpperCase())
        .replace(/\bMl\b/g, "ml");
}

function cleanCapacity(group?: CustomerFacingNameGroupInput | null, variant?: CustomerFacingNameVariantInput | null): string | null {
    const capacity = clean(variant?.capacity) ?? clean(group?.capacity);
    if (capacity) {
        const ml = capacity.match(/(\d+(?:\.\d+)?)\s*ml/i);
        if (ml) return `${Number(ml[1]).toLocaleString("en-US", { maximumFractionDigits: 2 })} ml`;
        return capacity;
    }
    const capacityMl = variant?.capacityMl ?? group?.capacityMl;
    if (typeof capacityMl === "number" && Number.isFinite(capacityMl) && capacityMl > 0) {
        return `${capacityMl.toLocaleString("en-US", { maximumFractionDigits: 2 })} ml`;
    }
    return null;
}

function cleanColor(group?: CustomerFacingNameGroupInput | null, variant?: CustomerFacingNameVariantInput | null): string | null {
    return clean(variant?.color) ?? clean(group?.color);
}

function cleanFamily(group?: CustomerFacingNameGroupInput | null, variant?: CustomerFacingNameVariantInput | null): string | null {
    return clean(variant?.family) ?? clean(group?.family);
}

function productEvidence(variant?: CustomerFacingNameVariantInput | null, group?: CustomerFacingNameGroupInput | null): string {
    return [
        variant?.applicator,
        variant?.componentGroup,
        variant?.itemName,
        variant?.graceSku,
        variant?.websiteSku,
        ...(group?.applicatorTypes ?? []),
        group?.displayName,
        group?.category,
    ].filter(Boolean).join(" ").toLowerCase();
}

function productTypeFromEvidence(evidence: string): { label: string; source: string } | null {
    if (/\b(ast|tassel)\b/i.test(evidence) || /ansptsl|tassel/.test(evidence)) {
        return { label: "Vintage Bulb Spray Bottle with Tassel", source: "tassel sprayer evidence" };
    }
    if (/\b(asp)\b/i.test(evidence) || /ansp|vintage|antique|bulb/.test(evidence)) {
        return { label: "Vintage Bulb Spray Bottle", source: "vintage bulb sprayer evidence" };
    }
    if (/\b(spr)\b/i.test(evidence) || /spry|perfume spray|spray pump|fine mist|sprayer/.test(evidence)) {
        return { label: "Perfume Spray Bottle", source: "spray evidence" };
    }
    if (/\b(rdc)\b/i.test(evidence) || /rdcr|reducer/.test(evidence)) {
        return { label: "Reducer Bottle", source: "reducer evidence" };
    }
    if (/\b(drp)\b/i.test(evidence) || /drp|dropper/.test(evidence)) {
        return { label: "Dropper Bottle", source: "dropper evidence" };
    }
    if (/\b(lpm)\b/i.test(evidence) || /ltn|lotion pump/.test(evidence)) {
        return { label: "Lotion Pump Bottle", source: "lotion pump evidence" };
    }
    if (/\b(rol|mrl|rbl)\b/i.test(evidence) || /roll|roll[- ]?on|roller/.test(evidence)) {
        return { label: "Roll-On Bottle", source: "roll-on evidence" };
    }
    if (/\b(atm)\b/i.test(evidence) || /atomizer/.test(evidence)) {
        return { label: "Atomizer Bottle", source: "atomizer evidence" };
    }
    return null;
}

function finishFromGraceSku(sku: string | null | undefined): string | null {
    const tokens = clean(sku)?.split(/[-_\s]+/).map((token) => token.toUpperCase()) ?? [];
    for (let i = tokens.length - 1; i >= 0; i -= 1) {
        const finish = GRACE_SKU_FINISHES[tokens[i]];
        if (finish) return finish;
    }
    return null;
}

function finishFromWebsiteSku(sku: string | null | undefined): string | null {
    const value = clean(sku);
    if (!value) return null;
    for (const [pattern, finish] of WEBSITE_SKU_FINISH_PATTERNS) {
        if (pattern.test(value)) return finish;
    }
    return null;
}

function finishFromName(value: string | null | undefined): string | null {
    const name = key(value);
    if (!name) return null;
    // Dotted caps before the plain-color list — "pink dotted cap" must not
    // collapse to bare "Pink" (PDP mislabeled the dotted roll-on caps).
    if (name.includes("black dotted")) return "Black with Dots";
    if (name.includes("silver dotted")) return "Silver with Dots";
    if (name.includes("pink dotted")) return "Pink with Dots";
    const finishes = [
        "light brown leather",
        "brown leather",
        "black leather",
        "pink leather",
        "ivory leather",
        "matte copper",
        "shiny black",
        "matte black",
        "shiny gold",
        "matte gold",
        "shiny silver",
        "matte silver",
        "rose gold",
        "lavender",
        "copper",
        "black",
        "white",
        "gold",
        "silver",
        "pink",
        "red",
        "green",
        "blue",
        "turquoise",
    ];
    const found = finishes.find((finish) => name.includes(finish));
    return found ? titleCase(found) : null;
}

function usableFinish(value: string | null | undefined): string | null {
    const finish = clean(value);
    if (!finish || GENERIC_FINISHES.has(finish.toLowerCase())) return null;
    return finish;
}

function resolveFinish(variant?: CustomerFacingNameVariantInput | null): string | null {
    if (!variant) return null;
    return (
        usableFinish(variant.capColor) ??
        usableFinish(variant.trimColor) ??
        finishFromGraceSku(variant.graceSku) ??
        finishFromWebsiteSku(variant.websiteSku) ??
        finishFromName(variant.itemName) ??
        usableFinish(variant.capStyle)
    );
}

function finishSuffix(productType: string, finish: string | null, variant?: CustomerFacingNameVariantInput | null): string | null {
    if (!finish) return null;
    const finishKey = key(finish);

    if (productType === "Reducer Bottle") {
        const capHeight = clean(variant?.capHeight);
        const leather = finishKey.includes("leather") ? finish : `${finish}${key(variant?.capStyle).includes("leather") ? " Leather" : ""}`;
        return `${leather}${capHeight && !key(leather).includes(key(capHeight)) ? ` ${capHeight}` : ""} Cap`;
    }

    if (productType === "Dropper Bottle") {
        return `${finish} Collar`;
    }

    if (productType === "Roll-On Bottle") {
        // "Pink with Dots" reads better as "Pink Cap with Dots" than "Pink with Dots Cap".
        const dotted = finish.match(/^(.+) with Dots$/i);
        return dotted ? `${dotted[1]} Cap with Dots` : `${finish} Cap`;
    }

    return finish;
}

function composeBaseName(group?: CustomerFacingNameGroupInput | null, variant?: CustomerFacingNameVariantInput | null): string | null {
    const capacity = cleanCapacity(group, variant);
    const color = cleanColor(group, variant);
    const family = cleanFamily(group, variant);
    const parts = [capacity, color, family].filter(Boolean);
    return parts.length ? parts.join(" ") : null;
}

function buildFallback(args: CustomerFacingNameArgs): CustomerFacingProductName {
    const fallback = clean(args.fallbackName) ?? clean(args.variant?.itemName) ?? clean(args.group?.displayName) ?? "Best Bottles Product";
    return {
        displayName: fallback,
        shortName: fallback,
        variantLabel: null,
        seoName: fallback,
        altText: fallback,
        confidence: "fallback",
        sourceReason: "legacy fallback",
    };
}

export function getCustomerFacingProductName(args: CustomerFacingNameArgs): CustomerFacingProductName {
    const baseName = composeBaseName(args.group, args.variant);
    if (!baseName) return buildFallback(args);

    const evidence = productEvidence(args.variant, args.group);
    const resolvedType = productTypeFromEvidence(evidence);
    const productType = resolvedType?.label ?? "Bottle";
    const finish = finishSuffix(productType, resolveFinish(args.variant), args.variant);
    const displayName = `${baseName} ${productType}${finish ? ` - ${finish}` : ""}`.replace(/\s+/g, " ").trim();
    const variantLabel = finish ?? (resolvedType ? productType : null);
    const confidence: CustomerFacingNameConfidence = args.variant && resolvedType ? "high" : resolvedType ? "medium" : "fallback";

    if (confidence === "fallback" && clean(args.fallbackName)) {
        return buildFallback(args);
    }

    return {
        displayName,
        shortName: displayName,
        variantLabel,
        seoName: displayName,
        altText: displayName,
        confidence,
        sourceReason: resolvedType?.source ?? "base bottle fields",
    };
}
