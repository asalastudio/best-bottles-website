import {
    APPLICATOR_BUCKETS,
    BOTTLE_CATEGORIES,
    CANONICAL_GLASS_COLORS,
    CATALOG_CATEGORY_VALUES,
    CATALOG_FAMILIES,
    canonicalGlassColor,
} from "@/lib/catalogFilters";

export const STAFF_APPLICATOR_VALUES = [
    "Metal Roller Ball",
    "Plastic Roller Ball",
    "Fine Mist Sprayer",
    "Perfume Spray Pump",
    "Atomizer",
    "Vintage Bulb Sprayer",
    "Vintage Bulb Sprayer with Tassel",
    "Lotion Pump",
    "Dropper",
    "Reducer",
    "Glass Stopper",
    "Glass Rod",
    "Cap/Closure",
] as const;
export type StaffApplicatorValue = (typeof STAFF_APPLICATOR_VALUES)[number];

export const CREATE_PRODUCT_SECTIONS = [
    {
        id: "identity",
        label: "Identity",
        pdpAnchor: "Title, family breadcrumb, and SKU",
        description: "The same identity the product page uses for the URL, heading, and breadcrumb.",
    },
    {
        id: "configurator",
        label: "Configurator",
        pdpAnchor: "Glass, applicator, and cap selectors",
        description: "Fields the PDP turns into option buttons — not a new product type.",
    },
    {
        id: "specs",
        label: "Specifications",
        pdpAnchor: "Specifications table",
        description: "Neck, capacity, dimensions, and case quantity as they appear on the PDP.",
    },
    {
        id: "pricing",
        label: "Pricing",
        pdpAnchor: "Per-piece and case pricing",
        description: "The live 1-pc price plus the 12-pc break the PDP already quotes.",
    },
    {
        id: "imagery",
        label: "Imagery",
        pdpAnchor: "Hero gallery and paper-doll plates",
        description: "Hero and cap-off views. Paper-doll families keep using the existing plate kit lane.",
    },
] as const;

export type CreateProductDraft = {
    displayName: string;
    family: string;
    category: string;
    capacityMl: number;
    color: string;
    neckThreadSize: string;
    bottleCollection: string;
    websiteSku: string;
    graceSku: string;
    itemName: string;
    itemDescription: string;
    groupDescription: string;
    applicator: StaffApplicatorValue;
    capColor: string;
    capStyle: string;
    trimColor: string;
    componentProfile: string;
    ballMaterial: string;
    heightWithCap: string;
    heightWithoutCap: string;
    diameter: string;
    bottleWeightG: string;
    caseQuantity: string;
    webPrice1pc: string;
    webPrice12pc: string;
    heroImageUrl: string;
    imageUrl: string;
    imageUrlCapOff: string;
    paperDollFamilyKey: string;
    stockStatus: string;
};

export type CreateProductReady = Omit<
    CreateProductDraft,
    "capacityMl" | "bottleWeightG" | "caseQuantity" | "webPrice1pc" | "webPrice12pc"
> & {
    slug: string;
    capacity: string;
    capacityMl: number;
    bottleWeightG: number | null;
    caseQuantity: number | null;
    webPrice1pc: number;
    webPrice12pc: number | null;
    priceTiers: Array<{ minQty: number; unitPrice: number; totalPrice: number }>;
    paperDollEligible: boolean;
};

export const EMPTY_CREATE_PRODUCT_DRAFT: CreateProductDraft = {
    displayName: "",
    family: "Cylinder",
    category: "Glass Bottle",
    capacityMl: 9,
    color: "Clear",
    neckThreadSize: "17-415",
    bottleCollection: "",
    websiteSku: "",
    graceSku: "",
    itemName: "",
    itemDescription: "",
    groupDescription: "",
    applicator: "Metal Roller Ball",
    capColor: "",
    capStyle: "",
    trimColor: "",
    componentProfile: "",
    ballMaterial: "",
    heightWithCap: "",
    heightWithoutCap: "",
    diameter: "",
    bottleWeightG: "",
    caseQuantity: "",
    webPrice1pc: "",
    webPrice12pc: "",
    heroImageUrl: "",
    imageUrl: "",
    imageUrlCapOff: "",
    paperDollFamilyKey: "",
    stockStatus: "In Stock",
};

function slugify(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function normalizeThreadForSlug(value: string) {
    return slugify(value.replace("/", "-"));
}

export function applicatorBucketForValue(applicator: string): string | null {
    const bucket = APPLICATOR_BUCKETS.find((candidate) =>
        candidate.productValues.some((value) => value.toLowerCase() === applicator.toLowerCase()),
    );
    return bucket?.value ?? null;
}

export function isPaperDollEligibleFamily(family: string) {
    return CATALOG_FAMILIES.some((name) => name.toLowerCase() === family.trim().toLowerCase());
}

export function buildStaffProductSlug(input: {
    family: string;
    category: string;
    capacityMl: number;
    color: string;
    neckThreadSize: string;
    applicator: string;
}) {
    const family = slugify(input.family);
    const capacity = `${input.capacityMl}ml`;
    const color = slugify(canonicalGlassColor(input.color) ?? input.color);
    const thread = normalizeThreadForSlug(input.neckThreadSize);
    const bucket = applicatorBucketForValue(input.applicator);
    const base = BOTTLE_CATEGORIES.has(input.category)
        ? `${family}-${capacity}-${color}-${thread}`
        : `${family}-${capacity}-${color}`;
    return bucket ? `${base}-${bucket}` : base;
}

function parseRequiredNumber(value: string, label: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`${label} must be a number greater than zero.`);
    }
    return parsed;
}

function parseOptionalNumber(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
}

function rejectSanityUrl(url: string, label: string) {
    const trimmed = url.trim();
    if (!trimmed) return "";
    if (trimmed.includes("cdn.sanity.io")) {
        throw new Error(`${label} cannot use a Sanity CDN URL. Product imagery lives in Convex, Shopify, or the plate ledger.`);
    }
    return trimmed;
}

export function previewCreateProduct(draft: CreateProductDraft) {
    const color = canonicalGlassColor(draft.color) ?? draft.color;
    return {
        slug: buildStaffProductSlug({
            family: draft.family,
            category: draft.category,
            capacityMl: draft.capacityMl,
            color,
            neckThreadSize: draft.neckThreadSize,
            applicator: draft.applicator,
        }),
        displayName: draft.displayName.trim() || `${draft.family} ${draft.capacityMl}ml ${color}`.trim(),
        capacity: `${draft.capacityMl} ml`,
        paperDollEligible: isPaperDollEligibleFamily(draft.family),
    };
}

export function prepareCreateProduct(draft: CreateProductDraft): CreateProductReady {
    const family = draft.family.trim();
    const category = draft.category.trim();
    const websiteSku = draft.websiteSku.trim();
    const graceSku = draft.graceSku.trim() || websiteSku;
    const displayName = draft.displayName.trim();
    const itemName = draft.itemName.trim() || displayName;
    const color = canonicalGlassColor(draft.color)?.trim() || draft.color.trim();
    const neckThreadSize = draft.neckThreadSize.trim();

    if (!CATALOG_FAMILIES.includes(family as (typeof CATALOG_FAMILIES)[number]) && family.length < 2) {
        throw new Error("Choose a catalog family the PDP already understands.");
    }
    if (!CATALOG_CATEGORY_VALUES.includes(category as (typeof CATALOG_CATEGORY_VALUES)[number])) {
        throw new Error("Choose a catalog category.");
    }
    if (!websiteSku) throw new Error("Website SKU is required.");
    if (!displayName) throw new Error("Display name is required.");
    if (!itemName) throw new Error("Item name is required.");
    if (!color) throw new Error("Glass color is required.");
    if (!neckThreadSize) throw new Error("Neck thread size is required.");
    if (!STAFF_APPLICATOR_VALUES.includes(draft.applicator)) {
        throw new Error("Choose an applicator the product page already uses.");
    }
    if (draft.capacityMl <= 0) throw new Error("Capacity must be greater than zero.");

    const webPrice1pc = parseRequiredNumber(draft.webPrice1pc, "1-pc price");
    const webPrice12pc = parseOptionalNumber(draft.webPrice12pc);
    const priceTiers = [
        { minQty: 1, unitPrice: webPrice1pc, totalPrice: webPrice1pc },
    ];
    if (webPrice12pc && webPrice12pc > 0) {
        priceTiers.push({ minQty: 12, unitPrice: webPrice12pc, totalPrice: Number((webPrice12pc * 12).toFixed(2)) });
    }

    return {
        ...draft,
        displayName,
        family,
        category,
        websiteSku,
        graceSku,
        itemName,
        color,
        neckThreadSize,
        bottleCollection: draft.bottleCollection.trim(),
        itemDescription: draft.itemDescription.trim(),
        groupDescription: draft.groupDescription.trim(),
        capColor: draft.capColor.trim(),
        capStyle: draft.capStyle.trim(),
        trimColor: draft.trimColor.trim(),
        componentProfile: draft.componentProfile.trim(),
        ballMaterial: draft.ballMaterial.trim(),
        heightWithCap: draft.heightWithCap.trim(),
        heightWithoutCap: draft.heightWithoutCap.trim(),
        diameter: draft.diameter.trim(),
        stockStatus: draft.stockStatus.trim() || "In Stock",
        paperDollFamilyKey: draft.paperDollFamilyKey.trim(),
        heroImageUrl: rejectSanityUrl(draft.heroImageUrl, "Hero image"),
        imageUrl: rejectSanityUrl(draft.imageUrl, "Primary image"),
        imageUrlCapOff: rejectSanityUrl(draft.imageUrlCapOff, "Cap-off image"),
        slug: buildStaffProductSlug({
            family,
            category,
            capacityMl: draft.capacityMl,
            color,
            neckThreadSize,
            applicator: draft.applicator,
        }),
        capacity: `${draft.capacityMl} ml`,
        capacityMl: draft.capacityMl,
        bottleWeightG: parseOptionalNumber(draft.bottleWeightG),
        caseQuantity: parseOptionalNumber(draft.caseQuantity),
        webPrice1pc,
        webPrice12pc,
        priceTiers,
        paperDollEligible: isPaperDollEligibleFamily(family),
    };
}

export const CREATE_PRODUCT_FAMILY_OPTIONS = CATALOG_FAMILIES;
export const CREATE_PRODUCT_CATEGORY_OPTIONS = CATALOG_CATEGORY_VALUES;
export const CREATE_PRODUCT_COLOR_OPTIONS = CANONICAL_GLASS_COLORS;
