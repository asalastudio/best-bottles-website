import type { CatalogVisibilitySnapshot } from "@/lib/catalogServer";
import { getCatalogHero, resolveLiveCatalogCardHero } from "@/lib/products/catalog-heroes";
import { isVisibleCatalogGroup } from "@/lib/products/catalog-listing-visibility";
import { getLegacyProductRouteOverride } from "@/lib/products/legacy-product-route-overrides";
import { familyCardSources } from "@/lib/homepageFamilyArt";
import type { RailFamily } from "./workspaceRailTypes";

/** All listed families, using the same source holds and exact family identities as the shop. */
export function buildWorkspaceFamilies(snapshot: CatalogVisibilitySnapshot, artwork: ReadonlyMap<string, string>): RailFamily[] {
    const byFamily = new Map<string, RailFamily>();
    for (const group of snapshot.groups) {
        const variants = snapshot.variantPreviewRows.find(row => row.groupId === group._id)?.variants;
        if (!group.family || getLegacyProductRouteOverride(group.slug) || !isVisibleCatalogGroup(group, variants)) continue;
        let family = byFamily.get(group.family);
        if (!family) {
            const editorial = familyCardSources(group.family, artwork.get(group.family))?.mobile;
            family = { family: group.family, variantCount: 0, images: editorial ? [{ url: editorial, kind: "editorial" }] : [] };
            byFamily.set(group.family, family);
        }
        family.variantCount += group.variantCount;
        const primary = snapshot.primarySkus.find(row => row.groupId === group._id);
        const staticHero = getCatalogHero(group.slug, variants ?? (primary ? [primary] : []));
        const resolved = resolveLiveCatalogCardHero({ heroImageUrl: group.heroImageUrl, staticHero, variants });
        // A broken live image can fall back to another real image from this family.
        // Never borrow artwork from a similar-sounding family or a hidden group.
        for (const url of [resolved.imageUrl, staticHero?.url]) {
            if (url && !family.images.some(image => image.url === url)) family.images.push({ url, kind: "product" });
        }
    }
    return [...byFamily.values()].sort((a, b) => b.variantCount - a.variantCount || a.family.localeCompare(b.family));
}
