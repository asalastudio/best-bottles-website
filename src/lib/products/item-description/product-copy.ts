/**
 * Product copy v2 (server side only: the file is 2.4 MB and must never reach a client bundle).
 *
 * data/descriptions/pdp/product-copy.site.json is written by scripts/pdp-descriptions/product_copy.py from the
 * copy standard in docs/specs/pdp-item-descriptions: the title, option label, two or three sentences, the
 * Included / Fits / Glass / Good to know bullets, one Care note, the item-type line, the meta description and
 * the image alt text for every product that passes the checks. Products it does not cover keep today's copy.
 */
import siteCopy from "../../../../data/descriptions/pdp/product-copy.site.json";

export type ProductCopy = {
    title: string;
    option: string;
    variantTitle: string;
    sentences: string[];
    /** [label, text]: Included, Fits, Glass or Material, Good to know. */
    bullets: Array<[string, string]>;
    /** One warning line, shown apart from the description; empty when the product has none. */
    care: string;
    itemType: string;
    metaDescription: string;
    altText: string;
};

type SiteCopyFile = {
    generatedAt: string;
    bySku: Record<string, ProductCopy>;
    graceToWebsite: Record<string, string>;
};

const COPY = siteCopy as unknown as SiteCopyFile;

export function productCopyFor(variant: { websiteSku?: string | null; graceSku?: string | null }): ProductCopy | null {
    const website = variant.websiteSku?.trim();
    if (website && COPY.bySku[website]) return COPY.bySku[website];
    const grace = variant.graceSku?.trim();
    const mapped = grace ? COPY.graceToWebsite[grace] : undefined;
    return mapped ? COPY.bySku[mapped] ?? null : null;
}

export function productCopyCount(): number {
    return Object.keys(COPY.bySku).length;
}
