import type { KitLike, KitPartLike } from '../../../src/lib/products/pdp-redesign/stage';

/** Review provenance augments the renderer's intentionally small public shape. */
export type ReviewPart = Omit<KitPartLike, 'image'> & {
    variantKey?: string | null;
    image: KitPartLike['image'] & { key?: string; sha256?: string; bytes?: number };
    image2x?: null;
    mask?: null;
};
export type ReviewKit = Omit<KitLike, 'parts'> & {
    familyId?: string;
    plateSha256?: string;
    completeness?: 'full';
    parts: ReviewPart[];
};
