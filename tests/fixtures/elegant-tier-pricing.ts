import type { ProductVariant } from "@/app/products/[slug]/ProductDetailClient";

// Exact SKU ladder: legacy PDP, independently read 2026-10-02; also recorded in
// data/audits/legacy-tier-pricing-2026-07-20/tiers.jsonl. These are the published
// rounded unit rates, not a new discount or a reinterpretation of pack totals.
export const elegant = {
    _id: "elegant-15-silver", websiteSku: "GBElg15MtlRollSlSh", graceSku: "GB-ELG-CLR-15ML-MRL-SSLV",
    itemName: "15 ml Clear Elegant Metal Roller, Shiny Silver Cap", itemDescription: null, imageUrl: null,
    stockStatus: "In Stock", webPrice1pc: 0.88, webPrice10pc: null, webPrice12pc: 0.84,
    priceTiers: [
        { minQty: 1, unitPrice: 0.88 }, { minQty: 12, unitPrice: 0.84 },
        { minQty: 144, unitPrice: 0.79 }, { minQty: 288, unitPrice: 0.75 }, { minQty: 1440, unitPrice: 0.69 },
    ],
    category: "Glass Bottle", family: "Elegant", shape: null, color: "Clear", capacity: "15 ml", capacityMl: 15, capacityOz: 0.51,
    heightWithCap: null, heightWithoutCap: null, diameter: null, bottleWeightG: null, neckThreadSize: "13-415",
    bottleCollection: "Elegant", caseQuantity: 288, applicator: "Metal Roller Ball", capStyle: "Roll-On", capColor: "Shiny Silver", trimColor: null,
    shopifyVariantId: "gid://shopify/ProductVariant/123", shopifySellable: true,
} satisfies ProductVariant;

export const elegantBoundaries = [
    [1, 0.88], [11, 0.88], [12, 0.84], [13, 0.84], [60, 0.84],
    [143, 0.84], [144, 0.79], [145, 0.79], [287, 0.79], [288, 0.75],
    [289, 0.75], [1439, 0.75], [1440, 0.69], [1441, 0.69],
] as const;
