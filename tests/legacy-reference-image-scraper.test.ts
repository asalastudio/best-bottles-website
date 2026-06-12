import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as legacyReferenceModule from "../scripts/scrape_legacy_reference_images.mjs";

type LegacyReferenceProduct = {
    productUrl: string;
    websiteSku?: string | null;
    family?: string | null;
    color?: string | null;
    applicator?: string | null;
    capacity?: string | null;
    capacityMl?: number | null;
    neckThreadSize?: string | null;
    primaryImageUrl?: string | null;
};

type LocalReferenceImage = {
    path: string;
    relativePath: string;
    compactName: string;
    normalizedPath: string;
};

const {
    extractImageUrls,
    findLocalReferenceMatch,
    parseLegacyReferencePage,
} = legacyReferenceModule as unknown as {
    extractImageUrls: (html: string, pageUrl: string) => string[];
    parseLegacyReferencePage: (args: { html: string; url: string }) => LegacyReferenceProduct;
    findLocalReferenceMatch: (args: {
        localReferenceIndex: LocalReferenceImage[];
        legacyProduct: LegacyReferenceProduct;
        match: { product?: Partial<LegacyReferenceProduct> & { graceSku?: string | null; slug?: string | null } };
    }) => { score: number; relativePath: string } | null;
};

const bostonRoundHtml = `
  <html>
    <body>
      <h1>GBBR15BlackCap</h1>
      <p><strong>Item Type:</strong> Perfume vials, Bottles, Roll on bottles and Decorative glass Bottles</p>
      <p><strong>Item Name:</strong> GBBR15BlackCap</p>
      <p><strong>Item Description:</strong> Boston round design 15 ml clear glass bottle with black cap. Price each</p>
      <p><strong>Item Capacity:</strong> 15 ml (1/2 oz)</p>
      <p><strong>Item Height with Cap:</strong> 65 ±0.5 mm</p>
      <p><strong>Item Diameter:</strong> 28 ±0.5 mm</p>
      <p><strong>Neck Thread Size:</strong> 18-400</p>
      <img src="/images/store/thumbs/GBBR15BlackCap.gif" />
      <img src="/images/store/enlarged_pics/GBBR15BlackCap.gif" />
    </body>
  </html>
`;

describe("legacy reference image scraper", () => {
    it("extracts the enlarged legacy reference image first", () => {
        const images = extractImageUrls(
            bostonRoundHtml,
            "https://www.bestbottles.com/product/Boston-round-design-15-ml-clear-glass-bottle-black-cap",
        );

        expect(images[0]).toBe("https://www.bestbottles.com/images/store/enlarged_pics/GBBR15BlackCap.gif");
    });

    it("parses Boston Round product evidence for Madison reference intake", () => {
        const product = parseLegacyReferencePage({
            html: bostonRoundHtml,
            url: "https://www.bestbottles.com/product/Boston-round-design-15-ml-clear-glass-bottle-black-cap",
        });

        expect(product.websiteSku).toBe("GBBR15BlackCap");
        expect(product.family).toBe("Boston Round");
        expect(product.color).toBe("Clear");
        expect(product.applicator).toBe("Cap/Closure");
        expect(product.capacityMl).toBe(15);
        expect(product.neckThreadSize).toBe("18-400");
        expect(product.primaryImageUrl).toBe("https://www.bestbottles.com/images/store/enlarged_pics/GBBR15BlackCap.gif");
    });

    it("prefers a local pipeline image when a SKU match exists", () => {
        const product = parseLegacyReferencePage({
            html: bostonRoundHtml,
            url: "https://www.bestbottles.com/product/Boston-round-design-15-ml-clear-glass-bottle-black-cap",
        });
        const localMatch = findLocalReferenceMatch({
            legacyProduct: product,
            match: { product: { graceSku: "GB-BSR-CLR-15ML-BLK-S", websiteSku: "GBBR15BlackCap" } },
            localReferenceIndex: [
                {
                    path: "/tmp/pipeline/GB-BSR-CLR-15ML-BLK-S__GBBR15BlackCap.png",
                    relativePath: "pipeline/GB-BSR-CLR-15ML-BLK-S__GBBR15BlackCap.png",
                    compactName: "GBBSRCLR15MLBLKSGBBR15BLACKCAPPNG",
                    normalizedPath: "pipeline gb bsr clr 15ml blk s gbbr15blackcap png",
                },
            ],
        });

        expect(localMatch?.score).toBe(120);
        expect(localMatch?.relativePath).toContain("GBBR15BlackCap");
    });

    it("does not use weak local token matches as product identity", () => {
        const product = parseLegacyReferencePage({
            html: bostonRoundHtml,
            url: "https://www.bestbottles.com/product/Boston-round-design-15-ml-clear-glass-bottle-black-cap",
        });
        const localMatch = findLocalReferenceMatch({
            legacyProduct: product,
            match: { product: { family: "Boston Round", color: "Clear" } },
            localReferenceIndex: [
                {
                    path: "/tmp/pipeline/random-clear-bottle.png",
                    relativePath: "pipeline/random-clear-bottle.png",
                    compactName: "RANDOMCLEARBOTTLEPNG",
                    normalizedPath: "pipeline random clear bottle png",
                },
            ],
        });

        expect(localMatch).toBeNull();
    });

    it("keeps the scraper free of production write calls", () => {
        const script = readFileSync("scripts/scrape_legacy_reference_images.mjs", "utf8");
        expect(script).toContain("Read-only legacy reference image intake");
        expect(script).not.toContain("ctx.db.patch");
        expect(script).not.toContain(".mutation(");
        expect(script).not.toContain("admin/api");
        expect(script).not.toContain("mutation ");
    });
});
