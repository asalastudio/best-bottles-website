import heroRows from "./catalog-heroes.json";
import pilotRows from "./catalog-hero-pilot.json";
import crePilotRows from "./catalog-hero-cre-pilot.json";
import elegantReleaseRows from "./catalog-hero-elegant-release.json";
import bostonDivaReleaseRows from "./catalog-hero-boston-diva-release.json";
import sleekReleaseRows from "./catalog-hero-sleek-release.json";
import apothecaryReleaseRows from "./catalog-hero-apothecary-release.json";
import remaining42ReleaseRows from "./catalog-hero-remaining-42-release.json";
import nextBatchReleaseRows from "./catalog-hero-next-batch-release.json";
import batch3ReleaseRows from "./catalog-hero-batch3-release.json";
import vialsReleaseRows from "./catalog-hero-vials-release.json";
import batch6ReleaseRows from "./catalog-hero-batch6-release.json";

export type CatalogHero = Omit<(typeof heroRows)[number], "shopifyVariantId"> & { shopifyVariantId: string | null };
const completePilotRows = [...pilotRows, ...crePilotRows, ...elegantReleaseRows, ...bostonDivaReleaseRows, ...sleekReleaseRows, ...apothecaryReleaseRows, ...remaining42ReleaseRows, ...nextBatchReleaseRows, ...batch3ReleaseRows, ...vialsReleaseRows, ...batch6ReleaseRows];
function activePilotRows(): CatalogHero[] {
    return process.env.NEXT_PUBLIC_CATALOG_HERO_PILOT === "families-2026-09-22"
        ? completePilotRows : pilotRows;
}

/** Explicit build opt-in: staging candidates do not become a production release. */
export function isCatalogHeroPilotEnabled(): boolean {
    return ["cylinder-2026-09-22", "families-2026-09-22"].includes(process.env.NEXT_PUBLIC_CATALOG_HERO_PILOT ?? "");
}

const bySku = new Map(heroRows.map(hero => [hero.websiteSku, hero]));
const byGroup = new Map<string, CatalogHero[]>();
for (const hero of heroRows) byGroup.set(hero.groupSlug, [...(byGroup.get(hero.groupSlug) ?? []), hero]);

// Production group slugs that differ from the slugs the approved heroes were
// recorded under. Each production group lists every recorded group it holds.
const verifiedGroupAliases: Readonly<Record<string, readonly string[]>> = {
    // Production retained this older Cylinder group slug while development uses
    // the applicator-qualified slug. Both identify the same exact 30 ml assembly.
    "cylinder-30ml-clear-18-415": ["cylinder-30ml-clear-18-415-finemist"],
    // Production's 2026-09-20 Shopify webhook split the three 5 ml Slim atomizers
    // into this group; their approved heroes are recorded under atomizer-5ml.
    "atomizer-5ml-slim": ["atomizer-5ml"],
    // Production merges each Aluminum size's finishes into one "mixed" group.
    "aluminum-bottle-65ml-mixed-20-410": ["aluminum-bottle-65ml-clear-20-410-lotionpump", "aluminum-bottle-65ml-white-20-410-lotionpump"],
    "aluminum-bottle-100ml-mixed-20-410": ["aluminum-bottle-100ml-clear-20-410-finemist"],
    "aluminum-bottle-120ml-mixed-20-410": ["aluminum-bottle-120ml-clear-20-410-lotionpump"],
    "aluminum-bottle-500ml-mixed-20-410": ["aluminum-bottle-500ml-clear-20-410"],
    // Production drops the applicator suffix from the two Heart groups.
    "heart-4ml-frosted-8mm-keychain": ["heart-4ml-frosted-8mm-keychain-glassapplicator"],
    "heart-4ml-frosted-8mm-tassel": ["heart-4ml-frosted-8mm-tassel-glassapplicator"],
    // Production merged each colour of these non-glass lines into one "mixed"
    // group after the heroes were approved per colour (image audit, 2026-10-30).
    "gift-bag-0ml-mixed": ["gift-bag-0ml-black", "gift-bag-0ml-blue", "gift-bag-0ml-gold", "gift-bag-0ml-green", "gift-bag-0ml-ivory", "gift-bag-0ml-lavender", "gift-bag-0ml-pink", "gift-bag-0ml-purple", "gift-bag-0ml-red", "gift-bag-0ml-silver"],
    "gift-box-0ml-mixed": ["gift-box-0ml-blue", "gift-box-0ml-clear", "gift-box-0ml-green", "gift-box-0ml-matte", "gift-box-0ml-silver", "gift-box-0ml-white"],
    "tool-0ml-mixed": ["tool-0ml-gold", "tool-0ml-silver"],
    "packaging-supply-0ml-mixed": ["packaging-supply-0ml-clear"],
    "plastic-bottle-10ml-mixed": ["plastic-bottle-10ml-clear"],
    "plastic-bottle-30ml-mixed": ["plastic-bottle-30ml-clear"],
    // Cream jars: one production group per size, heroes recorded per glass colour.
    "cream-jar-3ml-mixed": ["cream-jar-3ml-clear", "cream-jar-3ml-cobalt-blue"],
    "cream-jar-5ml-mixed": ["cream-jar-5ml-amber", "cream-jar-5ml-clear"],
    "cream-jar-15ml-mixed": ["cream-jar-15ml-clear"],
    "cream-jar-20ml-mixed": ["cream-jar-20ml-white"],
    "cream-jar-30ml-mixed": ["cream-jar-30ml-amber", "cream-jar-30ml-frosted"],
    "cream-jar-40ml-mixed": ["cream-jar-40ml-amber", "cream-jar-40ml-frosted"],
    "cream-jar-60ml-mixed": ["cream-jar-60ml-frosted"],
    "cream-jar-63ml-mixed": ["cream-jar-63ml-white"],
    // Glass slugs production renamed. The SKU match stays exact, so each alias
    // only lets the same assembly's own hero through.
    // Minaret cap (GBElg15MinarCu) was recorded under a cap-closure slug that is now empty.
    "elegant-15ml-clear-13-415": ["elegant-15ml-clear-13-415-capclosure"],
    // The frosted 50 ml Circle reducer is an 18-415 neck; the hero slug said 18-400.
    "circle-50ml-frosted-18-415-reducer": ["circle-50ml-frosted-18-400-reducer"],
    // GBCyl5SpryBlkMatt is a 5 ml bottle recorded under the 5.5 ml slug.
    "cylinder-5ml-clear-13-415-finemist": ["cylinder-5.5ml-clear-13-415-finemist"],
    // The 3 ml snap lotion bottle was recorded as "Snap-On".
    "lotion-bottle-3ml-clear-snap": ["lotion-bottle-3ml-clear-Snap-On"],
};

/** The group itself plus any recorded groups it corresponds to. The SKU match stays exact. */
function recordedGroupSlugs(groupSlug: string): readonly string[] {
    return [groupSlug, ...(verifiedGroupAliases[groupSlug] ?? [])];
}

function isPilotHero(hero?: CatalogHero | null): boolean {
    const candidate = hero && activePilotRows().find(row => row.websiteSku === hero.websiteSku);
    return Boolean(isCatalogHeroPilotEnabled() && candidate && candidate.url === hero?.url
        && hero && recordedGroupSlugs(hero.groupSlug).includes(candidate.groupSlug));
}

/** Exact SKU lookup only: never borrow another finish or applicator's photo. */
export function getProductHero(websiteSku?: string | null): CatalogHero | null {
    if (!websiteSku) return null;
    return (isCatalogHeroPilotEnabled() ? activePilotRows().find(row => row.websiteSku === websiteSku) : null) ?? bySku.get(websiteSku) ?? null;
}

/** A released Sunburst hero for exactly this SKU in this group; never an older bone-review photo. */
export function getReleasedCatalogHero(groupSlug: string, websiteSku?: string | null): CatalogHero | null {
    if (!websiteSku || !isCatalogHeroPilotEnabled()) return null;
    const slugs = recordedGroupSlugs(groupSlug);
    const row = activePilotRows().find(candidate => slugs.includes(candidate.groupSlug) && candidate.websiteSku === websiteSku);
    return row ? { ...row, groupSlug } : null;
}

/**
 * Only select an assembly still present in the filtered catalog result.
 *
 * When a SKU is asked for (a search for it, the SKU a Line items row prints, a
 * picked finish), its own approved photograph wins from either registry. Only
 * when it has none does the group fall back to its usual hero: a released one
 * first, then the original registry in recorded order. Before 31 Oct 2026 a
 * sibling's released hero beat the asked-for SKU's own registry photo, so a
 * finish with its own picture still showed another finish's bottle.
 */
export function getCatalogHero(groupSlug: string, variants: readonly { websiteSku?: string | null }[], preferredWebsiteSku?: string | null): CatalogHero | null {
    const slugs = recordedGroupSlugs(groupSlug);
    const listed = (websiteSku: string) => variants.some(variant => variant.websiteSku === websiteSku);
    const eligible = isCatalogHeroPilotEnabled() ? activePilotRows().filter(candidate => slugs.includes(candidate.groupSlug) && listed(candidate.websiteSku)) : [];
    const original = slugs.flatMap(slug => byGroup.get(slug) ?? []).filter(candidate => listed(candidate.websiteSku));
    const preferred = preferredWebsiteSku?.trim().toLowerCase();
    const isPreferred = (candidate: CatalogHero) => Boolean(preferred) && candidate.websiteSku.toLowerCase() === preferred;
    const hero = eligible.find(isPreferred) ?? original.find(isPreferred) ?? eligible[0] ?? original[0];
    return hero ? { ...hero, groupSlug } : null;
}

export function getCatalogHeroStyle(hero: CatalogHero) {
    const f = hero.framing;
    return { transformOrigin: "0 0", transform: `translate(${f.translateXPercent}%, ${f.translateYPercent}%) scale(${f.scale})` };
}

export function getCatalogHeroProductHref(hero: CatalogHero | null | undefined, href: string): string {
    if (!hero) return href;
    const url = new URL(href, "https://bestbottles.com");
    url.searchParams.set("sku", hero.websiteSku);
    return `${url.pathname}${url.search}${url.hash}`;
}

export function isShopifyCdnCatalogUrl(value: string | null | undefined): boolean {
    const url = value?.trim();
    if (!url) return false;
    try {
        const parsed = new URL(url);
        return parsed.protocol === "https:" && parsed.hostname === "cdn.shopify.com";
    } catch {
        return url.includes("cdn.shopify.com/");
    }
}

function imageKey(value: string | null | undefined): string {
    return value?.trim().split("?")[0] ?? "";
}

/**
 * A Madison-published Shopify CDN group hero replaces the baked bone-review
 * plate. Image and pictured SKU stay the same assembly so the card and PDP agree.
 */
export function resolveLiveCatalogCardHero(input: {
    heroImageUrl?: string | null;
    staticHero?: CatalogHero | null;
    variants?: readonly { websiteSku?: string | null; imageUrl?: string | null }[];
}): {
    catalogHero: CatalogHero | null;
    imageUrl: string | null;
    picturedWebsiteSku: string | null;
} {
    const heroImageUrl = input.heroImageUrl?.trim() || null;
    // Only an exact, still-visible assembly can supersede a live group photo.
    // Keeping this ahead of Shopify precedence is essential for staging review.
    if (isPilotHero(input.staticHero) && input.variants?.some(variant => variant.websiteSku === input.staticHero?.websiteSku)) {
        const hero = input.staticHero!;
        return { catalogHero: hero, imageUrl: hero.url, picturedWebsiteSku: hero.websiteSku };
    }
    if (isShopifyCdnCatalogUrl(heroImageUrl)) {
        const pictured = input.variants?.find((variant) =>
            imageKey(variant.imageUrl) === imageKey(heroImageUrl),
        );
        return {
            catalogHero: null,
            imageUrl: heroImageUrl,
            picturedWebsiteSku: pictured?.websiteSku?.trim() || null,
        };
    }

    const staticHero = isPilotHero(input.staticHero) ? null : input.staticHero ?? null;
    return {
        catalogHero: staticHero,
        imageUrl: staticHero?.url ?? heroImageUrl,
        picturedWebsiteSku: staticHero?.websiteSku ?? null,
    };
}
