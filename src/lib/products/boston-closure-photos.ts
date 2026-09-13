import photos from "./boston-closure-photos.json";

type Variant = { websiteSku?: string | null; applicator?: string | null; capColor?: string | null };
type Link = (typeof photos.variants)[keyof typeof photos.variants];

/** Reviewed catalog crosswalk: SKU is an exact key, never a parsed identity.
 * Guard the catalog fields so a changed product cannot inherit a cap photo.
 * These are existing component thumbnails, not new kit or plate approvals.
 */
export function bostonClosurePhoto(groupSlug: string, variant: Variant): string | undefined {
    const link = variant.websiteSku
        ? (photos.variants as Record<string, Link>)[variant.websiteSku] : undefined;
    if (!link || link.groupSlug !== groupSlug || link.applicator !== variant.applicator
        || link.capColor !== variant.capColor) return undefined;
    return photos.components[link.componentSku as keyof typeof photos.components]?.thumb;
}
