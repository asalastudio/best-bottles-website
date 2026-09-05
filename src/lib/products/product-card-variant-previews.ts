import { normalizeImportedCapColor } from "./cap-finish-evidence";
import { glassSwatchImage } from "./glass-swatches";
import { isLegacyBestBottlesImageUrl } from "../productVariantIntegrity";
import { catalogSearchScore } from "../catalogFilters";

export type ProductCardVariantPreview = {
    id: string;
    label: string;
    imageUrl?: string;
    imageAlt?: string;
    swatchColor?: string;
    swatchImageUrl?: string;
    optionType?: "glassColor" | "capColor" | "fitment" | "variant" | "related";
    sku?: string;
    graceSku?: string;
    websiteSku?: string;
    shopifyVariantId?: string;
    href?: string;
    capLabel?: string;
};

export type ProductCardVariantPreviewSource = {
    id?: string | null;
    itemName?: string | null;
    websiteSku?: string | null;
    shopifyVariantId?: string | null;
    graceSku?: string | null;
    imageUrl?: string | null;
    imageUrlCapOff?: string | null;
    color?: string | null;
    applicator?: string | null;
    capColor?: string | null;
    trimColor?: string | null;
    capStyle?: string | null;
    capHeight?: string | null;
    ballMaterial?: string | null;
};

export function getProductCardPreviewAccessibleLabel(
    preview: Pick<ProductCardVariantPreview, "id" | "label" | "sku" | "graceSku" | "websiteSku">,
    productTitle: string,
    index: number,
): string {
    const sku = preview.graceSku ?? preview.websiteSku ?? preview.sku;
    return `Preview ${preview.label} for ${productTitle}${sku ? ` · SKU ${sku}` : ` · option ${index + 1}`}`;
}

/** Keep cap exploration inside one actual assembly; a roller-material change
 * belongs in the configurator, not inside an apparently identical cap option. */
export function getCatalogCardVariantPreviews(
    variants: ProductCardVariantPreviewSource[],
    options: ProductCardVariantPreviewOptions & {
        search?: string;
        primarySku?: string | null;
        rollerMaterials?: string[];
    },
): ProductCardVariantPreview[] {
    const material = (variant: ProductCardVariantPreviewSource) =>
        normalizeKey(variant.ballMaterial) || (/metal/i.test(variant.applicator ?? "") ? "metal" : /plastic/i.test(variant.applicator ?? "") ? "plastic" : "");
    // Some imports repeat glass color in capColor (all frosted tops become
    // "Frosted"). Use exact SKU evidence before finish deduplication.
    const normalized = variants.map(normalizeImportedCapColor);
    const eligible = normalized.filter((variant) => !options.rollerMaterials?.length
        || !material(variant) || options.rollerMaterials.includes(material(variant)));
    const score = (variant: ProductCardVariantPreviewSource) => catalogSearchScore(options.search ?? "", [
        { value: resolveCapFinish(variant), weight: 3 },
        { value: variant.websiteSku, weight: 4 },
        { value: variant.graceSku, weight: 4 },
        { value: variant.applicator, weight: 1 },
    ]);
    const ranked = [...eligible].sort((a, b) => score(b) - score(a)
        || Number(b.websiteSku === options.primarySku || b.graceSku === options.primarySku)
        - Number(a.websiteSku === options.primarySku || a.graceSku === options.primarySku));
    const seed = ranked[0];
    if (!seed) return [];
    const scoped = ranked.filter((variant) => normalizeKey(variant.applicator) === normalizeKey(seed.applicator)
        && material(variant) === material(seed)
        && normalizeKey(variant.color) === normalizeKey(seed.color));
    const previews = getProductCardVariantPreviews(scoped, options);
    return previews.map((preview) => {
        const source = scoped.find((variant) => (variant.id ?? variant.websiteSku ?? variant.graceSku) === preview.id);
        const capLabel = source ? resolveCapFinish(source) ?? undefined : undefined;
        return { ...preview, capLabel, label: capLabel ?? preview.label,
            href: productCardVariantHref(options.productHref ?? "", preview) };
    }).sort((a, b) => {
        const aSource = scoped.find((variant) => (variant.id ?? variant.websiteSku ?? variant.graceSku) === a.id);
        const bSource = scoped.find((variant) => (variant.id ?? variant.websiteSku ?? variant.graceSku) === b.id);
        return (bSource ? score(bSource) : 0) - (aSource ? score(aSource) : 0);
    });
}

export function productCardVariantHref(href: string, preview?: ProductCardVariantPreview | null): string {
    const sku = preview?.websiteSku ?? preview?.graceSku ?? preview?.sku;
    if (!sku || !href) return href;
    const url = new URL(href, "https://bestbottles.com");
    url.searchParams.set("sku", sku);
    return `${url.pathname}${url.search}${url.hash}`;
}

type ProductCardVariantPreviewOptions = {
    productTitle: string;
    defaultImageUrl?: string | null;
    groupColor?: string | null;
    productHref?: string;
};

const CAP_FINISH_SWATCHES: Record<string, string> = {
    Black: "#111111",
    "Matte Black": "#2D2D2D",
    "Shiny Black": "#0D0D0D",
    White: "#F7F4ED",
    Gold: "#C9A24A",
    "Matte Gold": "#B89755",
    "Shiny Gold": "#D2A94F",
    Silver: "#C3C7CC",
    "Matte Silver": "#ADADAD",
    "Shiny Silver": "#C8C8C8",
    Pink: "#EFA0AD",
    "Rose Gold": "#E8A090",
    Copper: "#B87333",
    "Matte Copper": "#B87333",
    Natural: "#D8B98C",
    Clear: "rgba(236, 246, 248, 0.72)",
    Frosted: "#E5EAEC",
    Amber: "#B56A24",
    Green: "#6B9A6B",
    Blue: "#5B87B5",
    "Cobalt Blue": "#355C9A",
    Lavender: "#DCCBED",
    Red: "#C13B4A",
    Turquoise: "#40C4AA",
    Standard: "#D6D0C4",
};

const GLASS_SWATCHES: Record<string, string> = {
    Clear: "rgba(236, 246, 248, 0.72)",
    Frosted: "#E5EAEC",
    Amber: "#B56A24",
    Green: "#6B9A6B",
    Blue: "#5B87B5",
    Cobalt: "#355C9A",
    "Cobalt Blue": "#355C9A",
    White: "#F7F4ED",
    Black: "#111111",
    Pink: "#EFA0AD",
    Swirl: "#C8DDEA",
};


const SKU_FINISH_TOKENS: Record<string, string> = {
    SBLK: "Shiny Black",
    MBLK: "Matte Black",
    BLK: "Black",
    SSLV: "Shiny Silver",
    MSLV: "Matte Silver",
    SLV: "Silver",
    SGLD: "Shiny Gold",
    MGLD: "Matte Gold",
    GLD: "Gold",
    MCPR: "Matte Copper",
    SCPR: "Copper",
    WHT: "White",
    PNK: "Pink",
    PKDT: "Pink",
    RED: "Red",
    GRN: "Green",
    BLU: "Blue",
    TRQ: "Turquoise",
};

const WEBSITE_SKU_FINISH_PATTERNS: Array<[RegExp, string]> = [
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

const GENERIC_LABELS = new Set([
    "default title",
    "default",
    "variant",
    "variant option",
    "option",
    "n/a",
    "standard",
]);

const GENERIC_FINISH_LABELS = new Set([
    ...GENERIC_LABELS,
    "",
    "clear",
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

function cleanString(value: string | null | undefined): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.replace(/\s+/g, " ").trim();
    return trimmed.length ? trimmed : null;
}

function normalizeKey(value: string | null | undefined): string {
    return cleanString(value)?.toLowerCase() ?? "";
}

function cleanLabel(value: string | null | undefined): string | null {
    const cleaned = cleanString(value);
    if (!cleaned) return null;
    if (GENERIC_LABELS.has(cleaned.toLowerCase())) return null;
    return cleaned;
}

function cleanFinishLabel(value: string | null | undefined): string | null {
    const cleaned = cleanString(value);
    if (!cleaned) return null;
    if (GENERIC_FINISH_LABELS.has(cleaned.toLowerCase())) return null;
    return cleaned;
}

function finishFromSku(sku: string | null | undefined): string | null {
    const tokens = cleanString(sku)?.split("-").map((token) => token.toUpperCase()) ?? [];
    for (let i = tokens.length - 1; i >= 0; i -= 1) {
        const finish = SKU_FINISH_TOKENS[tokens[i]];
        if (finish) return finish;
    }
    return null;
}

function finishFromWebsiteSku(sku: string | null | undefined): string | null {
    const value = cleanString(sku);
    if (!value) return null;
    for (const [pattern, finish] of WEBSITE_SKU_FINISH_PATTERNS) {
        if (pattern.test(value)) return finish;
    }
    return null;
}

function finishFromName(itemName: string | null | undefined): string | null {
    const name = normalizeKey(itemName);
    if (!name) return null;
    const orderedFinishes = [
        "matte copper",
        "shiny black",
        "matte black",
        "shiny gold",
        "matte gold",
        "shiny silver",
        "matte silver",
        "rose gold",
        "black",
        "white",
        "gold",
        "silver",
        "pink",
        "red",
        "green",
        "blue",
        "turquoise",
        "lavender",
        "natural",
    ];
    const found = orderedFinishes.find((finish) => name.startsWith(finish) || name.includes(`${finish} cap`) || name.includes(`${finish} trim`));
    return found ? found.replace(/\b\w/g, (char) => char.toUpperCase()) : null;
}

function resolveCapFinish(variant: ProductCardVariantPreviewSource): string | null {
    const capColor = cleanFinishLabel(variant.capColor);
    const capStyle = cleanFinishLabel(variant.capStyle);
    // Some legacy finish labels already include length; capStyle may contradict them.
    if (capColor && /^(?:short|tall)\b/i.test(capColor)) return capColor;
    if (capColor && capStyle && !normalizeKey(capStyle).includes(normalizeKey(capColor))) {
        if (normalizeKey(capStyle).includes("dot") && normalizeKey(capColor).includes("dot")) return capColor;
        return `${capStyle} ${capColor}`;
    }
    return capColor
        ?? cleanFinishLabel(variant.trimColor)
        ?? finishFromSku(variant.graceSku)
        ?? finishFromWebsiteSku(variant.websiteSku)
        ?? finishFromSku(variant.websiteSku)
        ?? finishFromName(variant.itemName)
        ?? capStyle;
}

function simplifyApplicator(value: string | null | undefined): string | null {
    const raw = cleanLabel(value);
    if (!raw) return null;
    const key = raw.toLowerCase();
    if (key === "cap/closure" || key === "applicator cap") return "Cap";
    if (key.includes("metal roller")) return "Metal Roller";
    if (key.includes("plastic roller")) return "Plastic Roller";
    if (key.includes("roller")) return "Roller";
    if (key.includes("fine mist")) return "Fine Mist Sprayer";
    if (key.includes("perfume spray")) return "Perfume Pump";
    if (key.includes("lotion") && key.includes("pump")) return "Lotion Pump";
    if (key.includes("dropper")) return "Dropper";
    if (key.includes("reducer")) return "Reducer";
    if (key.includes("atomizer")) return "Atomizer";
    if (key.includes("bulb") || key.includes("sprayer")) return "Sprayer";
    if (key.includes("glass stopper")) return "Glass Stopper";
    return raw;
}

function applicatorNoun(value: string | null | undefined): string | null {
    const label = simplifyApplicator(value);
    if (!label || label === "Cap") return "Cap";
    if (label.includes("Roller")) return "Roller";
    if (label.includes("Sprayer")) return "Sprayer";
    if (label.includes("Pump")) return "Pump";
    if (label.includes("Dropper")) return "Dropper";
    if (label.includes("Reducer")) return "Reducer";
    if (label.includes("Atomizer")) return "Atomizer";
    return label;
}

function swatchColorFor(label: string | null | undefined, glassColor?: string | null): string | undefined {
    const cleaned = cleanLabel(label);
    if (cleaned) {
        if (CAP_FINISH_SWATCHES[cleaned]) return CAP_FINISH_SWATCHES[cleaned];
        const stripped = cleaned
            .replace(/^(Spray|Screw Cap|Lotion Pump|Perfume Pump|Roller|Dropper|Atomizer|Reducer)\s+/i, "")
            .trim();
        if (CAP_FINISH_SWATCHES[stripped]) return CAP_FINISH_SWATCHES[stripped];
        for (const [key, color] of Object.entries(CAP_FINISH_SWATCHES)) {
            if (normalizeKey(cleaned).includes(normalizeKey(key))) return color;
        }
    }
    const glass = cleanLabel(glassColor);
    if (glass) return GLASS_SWATCHES[glass] ?? CAP_FINISH_SWATCHES[glass];
    return undefined;
}

function previewLabel(variant: ProductCardVariantPreviewSource, groupColor?: string | null): string | null {
    const finish = resolveCapFinish(variant);
    const applicator = simplifyApplicator(variant.applicator);
    const noun = applicatorNoun(variant.applicator);
    const variantColor = cleanLabel(variant.color);
    const groupColorKey = normalizeKey(groupColor);

    if (finish && noun && noun !== "Cap") return `${finish} ${noun}`;
    if (finish) return `${finish} Cap`;
    if (variant.ballMaterial && applicator?.includes("Roller")) return `${variant.ballMaterial} Roller`;
    if (applicator && applicator !== "Cap") return applicator;
    if (variantColor && normalizeKey(variantColor) !== groupColorKey) return `${variantColor} Glass`;
    return cleanLabel(variant.itemName);
}

function optionTypeFor(variant: ProductCardVariantPreviewSource, groupColor?: string | null): ProductCardVariantPreview["optionType"] {
    const variantColor = cleanLabel(variant.color);
    if (variantColor && normalizeKey(variantColor) !== normalizeKey(groupColor)) return "glassColor";
    if (cleanLabel(variant.applicator) && simplifyApplicator(variant.applicator) !== "Cap") return "fitment";
    if (resolveCapFinish(variant)) return "capColor";
    return "variant";
}

function hasVisualSignal(variant: ProductCardVariantPreviewSource, groupColor?: string | null): boolean {
    if (cleanString(variant.imageUrl) || cleanString(variant.imageUrlCapOff)) return true;
    if (resolveCapFinish(variant)) return true;
    if (cleanLabel(variant.applicator) && simplifyApplicator(variant.applicator) !== "Cap") return true;
    if (cleanLabel(variant.ballMaterial)) return true;
    const variantColor = cleanLabel(variant.color);
    return Boolean(variantColor && normalizeKey(variantColor) !== normalizeKey(groupColor));
}

function imageKey(value: string | null | undefined): string {
    return cleanString(value)?.split("?")[0] ?? "";
}

function isBlockedProductImageUrl(value: string | null | undefined): boolean {
    const cleaned = cleanString(value);
    if (!cleaned) return false;
    if (isLegacyBestBottlesImageUrl(cleaned)) return true;
    try {
        return new URL(cleaned).hostname === "cdn.sanity.io";
    } catch {
        return cleaned.includes("cdn.sanity.io/") || cleaned.includes("www.bestbottles.com/images/store/");
    }
}

function productImageUrl(value: string | null | undefined): string | undefined {
    const cleaned = cleanString(value);
    return cleaned && !isBlockedProductImageUrl(cleaned) ? cleaned : undefined;
}

export function getProductCardVariantPreviews(
    variants: ProductCardVariantPreviewSource[] | null | undefined,
    options: ProductCardVariantPreviewOptions,
): ProductCardVariantPreview[] {
    if (!variants?.length) return [];

    const defaultImageKey = imageKey(options.defaultImageUrl);
    const previews: ProductCardVariantPreview[] = [];
    const seen = new Set<string>();

    for (const variant of variants) {
        if (!hasVisualSignal(variant, options.groupColor)) continue;

        const label = previewLabel(variant, options.groupColor);
        if (!label) continue;

        const imageUrl = productImageUrl(variant.imageUrl) ?? productImageUrl(variant.imageUrlCapOff);
        const finish = resolveCapFinish(variant);
        const optionType = optionTypeFor(variant, options.groupColor);
        const swatchColor = swatchColorFor(finish, variant.color ?? options.groupColor);
        const glassColor = cleanLabel(variant.color ?? options.groupColor);
        const swatchImageUrl = optionType === "glassColor" && glassColor ? glassSwatchImage(glassColor) : undefined;
        const sku = cleanString(variant.websiteSku) ?? cleanString(variant.graceSku) ?? undefined;
        const id = cleanString(variant.id) ?? sku ?? `${label}-${previews.length}`;
        const dedupeKey = [
            optionType,
            normalizeKey(label),
            swatchColor ?? "",
            normalizeKey(simplifyApplicator(variant.applicator)),
            normalizeKey(glassColor),
        ].join("|");

        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        previews.push({
            id,
            label,
            imageUrl,
            imageAlt: `${options.productTitle} - ${label}`,
            swatchColor,
            swatchImageUrl,
            optionType,
            sku,
            graceSku: cleanString(variant.graceSku) ?? undefined,
            websiteSku: cleanString(variant.websiteSku) ?? undefined,
            shopifyVariantId: cleanString(variant.shopifyVariantId) ?? undefined,
            href: options.productHref,
        });
    }

    return previews.sort((a, b) => {
        const aMatchesDefault = defaultImageKey && imageKey(a.imageUrl) === defaultImageKey ? 0 : 1;
        const bMatchesDefault = defaultImageKey && imageKey(b.imageUrl) === defaultImageKey ? 0 : 1;
        if (aMatchesDefault !== bMatchesDefault) return aMatchesDefault - bMatchesDefault;
        if (a.imageUrl && !b.imageUrl) return -1;
        if (!a.imageUrl && b.imageUrl) return 1;
        return a.label.localeCompare(b.label);
    });
}
