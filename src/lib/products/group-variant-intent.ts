/**
 * Product-group slugs encode applicator intent:
 *   circle-15ml-clear-13-415           → Cap / Closure
 *   circle-15ml-clear-13-415-finemist  → Fine Mist Spray
 *   circle-15ml-clear-13-415-rollon    → Roll-On
 *
 * The PDP finish rail is built from every variant whose `applicator` matches
 * the active applicator. Screw-cap rows store `applicator: null`. If a spray
 * or roll-on SKU leaks into that group, `applicatorOptions` becomes non-empty
 * and the page defaults to Fine Mist — so the Cap rail shows spray finishes
 * (matte copper, matte silver) and selecting them jumps to spray plates.
 *
 * Filter variants to the slug's applicator kind before building options.
 */
import {
    inferSkuApplicatorKind,
    type ApplicatorKind,
    type SkuApplicatorSignals,
} from "./sku-applicator-kind";

/**
 * Same grammar as `src/lib/configurator/families.ts` SLUG_GRAMMAR:
 *   <family>-<capacity>ml-<colour>-<neck>[-<closure>]
 */
const PRODUCT_SLUG =
    /^([a-z]+(?:-[a-z]+)*?)-(\d+(?:\.\d+)?)ml-([a-z]+(?:-[a-z]+)*?)-(\d+-\d+|\d+mm|ground)(?:-([a-z]+(?:-[a-z]+)*))?$/;

const CLOSURE_TOKEN_KIND: Record<string, ApplicatorKind> = {
    rollon: "rollon",
    finemist: "sprayer",
    perfumespray: "sprayer",
    lotionpump: "pump",
    dropper: "dropper",
    reducer: "reducer",
    // Product-group slug suffixes (Convex data) — unchanged
    antiquespray: "antique",
    "antiquespray-tassel": "antiqueTassel",
    // Refine / catalog filter bucket slugs (post rename)
    vintagestyle: "antique",
    "vintagestyle-tassel": "antiqueTassel",
    capclosure: "cap",
};

const BUCKET_KIND: Record<string, ApplicatorKind> = {
    rollon: "rollon",
    finemist: "sprayer",
    perfumespray: "sprayer",
    lotionpump: "pump",
    dropper: "dropper",
    reducer: "reducer",
    // Catalog filter buckets
    vintagestyle: "antique",
    "vintagestyle-tassel": "antiqueTassel",
    // Prior bucket slugs still recognized
    antiquespray: "antique",
    "antiquespray-tassel": "antiqueTassel",
    capclosure: "cap",
};

export function parseProductSlug(slug: string): {
    family: string;
    capacityMl: number;
    color: string;
    neck: string;
    closure: string | null;
} | null {
    const match = PRODUCT_SLUG.exec(slug);
    if (!match) return null;
    const [, family, capacity, color, neck, closure] = match;
    return {
        family,
        capacityMl: Number(capacity),
        color,
        neck,
        closure: closure ?? null,
    };
}

export function capacityMlFromSlug(slug: string): number | null {
    return parseProductSlug(slug)?.capacityMl ?? null;
}

/** Applicator kind this product page is selling, or null when the slug is not a bottle grammar. */
export function groupApplicatorIntent(
    slug: string,
    applicatorBucket?: string | null,
): ApplicatorKind | null {
    const parsed = parseProductSlug(slug);
    if (parsed) {
        if (parsed.closure) return CLOSURE_TOKEN_KIND[parsed.closure] ?? null;
        return "cap";
    }
    if (applicatorBucket && applicatorBucket in BUCKET_KIND) {
        return BUCKET_KIND[applicatorBucket];
    }
    if (applicatorBucket == null) return null;
    return null;
}

export function variantMatchesGroupIntent(
    intent: ApplicatorKind,
    signals: SkuApplicatorSignals,
): boolean {
    return inferSkuApplicatorKind(signals) === intent;
}

/**
 * Abbas / ASA-195: 15 ml Clear Square open-mouth is sold with only these
 * four caps. Other finishes belong on spray / roll-on siblings, not this rail.
 */
const SQUARE_15_OPEN_MOUTH_WEBSITE_SKUS = new Set([
    "GBSqr15WhtSht",
    "GBSqr15BlkSht",
    "GBSqr15Gl",
    "GBSqr15Sl",
]);

export function isSquare15OpenMouthSlug(slug: string): boolean {
    return slug === "square-15ml-clear-13-415";
}

export function isAllowedSquare15OpenMouthFinish(signals: SkuApplicatorSignals): boolean {
    const websiteSku = signals.websiteSku?.trim();
    if (websiteSku && SQUARE_15_OPEN_MOUTH_WEBSITE_SKUS.has(websiteSku)) return true;
    return false;
}

function applyOpenMouthFinishAllowlist<T extends SkuApplicatorSignals>(
    slug: string,
    intent: ApplicatorKind | null,
    variants: readonly T[],
): T[] {
    if (!isSquare15OpenMouthSlug(slug)) return [...variants];
    if (intent && intent !== "cap") return [...variants];
    const allowed = variants.filter((variant) => isAllowedSquare15OpenMouthFinish(variant));
    return allowed.length > 0 ? allowed : [...variants];
}

/**
 * Keep only variants that belong on this product page. Fail open when the
 * filter would empty the group (unknown SKU vocabulary) so a page still
 * renders; a Cap page with real cap SKUs plus leaked spray rows keeps the caps.
 */
export function filterVariantsForGroupIntent<T extends SkuApplicatorSignals>(
    slug: string,
    variants: readonly T[],
    applicatorBucket?: string | null,
): T[] {
    const intent = groupApplicatorIntent(slug, applicatorBucket);
    const matched = intent
        ? variants.filter((variant) => variantMatchesGroupIntent(intent, variant))
        : [...variants];
    const scoped = matched.length > 0 ? matched : [...variants];
    return applyOpenMouthFinishAllowlist(slug, intent, scoped);
}
