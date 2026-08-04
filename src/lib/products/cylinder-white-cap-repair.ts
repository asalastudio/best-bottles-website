export const CYLINDER_SWIRL_WHITE_CAP_GROUP_SLUG = "cylinder-9ml-swirl-17-415-rollon";

const shared = {
    category: "Glass Bottle",
    family: "Cylinder",
    shape: "Swirl",
    color: "Swirl",
    capacity: "9 ml (0.3 oz)",
    capacityMl: 9,
    capacityOz: 0.3333,
    capColor: "White",
    trimColor: null,
    capStyle: "Roll-On",
    capHeight: null,
    neckThreadSize: "17-415",
    diameter: "21 ±0.5 mm",
    caseQuantity: 684,
    stockStatus: "In Stock",
    dataGrade: "A",
    bottleCollection: "Cylinder",
    fitmentStatus: "mapped",
    verified: false,
    importSource: "cylinder_9ml_17_415_white_cap_repair_20260803",
} as const;

/**
 * Canonical product truth for the two Swirl white-cap rows that complete the
 * 9 mL · 17-415 Cylinder cohort. These are real sellable products, not virtual
 * Paper Doll combinations. Keep the website SKU, Grace SKU, Shopify IDs, and
 * price ladders paired exactly as declared here.
 */
export const CYLINDER_SWIRL_WHITE_CAP_VARIANTS = [
    {
        ...shared,
        productId: "BB-GB-009-0116",
        websiteSku: "GBCylSwrl9MtlRollWht",
        graceSku: "GB-CYL-WHT-9ML-MRL-WHT",
        applicator: "Metal Roller Ball",
        ballMaterial: "Metal",
        heightWithCap: "87 ±1 mm",
        heightWithoutCap: "74 ±1 mm",
        bottleWeightG: 33,
        qbPrice: 0.76,
        webPrice1pc: 0.76,
        webPrice10pc: null,
        webPrice12pc: 0.72,
        priceTiers: [
            { minQty: 1, totalPrice: 0.76, unitPrice: 0.76 },
            { minQty: 12, totalPrice: 8.66, unitPrice: 0.72 },
            { minQty: 144, totalPrice: 98.5, unitPrice: 0.68 },
            { minQty: 684, totalPrice: 441.86, unitPrice: 0.65 },
            { minQty: 3420, totalPrice: 2027.38, unitPrice: 0.59 },
        ],
        itemName: "Cylinder swirl design 9ml glass bottle with metal roller ball plug and white cap.",
        itemDescription: "Cylinder swirl design 9ml, 1/3 oz clear glass bottle with metal roller ball plug and white cap. For use with perfume or fragrance oil, essential oils, aromatic oils and aromatherapy.",
        productUrl: "https://www.bestbottles.com/product/cylinder-design-9-ml-swirl-glass-bottle-metal-roller-ball-white-cap",
        shopifyVariantId: "gid://shopify/ProductVariant/54056453964068",
        shopifyInventoryItemId: "gid://shopify/InventoryItem/56082494816548",
    },
    {
        ...shared,
        productId: "BB-GB-009-0126",
        websiteSku: "GBCylSwrl9RollWht",
        graceSku: "GB-CYL-WHT-9ML-ROL-WHT",
        applicator: "Plastic Roller Ball",
        ballMaterial: "Plastic",
        heightWithCap: "75 ±1 mm",
        heightWithoutCap: "63 ±1 mm",
        bottleWeightG: 29,
        qbPrice: 0.67,
        webPrice1pc: 0.67,
        webPrice10pc: null,
        webPrice12pc: 0.64,
        priceTiers: [
            { minQty: 1, totalPrice: 0.67, unitPrice: 0.67 },
            { minQty: 12, totalPrice: 7.64, unitPrice: 0.64 },
            { minQty: 144, totalPrice: 86.83, unitPrice: 0.6 },
            { minQty: 684, totalPrice: 389.54, unitPrice: 0.57 },
            { minQty: 3420, totalPrice: 1787.29, unitPrice: 0.52 },
        ],
        itemName: "Cylinder swirl design 9ml glass bottle with plastic roller ball plug and white cap.",
        itemDescription: "Cylinder swirl design 9ml, 1/3 oz clear glass bottle with plastic roller ball plug and white cap. For use with perfume or fragrance oil, essential oils, aromatic oils and aromatherapy.",
        productUrl: "https://www.bestbottles.com/product/cylinder-design-9-ml-swirled-glass-bottle-plastic-roller-ball-plug-white-cap",
        shopifyVariantId: "gid://shopify/ProductVariant/54056453996836",
        shopifyInventoryItemId: "gid://shopify/InventoryItem/56082494849316",
    },
] as const;
