/**
 * Product copy v2 (server side only: the file is 2.4 MB and must never reach a client bundle).
 *
 * data/descriptions/pdp/product-copy.site.json is written by scripts/pdp-descriptions/product_copy.py from the
 * copy standard in docs/specs/pdp-item-descriptions: the title, option label, two or three sentences, the
 * Included / Fits / Glass / Good to know bullets, one Care note, the item-type line, the meta description and
 * the image alt text for every product that passes the checks. Products it does not cover keep today's copy.
 */
import { tolaApplicatorSku, tolaAssembly } from "../tola-applicator";
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

function reviewedProductCopy(sku: string, copy: ProductCopy): ProductCopy {
    if (!/^GBTallRect10/i.test(sku)) return reviewedSmallSprayerCopy(sku, copy);
    const rename = (text: string) => text.replace(/\b(?:tall )?rectangl(?:e|ular)\b/gi, "Sleek");
    const sentences = copy.sentences.map(rename);
    if (sentences[0] && !/\bSleek\b/.test(sentences[0])) {
        sentences[0] = sentences[0].replace(/^A (?=(?:fine-mist spray|roll-on|pour) bottle)/, "A clear Sleek ");
    }
    return {
        ...copy,
        title: rename(copy.title),
        variantTitle: rename(copy.variantTitle),
        sentences,
        bullets: copy.bullets.map(([label, text]) => [label, rename(text)]),
        metaDescription: rename(copy.metaDescription),
        altText: rename(copy.altText),
    };
}

export function productCopyFor(variant: { websiteSku?: string | null; graceSku?: string | null }): ProductCopy | null {
    // Owner correction, 2026-11-02: the short 13-425 amber vial has black and
    // white caps and carries the requested 0.08 oz size wording. Scope by exact
    // identity so the separate slender 2 ml / 8-425 vials are untouched.
    const shortAmber = variant.websiteSku === "GBVialAmb1o5WhtCapSht" || variant.graceSku === "GB-VIA-AMB-1.5ML-WHT-S" ? "White"
        : variant.websiteSku === "GBVAmb1o5BlackCapSht" || variant.graceSku === "GBVAmb1o5BlackCapSht" ? "Black" : null;
    if (shortAmber) {
        const title = "2 ml Amber Vial", option = `${shortAmber} Cap`;
        const sentences = ["An amber glass sample vial for perfume, fragrance oil and essential oil.",
            "Bottle size: 0.08 oz. Fill it with a pipette or a small funnel."];
        return { title, option, variantTitle: `${title} - ${option}`, sentences,
            bullets: [["Included", `Short ${shortAmber.toLowerCase()} screw cap`], ["Fits", "13-425 neck"],
                ["Glass", "Amber; reduces the light that reaches the contents"]],
            care: "", itemType: "Vial · 13-425 neck", metaDescription: sentences.join(" "),
            altText: `2 ml amber glass vial with short ${shortAmber.toLowerCase()} screw cap` };
    }
    const tola = tolaAssembly(tolaApplicatorSku(variant));
    if (tola) {
        const title = `${tola.ml} ml Clear Tola Applicator Bottle`, option = `${tola.finish} Cap`;
        const cap = `shiny ${tola.finish.toLowerCase()} cap with a ${tola.bead} bead`;
        const sentences = ["A clear octagonal Tola bottle for perfume oil and attar.",
            `Supplied as one bottle with a plastic applicator and a ${cap}.`];
        return { title, option, variantTitle: title + " - " + option, sentences,
            bullets: [["Included", `Plastic applicator and ${cap}.`], ["Glass", "Clear octagonal glass."]],
            care: "", itemType: "Tola applicator bottle", metaDescription: sentences.join(" "),
            altText: `${title} with plastic applicator and ${cap}` };
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
    if (website && COPY.bySku[website]) return reviewedProductCopy(website, COPY.bySku[website]);
    const grace = variant.graceSku?.trim();
    const mapped = grace ? COPY.graceToWebsite[grace] : undefined;
    return mapped && COPY.bySku[mapped] ? reviewedProductCopy(mapped, COPY.bySku[mapped]) : null;
}

export function productCopyCount(): number {
    return Object.keys(COPY.bySku).length;
}
