import heroRows from "./catalog-heroes.json";
import pilotRows from "./catalog-hero-pilot.json";
import crePilotRows from "./catalog-hero-cre-pilot.json";
import elegantReleaseRows from "./catalog-hero-elegant-release.json";
import bostonDivaReleaseRows from "./catalog-hero-boston-diva-release.json";
import sleekReleaseRows from "./catalog-hero-sleek-release.json";
import apothecaryReleaseRows from "./catalog-hero-apothecary-release.json";
import remaining42ReleaseRows from "./catalog-hero-remaining-42-release.json";

export type CatalogHero = Omit<(typeof heroRows)[number], "shopifyVariantId"> & { shopifyVariantId: string | null };
const completePilotRows = [...pilotRows, ...crePilotRows, ...elegantReleaseRows, ...bostonDivaReleaseRows, ...sleekReleaseRows, ...apothecaryReleaseRows, ...remaining42ReleaseRows];
function activePilotRows(): CatalogHero[] {
    return process.env.NEXT_PUBLIC_CATALOG_HERO_PILOT === "families-2026-09-22"
        ? completePilotRows : pilotRows;
}

/** Explicit build opt-in: staging candidates do not become a production release. */
export function isCatalogHeroPilotEnabled(): boolean {
    return ["cylinder-2026-09-22", "families-2026-09-22"].includes(process.env.NEXT_PUBLIC_CATALOG_HERO_PILOT ?? "");
}

function isPilotHero(hero?: CatalogHero | null): boolean {
    const candidate = hero && activePilotRows().find(row => row.websiteSku === hero.websiteSku);
    return Boolean(isCatalogHeroPilotEnabled() && candidate && candidate.url === hero?.url
        && candidate.groupSlug === hero?.groupSlug);
}
const bySku = new Map(heroRows.map(hero => [hero.websiteSku, hero]));
const byGroup = new Map<string, CatalogHero[]>();
for (const hero of heroRows) byGroup.set(hero.groupSlug, [...(byGroup.get(hero.groupSlug) ?? []), hero]);

// Production retained this older Cylinder group slug while development uses
// the applicator-qualified slug. Both identify the same exact 30 ml assembly.
const verifiedGroupAliases: Readonly<Record<string, string>> = {
    "cylinder-30ml-clear-18-415": "cylinder-30ml-clear-18-415-finemist",
};

/** Exact SKU lookup only: never borrow another finish or applicator's photo. */
export function getProductHero(websiteSku?: string | null): CatalogHero | null {
    if (!websiteSku) return null;
    return (isCatalogHeroPilotEnabled() ? activePilotRows().find(row => row.websiteSku === websiteSku) : null) ?? bySku.get(websiteSku) ?? null;
}

/** Only select an assembly still present in the filtered catalog result. */
export function getCatalogHero(groupSlug: string, variants: readonly { websiteSku?: string | null }[], preferredWebsiteSku?: string | null): CatalogHero | null {
    const resolvedSlug = verifiedGroupAliases[groupSlug] ?? groupSlug;
    const eligible = isCatalogHeroPilotEnabled() ? activePilotRows().filter(candidate =>
        candidate.groupSlug === resolvedSlug && variants.some(variant => variant.websiteSku === candidate.websiteSku),
    ) : [];
    const pilot = eligible.find(candidate => candidate.websiteSku.toLowerCase() === preferredWebsiteSku?.trim().toLowerCase()) ?? eligible[0];
    if (pilot) return { ...pilot, groupSlug };
    const hero = byGroup.get(resolvedSlug)?.find(candidate =>
        variants.some(variant => variant.websiteSku === candidate.websiteSku),
    );
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
