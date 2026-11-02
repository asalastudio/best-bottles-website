/**
 * Product copy v2 (server side only: the file is 2.4 MB and must never reach a client bundle).
 *
 * data/descriptions/pdp/product-copy.site.json is written by scripts/pdp-descriptions/product_copy.py from the
 * copy standard in docs/specs/pdp-item-descriptions: the title, option label, two or three sentences, the
 * Included / Fits / Glass / Good to know bullets, one Care note, the item-type line, the meta description and
 * the image alt text for every product that passes the checks. Products it does not cover keep today's copy.
 */
import { tolaApplicatorSku } from "../tola-applicator";
import { rectangleApplicatorGlass, rectangleApplicatorSku } from "../rectangle-applicator";
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

function reviewedSmallSprayerCopy(sku: string, copy: ProductCopy): ProductCopy {
    if (!["GBSpry3mlClBlk", "GBSpry3mlClWht", "GBSpry4mlClBlk", "GBSpry4mlClWh"].includes(sku)) return copy;
    const rename = (text: string) => sku.startsWith("GBSpry3ml") ? text.replace(/\b3 ml\b/gi, "3.3 ml") : text;
    return { ...copy, title: rename(copy.title), variantTitle: rename(copy.variantTitle),
        sentences: copy.sentences.map(rename), metaDescription: rename(copy.metaDescription), altText: rename(copy.altText),
        bullets: copy.bullets.map(([label, text]) => [label, label === "Included"
            ? `${sku.endsWith("Blk") ? "Black" : "White"} fine-mist sprayer and one clear protective overcap.` : rename(text)]),
    };
}

export function productCopyFor(variant: { websiteSku?: string | null; graceSku?: string | null }): ProductCopy | null {
    if (tolaApplicatorSku(variant)) {
        const title = "6 ml Clear Tola Applicator Bottle", option = "Gold Cap";
        const sentences = ["A clear octagonal Tola bottle for perfume oil and attar.",
            "Supplied as one bottle with a plastic applicator and a shiny gold cap with a red bead."];
        return { title, option, variantTitle: title + " - " + option, sentences,
            bullets: [["Included", "Plastic applicator and shiny gold cap with red bead."], ["Glass", "Clear octagonal glass."]],
            care: "", itemType: "Tola applicator bottle", metaDescription: sentences.join(" "),
            altText: title + ", with plastic applicator and shiny gold cap with red bead" };
    }
    const rectangleGlass = rectangleApplicatorGlass(rectangleApplicatorSku(variant));
    if (rectangleGlass) {
        const title = "9 ml Rectangle Applicator Bottle";
        const option = rectangleGlass + " Glass";
        const sentences = ["A rectangular glass bottle for perfume oil and attar.",
            "The faceted glass stopper has a glass applicator wand and seats in a ground-glass neck."];
        return { title, option, variantTitle: title + " - " + option, sentences,
            bullets: [["Included", "Matching faceted glass stopper with glass applicator wand."],
                ["Glass", rectangleGlass + " glass."], ["Neck", "Ground-glass stopper joint."]],
            care: "", itemType: "Glass applicator bottle",
            metaDescription: sentences.join(" "), altText: title + ", " + rectangleGlass.toLowerCase() + " glass with matching faceted stopper" };
    }
    const website = variant.websiteSku?.trim();
    if (website && COPY.bySku[website]) return reviewedSmallSprayerCopy(website, COPY.bySku[website]);
    const grace = variant.graceSku?.trim();
    const mapped = grace ? COPY.graceToWebsite[grace] : undefined;
    return mapped && COPY.bySku[mapped] ? reviewedSmallSprayerCopy(mapped, COPY.bySku[mapped]) : null;
}

export function productCopyCount(): number {
    return Object.keys(COPY.bySku).length;
}
