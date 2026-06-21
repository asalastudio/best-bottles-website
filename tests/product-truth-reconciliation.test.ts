import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as productTruthModule from "../scripts/audit_product_truth_reconciliation.mjs";

type LegacyProduct = {
    productUrl: string | null;
    websiteSku: string | null;
    itemName?: string | null;
    itemDescription?: string | null;
    family: string | null;
    color: string | null;
    applicator: string | null;
    capFinish: string | null;
    capacityMl: number | null;
    neckThreadSize: string | null;
    imageUrl?: string | null;
    imageFile?: string | null;
};

type LegacySearch = {
    searchUrl: string;
    searchText: string;
    products: LegacyProduct[];
};

type ConvexProduct = {
    slug: string;
    websiteSku?: string | null;
    graceSku?: string | null;
    itemName?: string | null;
    family?: string | null;
    color?: string | null;
    applicator?: string | null;
    neckThreadSize?: string | null;
    capacityMl?: number | null;
    imageUrl?: string | null;
};

type ProductTruthReport = {
    matchStrategy?: string | null;
    matchedConvexProducts: ConvexProduct[];
    filteredConvexProducts: ConvexProduct[];
    issues: Array<{ issueType: string }>;
    summary: {
        critical: number;
        filteredConvexCount: number;
        legacySearchCount: number;
        legacySearchMatched: number;
    };
};

const {
    parseLegacyProductPage,
    parseLegacySearchPage,
    reconcileProductTruth,
} = productTruthModule as unknown as {
    parseLegacyProductPage: (args: { html: string; url: string }) => LegacyProduct;
    parseLegacySearchPage: (args: { html: string; url: string }) => LegacySearch;
    reconcileProductTruth: (args: {
        convexProducts: ConvexProduct[];
        legacyProduct?: LegacyProduct | null;
        legacySearch?: LegacySearch | null;
        routeOverrides: Record<string, string>;
        madisonTargetSku?: string | null;
    }) => ProductTruthReport;
};

const vialLegacyHtml = `
  <html>
    <body>
      <h1>GB09BlackCapApp</h1>
      <p><strong>Item Type:</strong> Perfume vials and tubes With Caps & Droppers</p>
      <p><strong>Item Name:</strong> GB09BlackCapApp</p>
      <p><strong>Item Description:</strong> Cylinder design 9 ml clear glass vial with black cap with glass rod applicator. For use with perfume or fragrance oil, essential oil, aromatherapy. Small sample or trial size vial. Price each</p>
      <p><strong>Item Capacity:</strong> 9 ml (0.3 oz)</p>
      <p><strong>Item Height with Cap:</strong> 50 ±0.5 mm</p>
      <p><strong>Item Diameter:</strong> 20 ±0.5 mm</p>
      <p><strong>Neck Thread Size:</strong> 18-400</p>
      <img src="/images/store/enlarged_pics/GB09BlackCapApp.gif" />
    </body>
  </html>
`;

const vialShortCapLegacyHtml = `
  <html>
    <body>
      <h1>GB09BlackCapSht</h1>
      <p><strong>Item Type:</strong> Perfume vials and tubes With Caps & Droppers</p>
      <p><strong>Item Name:</strong> GB09BlackCapSht</p>
      <p><strong>Item Description:</strong> Cylinder design 9 ml clear glass vial with black short cap. For use with perfume or fragrance oil, essential oil, aromatherapy. Small sample or trial size vial. Price each</p>
      <p><strong>Item Capacity:</strong> 9 ml (0.3 oz)</p>
      <p><strong>Item Height with Cap:</strong> 50 ±0.5 mm</p>
      <p><strong>Item Diameter:</strong> 20 ±0.5 mm</p>
      <p><strong>Neck Thread Size:</strong> 18-400</p>
      <img src="/images/store/enlarged_pics/GB09BlackCapSht.gif" />
    </body>
  </html>
`;

const bostonLegacySearchHtml = `
  <html>
    <body>
      <div class="product-list-item brennan">
        <a href="/product/Boston-round-design-15-ml-clear-glass-bottle-black-cap">
          <img src="/images/store/enlarged_pics/GBBR15BlackCap.gif" />
          <strong>GBBR15BlackCap</strong>
          <span>15 ml clear glass Boston Round bottle with black cap</span>
        </a>
      </div>
      <div class="product-list-item brennan">
        <a href="/product/Boston-round-design-30-ml-amber-glass-bottle-dropper">
          <img data-original="/images/store/enlarged_pics/GBBR30AmberDropper.gif" />
          <strong>GBBR30AmberDropper</strong>
          <span>30 ml amber glass Boston Round bottle with dropper</span>
        </a>
      </div>
    </body>
  </html>
`;

describe("product truth reconciliation", () => {
    it("extracts legacy 9 ml vial product evidence from BestBottles HTML", () => {
        const product = parseLegacyProductPage({
            html: vialLegacyHtml,
            url: "https://www.bestbottles.com/product/Vial-design-9-ml-clear-glass-black-cap-with-glass-rod-applicator",
        });

        expect(product.websiteSku).toBe("GB09BlackCapApp");
        expect(product.capacityMl).toBe(9);
        expect(product.neckThreadSize).toBe("18-400");
        expect(product.family).toBe("Vial");
        expect(product.color).toBe("Clear");
        expect(product.applicator).toBe("Glass Rod");
        expect(product.capFinish).toBe("Black");
    });

    it("recognizes the canonical 9 ml vial glass-wand product", () => {
        const legacyProduct = parseLegacyProductPage({
            html: vialLegacyHtml,
            url: "https://www.bestbottles.com/product/Vial-design-9-ml-clear-glass-black-cap-with-glass-rod-applicator",
        });
        const report = reconcileProductTruth({
            legacyProduct,
            routeOverrides: {},
            convexProducts: [
                {
                    slug: "vial-9ml-clear-18-400-glasswand",
                    websiteSku: "GB09BlackCapApp",
                    graceSku: "GB-CYL-CLR-9ML-T-01",
                    itemName: "9 ml Clear Vial Applicator Bottle",
                    family: "Vial",
                    color: "Clear",
                    applicator: "Glass Rod",
                    neckThreadSize: "18-400",
                    capacityMl: 9,
                    imageUrl: "https://cdn.shopify.com/example.png",
                },
            ],
        });

        expect(report.matchStrategy).toBe("websiteSku_or_graceSku");
        expect(report.matchedConvexProducts[0].slug).toBe("vial-9ml-clear-18-400-glasswand");
        expect(report.issues.some((issue) => issue.issueType === "route_override_recommended")).toBe(true);
        expect(report.summary.critical).toBe(0);
    });

    it("keeps the 9 ml vial short-cap product out of Cylinder/Roll-On identity", () => {
        const legacyProduct = parseLegacyProductPage({
            html: vialShortCapLegacyHtml,
            url: "https://www.bestbottles.com/product/Vial-design-9-ml-clear-glass-black-short-cap",
        });
        const report = reconcileProductTruth({
            legacyProduct,
            routeOverrides: {},
            convexProducts: [
                {
                    slug: "vial-9ml-clear-18-400",
                    websiteSku: "GB09BlackCapSht",
                    graceSku: "GB-CYL-CLR-9ML-S-01",
                    itemName: "9 ml Clear Vial Bottle with Cap",
                    family: "Vial",
                    color: "Clear",
                    applicator: null,
                    neckThreadSize: "18-400",
                    capacityMl: 9,
                    imageUrl: "https://cdn.shopify.com/vial-short-cap.png",
                },
            ],
        });

        expect(legacyProduct.websiteSku).toBe("GB09BlackCapSht");
        expect(legacyProduct.family).toBe("Vial");
        expect(legacyProduct.color).toBe("Clear");
        expect(legacyProduct.applicator).toBeNull();
        expect(report.matchedConvexProducts[0].slug).toBe("vial-9ml-clear-18-400");
        expect(report.issues.map((issue) => issue.issueType)).toContain("madison_resolver_risk");
        expect(report.issues.map((issue) => issue.issueType)).not.toContain("applicator_mismatch");
    });

    it("lists filtered 9 ml Vial products and flags legacy Cylinder SKU prefixes as Madison risk", () => {
        const report = reconcileProductTruth({
            routeOverrides: {},
            convexProducts: [
                {
                    slug: "vial-9ml-clear-18-400-glasswand",
                    websiteSku: "GB09BlackCapApp",
                    graceSku: "GB-CYL-CLR-9ML-T-01",
                    itemName: "9 ml Clear Vial Applicator Bottle",
                    family: "Vial",
                    color: "Clear",
                    applicator: "Glass Rod",
                    neckThreadSize: "18-400",
                    capacityMl: 9,
                    imageUrl: "https://cdn.shopify.com/vial-applicator.png",
                },
                {
                    slug: "vial-9ml-clear-18-400",
                    websiteSku: "GB09BlackCapSht",
                    graceSku: "GB-CYL-CLR-9ML-S-01",
                    itemName: "9 ml Clear Vial Bottle with Cap",
                    family: "Vial",
                    color: "Clear",
                    applicator: null,
                    neckThreadSize: "18-400",
                    capacityMl: 9,
                    imageUrl: null,
                },
            ],
        });

        expect(report.summary.filteredConvexCount).toBe(2);
        expect(report.filteredConvexProducts.map((product) => product.slug)).toEqual([
            "vial-9ml-clear-18-400-glasswand",
            "vial-9ml-clear-18-400",
        ]);
        expect(report.issues.filter((issue) => issue.issueType === "madison_resolver_risk")).toHaveLength(2);
    });

    it("flags a Madison vial image mapped to a 9 ml roll-on SKU", () => {
        const legacyProduct = parseLegacyProductPage({
            html: vialLegacyHtml,
            url: "https://www.bestbottles.com/product/Vial-design-9-ml-clear-glass-black-cap-with-glass-rod-applicator",
        });
        const report = reconcileProductTruth({
            legacyProduct,
            madisonTargetSku: "GBCyl9MtlRollMattCu",
            routeOverrides: {},
            convexProducts: [
                {
                    slug: "vial-9ml-clear-18-400-glasswand",
                    websiteSku: "GB09BlackCapApp",
                    graceSku: "GB-CYL-CLR-9ML-T-01",
                    itemName: "9 ml Clear Vial Applicator Bottle",
                    family: "Vial",
                    color: "Clear",
                    applicator: "Glass Rod",
                    neckThreadSize: "18-400",
                    capacityMl: 9,
                    imageUrl: "https://cdn.shopify.com/vial.png",
                },
                {
                    slug: "cylinder-9ml-clear-17-415-rollon",
                    websiteSku: "GBCyl9MtlRollMattCu",
                    graceSku: "GB-CYL-CLR-9ML-T-03",
                    itemName: "9 ml Clear Cylinder Roll-On Bottle - Matte Copper",
                    family: "Cylinder",
                    color: "Clear",
                    applicator: "Roll-On",
                    neckThreadSize: "17-415",
                    capacityMl: 9,
                    imageUrl: "https://cdn.shopify.com/rollon.png",
                },
            ],
        });

        expect(report.issues.map((issue) => issue.issueType)).toContain("madison_resolver_risk");
        expect(report.issues.map((issue) => issue.issueType)).toContain("applicator_mismatch");
        expect(report.summary.critical).toBeGreaterThanOrEqual(1);
    });

    it("extracts legacy search/list products for family-level sourcing audits", () => {
        const search = parseLegacySearchPage({
            html: bostonLegacySearchHtml,
            url: "https://www.bestbottles.com/all-bottles/all-items/search-products.php?search_name=boston+",
        });

        expect(search.products).toHaveLength(2);
        expect(search.products[0].websiteSku).toBe("GBBR15BlackCap");
        expect(search.products[0].family).toBe("Boston Round");
        expect(search.products[0].color).toBe("Clear");
        expect(search.products[0].capacityMl).toBe(15);
        expect(search.products[0].imageUrl).toBe("https://www.bestbottles.com/images/store/enlarged_pics/GBBR15BlackCap.gif");
    });

    it("flags legacy search products that match Convex but have no cached media", () => {
        const legacySearch = parseLegacySearchPage({
            html: bostonLegacySearchHtml,
            url: "https://www.bestbottles.com/all-bottles/all-items/search-products.php?search_name=boston+",
        });
        const report = reconcileProductTruth({
            legacySearch,
            routeOverrides: {},
            convexProducts: [
                {
                    slug: "boston-round-15ml-clear-18-400-cap",
                    websiteSku: "GBBR15BlackCap",
                    graceSku: "GB-BR-CLR-15ML-BLK",
                    itemName: "15 ml Clear Boston Round Bottle with Black Cap",
                    family: "Boston Round",
                    color: "Clear",
                    applicator: "Cap",
                    neckThreadSize: "18-400",
                    capacityMl: 15,
                },
            ],
        });

        expect(report.summary.legacySearchCount).toBe(2);
        expect(report.summary.legacySearchMatched).toBe(1);
        expect(report.issues.map((issue) => issue.issueType)).toContain("missing_shopify_media");
        expect(report.issues.map((issue) => issue.issueType)).toContain("missing_convex_match");
    });

    it("keeps the reconciliation script read-only", () => {
        const script = readFileSync("scripts/audit_product_truth_reconciliation.mjs", "utf8");
        expect(script).toContain("Read-only Best Bottles product truth reconciliation audit");
        expect(script).not.toContain("ctx.db.patch");
        expect(script).not.toContain(".mutation(");
        expect(script).not.toContain("admin/api");
        expect(script).not.toContain("mutation ");
    });
});
