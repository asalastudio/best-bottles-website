/**
 * "Item type": the category line Best Bottles wrote above every legacy product
 * ("Clear, frosted and colored glass roll-on bottles with steel roller-balls,
 * capacity range about 1/3oz (from 8ml to 10ml)"). The redesign keeps that
 * text (README §4.6: "for now the text supplied by Best Bottles"), corrected
 * only for spelling and spacing. SKUs the legacy site never carried fall back
 * to a category line built the same way.
 */

const TYPO_FIXES: Array<[RegExp, string]> = [
    [/\bAlluminum\b/g, "Aluminum"],
    [/\bfamiily\b/gi, "family"],
    [/\bavailabel\b/gi, "available"],
    [/\broll on\b/gi, "roll-on"],
    [/\bRollon\b/g, "Roll-on"],
    [/\brollon\b/g, "roll-on"],
    [/\bRe-closable\b/g, "Re-closable"],
    [/\(\s+from/g, "(from"],
    [/\s+\)/g, ")"],
    [/\s+,/g, ","],
    [/\s+/g, " "],
];

export function normalizeLegacyItemType(raw: string | null | undefined): string | null {
    if (typeof raw !== "string") return null;
    let value = raw.trim();
    if (!value) return null;
    for (const [pattern, replacement] of TYPO_FIXES) value = value.replace(pattern, replacement);
    value = value.replace(/\.\s*$/, "").trim();
    return value.length ? value.charAt(0).toUpperCase() + value.slice(1) : null;
}

export type ItemTypeInput = {
    category?: string | null;
    family?: string | null;
    applicator?: string | null;
};

export function fallbackItemType({ category, family, applicator }: ItemTypeInput): string {
    const app = applicator ?? "";
    if (category === "Metal Atomizer" || family === "Atomizer") return "Refillable metal shell perfume atomizers and travel size purse atomizers";
    if (category === "Glass Jar" || family === "Cream Jar") return "Cream jars";
    if (category === "Component") return "Caps, roll-on plugs and spray tops";
    if (category === "Packaging" || category === "Accessory") return "Gift bags, boxes and packaging supplies";
    if (family === "Vial") return "Perfume vials and tubes with caps and droppers";
    if (family === "Apothecary" || app === "Glass Stopper") return "Apothecary style glass bottles with glass stoppers";
    if (category === "Aluminum Bottle") return "Aluminum bottles and cans";
    if (category === "Plastic Bottle") return /spray/i.test(app) ? "Plastic bottles with fine mist sprayers" : "Plastic bottles";
    if (/roller/i.test(app)) return "Clear, frosted and colored glass roll-on bottles with steel or plastic roller balls";
    if (app === "Fine Mist Sprayer") return "Refillable glass bottles with fine mist sprayers";
    if (app === "Perfume Spray Pump") return "Classic perfume spray glass bottles";
    if (/bulb/i.test(app)) return "Antique style bulb spray bottles";
    if (app === "Lotion Pump") return "Lotion bottles";
    if (app === "Dropper") return "Dropper bottles";
    if (app === "Reducer") return "Classic glass bottles with reducers and attractive caps";
    if (family === "Decorative" || family === "Teardrop") return "Decorative perfume bottles";
    return "Classic glass bottles with attractive caps";
}

export function resolveItemType(input: ItemTypeInput & { legacyItemType?: string | null }): string {
    return normalizeLegacyItemType(input.legacyItemType) ?? fallbackItemType(input);
}
