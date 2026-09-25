import { editorialImageUrl } from "@/sanity/lib/image";
import type { CollectionCardConfig } from "@/lib/shopCollections";

// Collections with an approved bone-canvas card; the rest keep their source crop.
const BONE_COLLECTION_ART = new Set(["roll-on-bottles", "perfume-atomizers", "glass-spray-bottles", "dropper-bottles", "sample-vials", "lotion-pump-bottles", "decorative-bottles", "apothecary-bottles", "cream-jars", "accessories-packaging", "splash-on-bottles"]);

/** The collection card image: the CMS image when set, else the shipped homepage art. */
export function collectionCardImage(card: { key: string; image?: CollectionCardConfig["image"] }): string {
    return editorialImageUrl(card.image, 800, 600)
        ?? (BONE_COLLECTION_ART.has(card.key)
            ? `/assets/homepage/collection-${card.key}-bone-v3.webp`
            : `/assets/homepage/source-${card.key}.webp`);
}
